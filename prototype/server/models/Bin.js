const mongoose = require('mongoose');

const binSchema = new mongoose.Schema({
  name: { type: String, required: true },
  distance: { type: Number },
  fullness: { type: Number },
  level: { type: String },
  streams: [{ type: String }]
});

module.exports = mongoose.model('Bin', binSchema);
