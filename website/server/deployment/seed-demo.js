const mongoose = require('mongoose');
const Bin = require('../models/Bin');
const Station = require('../models/Station');
const FullnessReport = require('../models/FullnessReport');
const StudentImpact = require('../models/StudentImpact');
const sample = require('../ucla_bins_sample.json');

// Never loads .env, deletes records, resets a used demo, or accepts a production DB name.
async function seedDemo() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    if (mongoose.connection.name !== 'zero_waste_demo') {
      throw new Error('Synthetic seeding requires the isolated database name zero_waste_demo');
    }
    const db = mongoose.connection.db;
    const markers = db.collection('demo_seed');
    if (await markers.findOne({ _id: 'synthetic-v1' })) {
      console.log('Synthetic demo already initialized; preserving existing records.');
      return;
    }
    for (const collection of await db.listCollections({}, { nameOnly: true }).toArray()) {
      if (await db.collection(collection.name).findOne({})) {
        throw new Error('Refusing to seed a nonempty database without the demo seed marker');
      }
    }
    const now = new Date();
    const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
    const fullness = [92, 48, 32, 87, 100, 68, 22, 53, 71, 35];
    const bins = await Bin.insertMany(sample.bins.map((bin, index) => ({
      ...bin, _id: new mongoose.Types.ObjectId((index + 1).toString(16).padStart(24, '0')),
      description: 'Synthetic sample campus record, prepared for local demonstration only',
      fullness: fullness[index], level: fullness[index] > 80 ? 'Critical' : fullness[index] >= 75 ? 'Warning' : 'Good',
      contamination: [7, 2, 1, 5, 8, 3, 1, 2, 4, 1][index], active: true,
      lastReported: now, fullnessHistory: [{ fullness: fullness[index], timestamp: now }],
    })));
    await Station.create({
      name: 'Ackerman Union — Food Court', shortName: 'Synthetic demo station',
      qrCode: 'DEMO-ACKERMAN', description: 'Synthetic campus demo station',
    });
    await StudentImpact.create({ userId: 'demoStudent', compost: 42, recycle: 68, landfill: 15 });
    const levels = ['Empty', '1/4 Full', 'Half Full', '3/4 Full', 'Full'];
    await FullnessReport.insertMany(Array.from({ length: 72 }, (_, index) => ({
      bin: bins[index % bins.length]._id,
      level: index < 3 ? 'Overflowing' : levels[index % levels.length],
      reportedBy: 'syntheticDemo',
      createdAt: index < 42
        ? new Date(today.getTime() + Math.floor((now - today) * index / 42))
        : new Date(today.getTime() - (index - 41) * 30 * 60000),
    })));
    await markers.insertOne({ _id: 'synthetic-v1', createdAt: now, synthetic: true });
    console.log('Seeded synthetic demo: 10 bins, 72 reports, one station, shared example impact.');
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = seedDemo;
if (require.main === module) seedDemo().catch(error => {
  console.error(`Synthetic seed failed: ${error.message}`);
  process.exitCode = 1;
});
