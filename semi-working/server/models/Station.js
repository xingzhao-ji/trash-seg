const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  shortName: { 
    type: String,
    trim: true
  },
  qrCode: { 
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Station', stationSchema);
