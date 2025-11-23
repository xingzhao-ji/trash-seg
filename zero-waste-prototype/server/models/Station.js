const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  shortName: { type: String },
  qrCode: { type: String },
  description: { type: String }
});

module.exports = mongoose.model('Station', stationSchema);
