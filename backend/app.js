require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const otRoutes       = require('./routes/otRecords');
const authRoutes     = require('./routes/auth');
const scheduleRoutes = require('./routes/schedule');
const adminRoutes    = require('./routes/admin');
const User           = require('./models/User');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => cb(null, true), // Same domain on Vercel; safe
  credentials: true,
}));

app.use(express.json());

// ─── MongoDB connection (cached for serverless) ───────────────────────────────
// In serverless, each invocation may reuse the same process — cache the
// connection to avoid reconnecting on every request.
async function connectDB() {
  // 1 = connected, 2 = connecting
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2) {
    // Already connecting — wait for it
    await new Promise((resolve) => mongoose.connection.once('connected', resolve));
    return;
  }
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  console.log('✅ MongoDB connected');
}

// ─── DB middleware — MUST be before routes ────────────────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ DB connection error:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed. Please try again.' });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/ot',       otRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/admin',    adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', db: mongoose.connection.readyState, timestamp: new Date().toISOString() });
});

// ─── Admin seeder ─────────────────────────────────────────────────────────────
// Auto-creates admin account from .env on startup if it doesn't exist.
async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  try {
    const exists = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (!exists) {
      await User.create({
        name:       ADMIN_NAME || 'Admin',
        employeeId: 'ADMIN',
        email:      ADMIN_EMAIL.toLowerCase(),
        password:   ADMIN_PASSWORD,
        role:       'admin',
      });
      console.log(`✅ Admin account seeded: ${ADMIN_EMAIL}`);
    } else if (exists.role !== 'admin') {
      await User.findByIdAndUpdate(exists._id, { role: 'admin' });
      console.log(`✅ Existing account promoted to admin: ${ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.error('❌ Admin seed error:', err.message);
  }
}

// Run seeder after DB connection (used by server.js startup)
app.seedAdmin = seedAdmin;

module.exports = app;
