require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const otRoutes   = require('./routes/otRecords');
const authRoutes = require('./routes/auth');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// When hosted on Vercel (same domain), CORS is not needed.
// For local dev, allow localhost origins.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // Allow all — same-domain on Vercel, safe
  },
  credentials: true,
}));

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/ot',   otRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ─── MongoDB (cached for serverless) ─────────────────────────────────────────
let dbConnected = false;

async function connectDB() {
  if (dbConnected) return;
  await mongoose.connect(process.env.MONGO_URI);
  dbConnected = true;
  console.log('✅ MongoDB connected');
}

// Middleware to ensure DB is connected before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

module.exports = app;
