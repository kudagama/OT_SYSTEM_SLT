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

const OTAnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type:     String,
      required: [true, 'Title is required'],
      trim:     true,
    },
    message: {
      type:    String,
      trim:    true,
      default: '',
    },
    otDate: {
      type:     Date,
      required: [true, 'OT date is required'],
    },
    startTime: {
      type:    String,
      trim:    true,
      default: '',
    },
    endTime: {
      type:    String,
      trim:    true,
      default: '',
    },
    // Shift type used to auto-create the OT record when an employee accepts
    shiftType: {
      type:    String,
      enum:    { values: SHIFT_TYPES, message: '{VALUE} is not a valid shift type' },
      default: '8:00 AM - 4:00 PM',
    },
    // Max number of employees who can accept (default 1 = exclusive slot)
    maxAcceptances: {
      type:    Number,
      default: 1,
      min:     1,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
    // Employees who accepted this OT slot
    acceptances: [
      {
        userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        otRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'OTRecord' }, // auto-created record
        acceptedAt: { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('OTAnnouncement', OTAnnouncementSchema);
module.exports.SHIFT_TYPES = SHIFT_TYPES;
