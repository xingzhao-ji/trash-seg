const mongoose = require('mongoose');

const overviewStatSchema = new mongoose.Schema({
  statId: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  value: { type: Number, required: true },
  delta: { type: String }
});

module.exports = mongoose.model('OverviewStat', overviewStatSchema);
