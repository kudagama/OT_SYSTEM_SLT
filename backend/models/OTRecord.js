const mongoose = require('mongoose');

const SHIFT_TYPES = [
  '8:00 AM - 4:00 PM',
  '9:00 AM - 5:00 PM',
  '2:00 PM - 10:00 PM',
  '4:00 PM - 8:00 AM',
  '7:00 AM - 3:00 PM',
  '1st Off',
  '2nd Off',
  'Night Off',
  'Custom',
];

const OTRecordSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User ID is required'],
      index:    true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    shiftType: {
      type: String,
      required: [true, 'Shift type is required'],
      enum: {
        values: SHIFT_TYPES,
        message: '{VALUE} is not a valid shift type',
      },
    },
    otStartTime: {
      type: String,
      default: '',
      trim: true,
    },
    otEndTime: {
      type: String,
      default: '',
      trim: true,
    },
    otHours: {
      type: Number,
      required: [true, 'OT hours are required'],
      min: [0,     'OT hours cannot be negative'],
      max: [23.75, 'OT hours cannot reach or exceed 24h (shift + OT must be < 24h)'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to format date as YYYY-MM-DD for frontend convenience
OTRecordSchema.virtual('dateFormatted').get(function () {
  return this.date.toISOString().split('T')[0];
});

OTRecordSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('OTRecord', OTRecordSchema);
module.exports.SHIFT_TYPES = SHIFT_TYPES;
