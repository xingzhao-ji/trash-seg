const mongoose = require('mongoose');

const overviewStatSchema = new mongoose.Schema({
  statId: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  label: { 
    type: String, 
    required: true,
    trim: true
  },
  value: { 
    type: Number, 
    required: true
  },
  delta: { 
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OverviewStat', overviewStatSchema);
