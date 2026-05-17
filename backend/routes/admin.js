const express        = require('express');
const router         = express.Router();
const User           = require('../models/User');
const OTRecord       = require('../models/OTRecord');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

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

module.exports = router;
