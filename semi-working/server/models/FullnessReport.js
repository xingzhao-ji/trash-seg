const mongoose = require('mongoose');

const fullnessReportSchema = new mongoose.Schema({
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

module.exports = mongoose.model('FullnessReport', fullnessReportSchema);
