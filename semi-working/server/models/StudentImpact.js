const mongoose = require('mongoose');

const studentImpactSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  compost: { 
    type: Number, 
    default: 0,
    min: 0
  },
  recycle: { 
    type: Number, 
    default: 0,
    min: 0
  },
  landfill: { 
    type: Number, 
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Virtual for total items sorted
studentImpactSchema.virtual('totalItems').get(function() {
  return this.compost + this.recycle + this.landfill;
});

// Virtual for items diverted from landfill
studentImpactSchema.virtual('itemsDiverted').get(function() {
  return this.compost + this.recycle;
});

// Include virtuals when converting to JSON
studentImpactSchema.set('toJSON', { virtuals: true });
studentImpactSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StudentImpact', studentImpactSchema);
