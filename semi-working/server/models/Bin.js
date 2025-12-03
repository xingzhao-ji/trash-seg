const mongoose = require('mongoose');

const binSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  facilityId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  qrCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },

  // Location Data
  location: {
    type: String,
    trim: true
  },
  building: {
    type: String,
    trim: true
  },
  floor: {
    type: String,
    trim: true
  },
  latitude: {
    type: Number,
    min: -90,
    max: 90,
    default: null
  },
  longitude: {
    type: Number,
    min: -180,
    max: 180,
    default: null
  },
  distance: {
    type: Number,
    min: 0,
    default: null
  },

  // Status Information 
  fullness: { // Kept for backward compatibility
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  fullnessHistory: [
    {
      fullness: {
        type: Number, // e.g., 0 to 100
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  level: {
    type: String,
    enum: ['Good', 'Warning', 'Critical'],
    default: 'Good'
  },
  contamination: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  // Bin Configuration
  streams: [{
    type: String,
    enum: ['compost', 'recycle', 'landfill']
  }],
  capacity: {
    type: Number,
    min: 0,
    default: 100
  },
  type: {
    type: String,
    enum: ['standard', 'smart', 'compactor'],
    default: 'standard'
  },

  // Metadata
  description: {
    type: String,
    trim: true,
    default: ''
  },
  lastReported: {
    type: Date
  },
  lastEmptied: {
    type: Date
  },
  maintenanceRequired: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for geospatial queries
binSchema.index({ latitude: 1, longitude: 1 });

// Index for facility integration
binSchema.index({ facilityId: 1 });
binSchema.index({ qrCode: 1 });

// Virtual for calculating if bin needs attention
binSchema.virtual('needsAttention').get(function () {
  return this.fullness >= 80 || this.level === 'Critical' || this.maintenanceRequired;
});

// Method to calculate distance from coordinates
binSchema.methods.calculateDistance = function (lat, lon) {
  if (!this.latitude || !this.longitude) return null;

  const R = 6371e3; // Earth radius in meters
  const φ1 = lat * Math.PI / 180;
  const φ2 = this.latitude * Math.PI / 180;
  const Δφ = (this.latitude - lat) * Math.PI / 180;
  const Δλ = (this.longitude - lon) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
};

module.exports = mongoose.model('Bin', binSchema);
