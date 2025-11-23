const mongoose = require('mongoose');

const studentImpactSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  compost: { type: Number, default: 0 },
  recycle: { type: Number, default: 0 },
  landfill: { type: Number, default: 0 }
});

module.exports = mongoose.model('StudentImpact', studentImpactSchema);
