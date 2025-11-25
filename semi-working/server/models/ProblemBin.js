const mongoose = require('mongoose');

const problemBinSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  contamination: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100
  },
  location: { 
    type: String,
    trim: true
  },
  qrCode: { 
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  totalScansToday: { 
    type: Number,
    default: 0,
    min: 0
  },
  avgFillLast7Days: { 
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  overflowsThisMonth: { 
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ProblemBin', problemBinSchema);
