const express          = require('express');
const router           = express.Router();
const User             = require('../models/User');
const OTRecord         = require('../models/OTRecord');
const OTAnnouncement   = require('../models/OTAnnouncement');
const authMiddleware   = require('../middleware/auth');
const adminMiddleware  = require('../middleware/admin');

// All admin routes: must be logged in AND be admin
router.use(authMiddleware, adminMiddleware);

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// List all non-admin users with their all-time OT stats
router.get('/users', async (req, res) => {
  try {
    // Fetch all non-admin users (includes legacy accounts where role field doesn't exist)
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password')
      .sort({ createdAt: -1 });

    // Aggregate OT stats per user
    const stats = await OTRecord.aggregate([
      { $group: {
        _id:              '$userId',
        totalOTHours:     { $sum: '$otHours' },
        totalEntries:     { $sum: 1 },
        lastEntryDate:    { $max: '$date' },
        secondOffHours:   { $sum: { $cond: [{ $eq: ['$shiftType', '2nd Off'] }, '$otHours', 0] } },
        secondOffEntries: { $sum: { $cond: [{ $eq: ['$shiftType', '2nd Off'] }, 1, 0] } },
      }},
    ]);

    const statsMap = {};
    stats.forEach((s) => { statsMap[String(s._id)] = s; });

    const result = users.map((u) => {
      const s = statsMap[String(u._id)] || {};
      return {
        id:               u._id,
        name:             u.name,
        employeeId:       u.employeeId || '—',
        email:            u.email,
        role:             u.role || 'user',
        registeredAt:     u.createdAt,
        totalOTHours:     s.totalOTHours     || 0,
        totalEntries:     s.totalEntries     || 0,
        lastEntryDate:    s.lastEntryDate    || null,
        secondOffHours:   s.secondOffHours   || 0,
        secondOffEntries: s.secondOffEntries || 0,
      };
    });

    res.json({ success: true, users: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/admin/users/:id/records ────────────────────────────────────────
// Get all OT records for a specific user
router.get('/users/:id/records', async (req, res) => {
  try {
    const records = await OTRecord.find({ userId: req.params.id })
      .sort({ date: -1 });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/admin/users/:id/schedule ───────────────────────────────────────
// Get schedule entries for a specific user
router.get('/users/:id/schedule', async (req, res) => {
  try {
    const Schedule = require('../models/Schedule');
    const schedule = await Schedule.findOne({ userId: req.params.id });
    res.json({ success: true, data: schedule ? schedule.entries : {}, shiftChanges: schedule ? schedule.shiftChanges : {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
// Global stats for the admin summary bar
router.get('/stats', async (req, res) => {
  try {
    const now          = new Date();
    const monthStart   = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const monthEnd     = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

    // Fetch IDs of all normal employees so we exclude admin OT and deleted user OT
    const employees = await User.find({ role: { $ne: 'admin' } }).select('_id');
    const employeeIds = employees.map(e => e._id); // Must remain ObjectIds for $match

    const [totalUsers, totalOT, monthOT] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      OTRecord.aggregate([
        { $match: { userId: { $in: employeeIds } } },
        { $group: { _id: null, total: { $sum: '$otHours' } } }
      ]),
      OTRecord.aggregate([
        { $match: { date: { $gte: monthStart, $lt: monthEnd }, userId: { $in: employeeIds } } },
        { $group: { _id: '$userId', hours: { $sum: '$otHours' } } },
      ]),
    ]);

    res.json({
      success:       true,
      totalUsers,
      totalOTHours:  totalOT[0]?.total || 0,
      activeThisMonth: monthOT.length,
      monthOTHours:  monthOT.reduce((s, r) => s + r.hours, 0),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ─── POST /api/admin/announcements ───────────────────────────────────────────
// Create a new OT announcement broadcast to all employees
router.post('/announcements', async (req, res) => {
  try {
    const { title, message, otDate, startTime, endTime, shiftType } = req.body;
    if (!title || !otDate) {
      return res.status(400).json({ success: false, message: 'Title and OT date are required.' });
    }
    const announcement = await OTAnnouncement.create({
      title,
      message:   message   || '',
      otDate:    new Date(otDate),
      startTime: startTime || '',
      endTime:   endTime   || '',
      shiftType: shiftType || '8:00 AM - 4:00 PM',
      isActive:  true,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/admin/announcements ────────────────────────────────────────────
// List all announcements (active + inactive) for admin management
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await OTAnnouncement.find()
      .sort({ createdAt: -1 });
    const data = announcements.map((a) => {
      const obj = a.toObject();
      obj.acceptanceCount = a.acceptances.length;
      delete obj.acceptances; // don't send the full array to admin list
      return obj;
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/admin/announcements/:id ─────────────────────────────────────
// Deactivate (soft-delete) an announcement so employees no longer see it
router.delete('/announcements/:id', async (req, res) => {
  try {
    await OTAnnouncement.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/admin/announcements/:id/acceptances ────────────────────────────
// Returns the list of employees who accepted a specific OT announcement
router.get('/announcements/:id/acceptances', async (req, res) => {
  try {
    const ann = await OTAnnouncement.findById(req.params.id)
      .populate('acceptances.userId', 'name employeeId email');
    if (!ann) return res.status(404).json({ success: false, message: 'Not found.' });

    const list = ann.acceptances.map((a) => ({
      name:       a.userId?.name       || '—',
      employeeId: a.userId?.employeeId || '—',
      email:      a.userId?.email      || '—',
      acceptedAt: a.acceptedAt,
    }));
    res.json({ success: true, data: list, total: list.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
