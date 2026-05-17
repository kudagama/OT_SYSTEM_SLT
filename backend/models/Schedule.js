const mongoose = require('mongoose');

/**
 * One document per user — stores date→shiftType mapping.
 * entries is a plain object: { "2026-05-18": "8:00 AM - 4:00 PM", ... }
 */
const ScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,   // one schedule doc per user
      index:    true,
    },
    entries: {
      type:    Map,
      of:      String,  // date-key → shiftType
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Schedule', ScheduleSchema);
