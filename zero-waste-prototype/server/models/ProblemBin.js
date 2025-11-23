const mongoose = require('mongoose');

const problemBinSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contamination: { type: Number, required: true },
  location: { type: String },
  qrCode: { type: String },
  totalScansToday: { type: Number },
  avgFillLast7Days: { type: Number },
  overflowsThisMonth: { type: Number }
});

module.exports = mongoose.model('ProblemBin', problemBinSchema);
