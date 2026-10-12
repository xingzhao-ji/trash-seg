const mongoose = require('mongoose');

const fullnessReportSchema = new mongoose.Schema({
  bin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: function () { return !this.station; }
  },
  // Retained for historical records; older data tools stored bin IDs here.
  station: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Station',
    required: false
  },
  level: { 
    type: String, 
    required: true,
    enum: ['Empty', '1/4 Full', 'Half Full', '3/4 Full', 'Full', 'Overflowing']
  },
  reportedBy: {
    type: String,
    default: 'demoStudent'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

fullnessReportSchema.index({ bin: 1, createdAt: -1 });

fullnessReportSchema.statics.forBin = function (binId) {
  return { $or: [{ bin: binId }, { bin: { $exists: false }, station: binId }] };
};

module.exports = mongoose.model('FullnessReport', fullnessReportSchema);
