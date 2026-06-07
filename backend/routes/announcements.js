const express          = require('express');
const router           = express.Router();
const OTAnnouncement   = require('../models/OTAnnouncement');
const OTRecord         = require('../models/OTRecord');
const Schedule         = require('../models/Schedule');
const authMiddleware   = require('../middleware/auth');

// All routes require login (employees + admin)
router.use(authMiddleware);

// ── Helper: convert "HH:MM" (24h) to "H:MM AM/PM" display string ──────────────
function fmt12h(t) {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// ── Helper: calculate OT hours from two "HH:MM" strings ───────────────────────
function calcOTHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // overnight
  return Math.round((mins / 60) * 4) / 4; // round to nearest 0.25h
}

// ── Helper: parse standard shift string to minutes ───────────────────────────
function parseShiftType(shiftType) {
  if (!shiftType || shiftType.includes('Off') || shiftType === 'Custom') return null;
  const match = shiftType.match(/(\d+):(\d+)\s*([AP]M)\s*-\s*(\d+):(\d+)\s*([AP]M)/i);
  if (!match) return null;
  const toMins = (h, m, ampm) => {
    h = parseInt(h, 10);
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + parseInt(m, 10);
  };
  let s = toMins(match[1], match[2], match[3]);
  let e = toMins(match[4], match[5], match[6]);
  if (e <= s) e += 1440; // overnight
  return { startMins: s, endMins: e, durationHours: (e - s) / 60 };
}

// ── Helper: check overlap between shift string and OT HH:MM ───────────────────
function checkOverlap(shiftStr, otStartHHMM, otEndHHMM) {
  const shift = parseShiftType(shiftStr);
  if (!shift || !otStartHHMM || !otEndHHMM) return false;

  const [sh, sm] = otStartHHMM.split(':').map(Number);
  const s2 = sh * 60 + sm;
  
  const [eh, em] = otEndHHMM.split(':').map(Number);
  let e2 = eh * 60 + em;
  if (e2 <= s2) e2 += 1440; // overnight

  return Math.max(shift.startMins, s2) < Math.min(shift.endMins, e2);
}

// ─── GET /api/announcements/active ────────────────────────────────────────────
// Returns all active announcements with acceptance status for the current user
router.get('/active', async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const announcements = await OTAnnouncement.find({ isActive: true })
      .sort({ createdAt: -1 });

    const data = announcements.map((a) => {
      const obj           = a.toObject();
      const acceptList    = a.acceptances || [];
      const maxAcc        = a.maxAcceptances || 1;
      
      obj.acceptanceCount = acceptList.length;
      obj.isFull          = acceptList.length >= maxAcc;
      obj.accepted        = acceptList.some((x) => x.userId.toString() === userId);
      delete obj.acceptances; // don't expose other users' IDs
      return obj;
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/announcements/:id/accept ──────────────────────────────────────
// Employee accepts an OT slot — limited to maxAcceptances (default 1)
// Auto-creates an OTRecord in the employee's list
router.post('/:id/accept', async (req, res) => {
  try {
    const userId = req.user._id;
    const ann    = await OTAnnouncement.findById(req.params.id);
    if (!ann || !ann.isActive) {
      return res.status(404).json({ success: false, message: 'Announcement not found or inactive.' });
    }

    // Ensure acceptances is an array
    const acceptList = ann.acceptances || [];

    // Already accepted by this user?
    const alreadyAccepted = acceptList.some((x) => x.userId.toString() === userId.toString());
    if (alreadyAccepted) {
      return res.json({ success: true, acceptanceCount: acceptList.length, accepted: true, isFull: acceptList.length >= (ann.maxAcceptances || 1) });
    }

    // Slot full?
    if (acceptList.length >= (ann.maxAcceptances || 1)) {
      return res.status(400).json({ success: false, message: 'This OT slot has already been taken.' });
    }

    const otHours = calcOTHours(ann.startTime, ann.endTime);

    // ── Schedule Validations (Overlap & 24h cap) ──
    const dateKey = ann.otDate.toISOString().split('T')[0];
    const userSched = await Schedule.findOne({ userId });
    
    if (userSched && userSched.entries && userSched.entries[dateKey]) {
      const regularShift = userSched.entries[dateKey];
      const shiftData = parseShiftType(regularShift);
      
      if (shiftData) {
        // Overlap Check
        if (checkOverlap(regularShift, ann.startTime, ann.endTime)) {
          return res.status(400).json({ success: false, message: 'Conflicts with your regular shift.' });
        }
        
        // 24h Check
        if (shiftData.durationHours + otHours >= 24) {
          return res.status(400).json({ success: false, message: `Exceeds 24h limit (${shiftData.durationHours}h shift + ${otHours}h OT).` });
        }
      }
    }

    const otRecord = await OTRecord.create({
      userId,
      date:            ann.otDate,
      shiftType:       ann.shiftType,
      otStartTime:     fmt12h(ann.startTime),
      otEndTime:       fmt12h(ann.endTime),
      pearlLoginTime:  ann.startTime || '',
      pearlLogoutTime: ann.endTime || '',
      otHours:         otHours > 0 ? otHours : 0,
      notes:           `[Auto] ${ann.title}`,
    });

    if (!ann.acceptances) ann.acceptances = [];
    ann.acceptances.push({ userId, otRecordId: otRecord._id, acceptedAt: new Date() });
    await ann.save();

    res.json({
      success:         true,
      acceptanceCount: ann.acceptances.length,
      accepted:        true,
      isFull:          ann.acceptances.length >= (ann.maxAcceptances || 1),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/announcements/:id/accept ────────────────────────────────────
// Employee cancels — removes acceptance AND deletes the auto-created OTRecord
router.delete('/:id/accept', async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const ann    = await OTAnnouncement.findById(req.params.id);
    if (!ann) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    // Ensure it's an array
    if (!ann.acceptances) ann.acceptances = [];
    
    // Find the acceptance entry to get the linked OTRecord id
    const entry = ann.acceptances.find((x) => x.userId.toString() === userId);
    if (entry?.otRecordId) {
      await OTRecord.findByIdAndDelete(entry.otRecordId);
    }

    // Remove from acceptances array
    ann.acceptances = ann.acceptances.filter((x) => x.userId.toString() !== userId);
    await ann.save();

    res.json({
      success:         true,
      acceptanceCount: ann.acceptances.length,
      accepted:        false,
      isFull:          ann.acceptances.length >= (ann.maxAcceptances || 1),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
