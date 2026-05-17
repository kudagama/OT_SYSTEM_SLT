const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { id: user._id, name: user.name, email: user.email, employeeId: user.employeeId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ─── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, employeeId, email, password } = req.body;

    if (!name || !employeeId || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, Employee ID, email and password are required.' });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const existingEmpId = await User.findOne({ employeeId: employeeId.toUpperCase() });
    if (existingEmpId) {
      return res.status(409).json({ success: false, message: 'An account with this Employee ID already exists.' });
    }

    const user  = await User.create({ name, employeeId, email, password });
    const token = signToken(user);

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, employeeId: user.employeeId, email: user.email, role: user.role },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken(user);

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, employeeId: user.employeeId, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Validate token & return current user info
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
// Update name and/or employeeId (email & password unchanged here)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, employeeId } = req.body;
    const userId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }

    // Check duplicate employeeId — exclude current user
    if (employeeId) {
      const duplicate = await User.findOne({
        employeeId: employeeId.toUpperCase(),
        _id: { $ne: userId },
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Employee ID is already in use by another account.' });
      }
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        name: name.trim(),
        ...(employeeId ? { employeeId: employeeId.trim().toUpperCase() } : {}),
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Issue a fresh token with updated info
    const token = signToken(updated);

    res.json({
      success: true,
      token,
      user: { id: updated._id, name: updated.name, employeeId: updated.employeeId, email: updated.email, role: updated.role },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

