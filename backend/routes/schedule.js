const express       = require('express');
const router        = express.Router();
const Schedule      = require('../models/Schedule');
const authMiddleware = require('../middleware/auth');

// All schedule routes require authentication
router.use(authMiddleware);

// ─── GET /api/schedule ────────────────────────────────────────────────────────
// Returns the user's full schedule as a plain object { "YYYY-MM-DD": "shiftType" }
router.get('/', async (req, res) => {
  try {
    const doc = await Schedule.findOne({ userId: req.user.id });
    const entries = doc ? Object.fromEntries(doc.entries) : {};
    res.json({ success: true, entries });
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

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ success: false, message: 'Invalid date key format. Use YYYY-MM-DD.' });
    }
    if (!shiftType) {
      return res.status(400).json({ success: false, message: 'shiftType is required.' });
    }

    const doc = await Schedule.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { [`entries.${dateKey}`]: shiftType } },
      { new: true, upsert: true }
    );

    res.json({ success: true, entries: Object.fromEntries(doc.entries) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/schedule/:dateKey ────────────────────────────────────────────
// Remove a single day's shift
router.delete('/:dateKey', async (req, res) => {
  try {
    const { dateKey } = req.params;

    const doc = await Schedule.findOneAndUpdate(
      { userId: req.user.id },
      { $unset: { [`entries.${dateKey}`]: '' } },
      { new: true }
    );

    const entries = doc ? Object.fromEntries(doc.entries) : {};
    res.json({ success: true, entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/schedule ─────────────────────────────────────────────────────
// Clear the entire schedule
router.delete('/', async (req, res) => {
  try {
    await Schedule.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { entries: {} } }
    );
    res.json({ success: true, entries: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
