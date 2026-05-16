require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const otRoutes   = require('./routes/otRecords');
const authRoutes = require('./routes/auth');

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
app.use('/api/auth', authRoutes);
app.use('/api/ot',   otRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', db: mongoose.connection.readyState, timestamp: new Date().toISOString() });
});

module.exports = app;
