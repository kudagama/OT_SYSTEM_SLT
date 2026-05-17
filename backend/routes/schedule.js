const express        = require('express');
const router         = express.Router();
const Schedule       = require('../models/Schedule');
const authMiddleware = require('../middleware/auth');

// All schedule routes require authentication
router.use(authMiddleware);

// ─── Helper: get or create schedule doc ──────────────────────────────────────
async function getOrCreate(userId) {
  let doc = await Schedule.findOne({ userId });
  if (!doc) doc = await Schedule.create({ userId, entries: {} });
  return doc;
}

// ─── GET /api/schedule ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const doc = await Schedule.findOne({ userId: req.user.id });
    res.json({ success: true, entries: doc ? doc.entries : {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/schedule/:dateKey ───────────────────────────────────────────────
// Set or update a single day's shift (dateKey = "YYYY-MM-DD")
router.put('/:dateKey', async (req, res) => {
  try {
    const { dateKey } = req.params;
    const { shiftType } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ success: false, message: 'Invalid date key. Use YYYY-MM-DD.' });
    }
    if (!shiftType) {
      return res.status(400).json({ success: false, message: 'shiftType is required.' });
    }

    // Use findOneAndUpdate with $set on the Mixed field sub-key
    // Then re-fetch to guarantee the returned entries are fresh
    await Schedule.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { [`entries.${dateKey}`]: shiftType } },
      { upsert: true }
    );

    // Refetch to get the authoritative state
    const doc = await Schedule.findOne({ userId: req.user.id });
    res.json({ success: true, entries: doc ? doc.entries : {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/schedule/:dateKey ────────────────────────────────────────────
router.delete('/:dateKey', async (req, res) => {
  try {
    const { dateKey } = req.params;

    await Schedule.findOneAndUpdate(
      { userId: req.user.id },
      { $unset: { [`entries.${dateKey}`]: '' } }
    );

    const doc = await Schedule.findOne({ userId: req.user.id });
    res.json({ success: true, entries: doc ? doc.entries : {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/schedule ─────────────────────────────────────────────────────
router.delete('/', async (req, res) => {
  try {
    await Schedule.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { entries: {} } },
      { upsert: true }
    );
    res.json({ success: true, entries: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
