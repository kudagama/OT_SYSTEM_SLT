const express      = require('express');
const router       = express.Router();
const OTRecord     = require('../models/OTRecord');
const authMiddleware = require('../middleware/auth');

// All OT routes require authentication
router.use(authMiddleware);

// ─── Helper: build monthly summary for a specific user ────────────────────────
async function getMonthlySummary(userId, year, month) {
  // Records are stored as UTC midnight (new Date("YYYY-MM-DD")).
  // Use UTC-based boundaries to avoid timezone mismatch.
  const start = new Date(Date.UTC(year, month - 1, 1));            // 1st of month 00:00 UTC
  const end   = new Date(Date.UTC(year, month,     1) - 1);        // last ms of month UTC

  const result = await OTRecord.aggregate([
    { $match: { userId: userId, date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        totalOTHours: { $sum: '$otHours' },
        totalEntries: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0
    ? { totalOTHours: result[0].totalOTHours, totalEntries: result[0].totalEntries }
    : { totalOTHours: 0, totalEntries: 0 };
}

// ─── GET /api/ot/summary?year=2025&month=6 ────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;

    const summary = await getMonthlySummary(req.user.id, year, month);
    res.json({ success: true, year, month, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/ot ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const records = await OTRecord.find({ userId: req.user.id }).sort({ date: -1 });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/ot ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { date, shiftType, otStartTime, otEndTime, otHours, notes } = req.body;

    const record = new OTRecord({
      userId:      req.user.id,
      date:        new Date(date),
      shiftType,
      otStartTime: otStartTime || '',
      otEndTime:   otEndTime   || '',
      otHours:     parseFloat(otHours),
      notes:       notes || '',
    });

    const saved = await record.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/ot/:id ──────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { date, shiftType, otStartTime, otEndTime, otHours, notes } = req.body;

    // Ensure the record belongs to the requesting user
    const existing = await OTRecord.findOne({ _id: req.params.id, userId: req.user.id });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }

    const updated = await OTRecord.findByIdAndUpdate(
      req.params.id,
      {
        date:        new Date(date),
        shiftType,
        otStartTime: otStartTime || '',
        otEndTime:   otEndTime   || '',
        otHours:     parseFloat(otHours),
        notes:       notes || '',
      },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/ot/:id ───────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // Ensure the record belongs to the requesting user
    const deleted = await OTRecord.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }
    res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
