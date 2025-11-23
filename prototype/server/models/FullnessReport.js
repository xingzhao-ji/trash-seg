const mongoose = require('mongoose');

const fullnessReportSchema = new mongoose.Schema(
  {
    station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station' },
    level: { type: String, required: true }
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false
    }
  }
);

module.exports = mongoose.model('FullnessReport', fullnessReportSchema);
