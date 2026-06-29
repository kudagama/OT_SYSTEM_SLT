const mongoose = require('mongoose');

/**
 * One document per user — stores date→shiftType mapping.
 * entries is a plain object: { "2026-05-18": "8:00 AM - 4:00 PM", ... }
 * shiftChanges is a plain object: { "2026-05-18": "9:00 AM - 5:00 PM", ... }
 * Using Mixed type for reliable dot-notation $set operations.
 */
const ScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },
    entries: {
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },
    shiftChanges: {
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Schedule', ScheduleSchema);
