const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const Station = require('./models/Station');
const Bin = require('./models/Bin');
const OverviewStat = require('./models/OverviewStat');
const ProblemBin = require('./models/ProblemBin');
const FullnessReport = require('./models/FullnessReport');
const StudentImpact = require('./models/StudentImpact');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

async function seedDatabase() {
  try {
    const stationCount = await Station.estimatedDocumentCount();
    let station;
    if (stationCount === 0) {
      station = await Station.create({
        name: 'Bruin Plate — Exit',
        shortName: 'Bruin Plate',
        qrCode: 'QR-BP-001',
        description: 'Compost / Recycle / Landfill station near the dining hall exit.'
      });
      console.log('Seeded Station');
    } else {
      station = await Station.findOne();
    }

    const binCount = await Bin.estimatedDocumentCount();
    if (binCount === 0) {
      await Bin.insertMany([
        {
          name: 'Engineering VI — Lobby',
          distance: 61,
          fullness: 95,
          level: 'Critical',
          streams: ['recycle', 'landfill']
        },
        {
          name: 'De Neve Plaza',
          distance: 110,
          fullness: 72,
          level: 'Warning',
          streams: ['compost', 'recycle', 'landfill']
        },
        {
          name: 'Court of Sciences — North',
          distance: 238,
          fullness: 88,
          level: 'Critical',
          streams: ['recycle', 'landfill']
        },
        {
          name: 'Bruin Plate — Exit',
          distance: 15,
          fullness: 40,
          level: 'Good',
          streams: ['compost', 'recycle', 'landfill']
        }
      ]);
      console.log('Seeded Bins');
    }

    const overviewCount = await OverviewStat.estimatedDocumentCount();
    if (overviewCount === 0) {
      await OverviewStat.insertMany([
        {
          statId: 'scansToday',
          label: 'Scans Today',
          value: 863,
          delta: '+12% from yesterday'
        },
        {
          statId: 'avgContamination',
          label: 'Avg Contamination',
          value: 7.2,
          delta: '+0.5% from yesterday'
        },
        {
          statId: 'binsOver80',
          label: 'Bins > 80% Full',
          value: 2,
          delta: 'Require attention'
        },
        {
          statId: 'overflowReports',
          label: 'Overflow Reports',
          value: 14,
          delta: 'Today'
        }
      ]);
      console.log('Seeded OverviewStats');
    }

    const problemCount = await ProblemBin.estimatedDocumentCount();
    if (problemCount === 0) {
      await ProblemBin.insertMany([
        {
          name: 'Ackerman Union — Food Court',
          contamination: 12.3,
          location: 'Ackerman Union',
          qrCode: 'QR-AU-003',
          totalScansToday: 234,
          avgFillLast7Days: 62,
          overflowsThisMonth: 7
        },
        {
          name: 'Court of Sciences — North',
          contamination: 9.8,
          location: 'Court of Sciences',
          qrCode: 'QR-CS-002',
          totalScansToday: 142,
          avgFillLast7Days: 77,
          overflowsThisMonth: 5
        },
        {
          name: 'Bruin Plate — Exit',
          contamination: 8.5,
          location: 'Bruin Plate',
          qrCode: 'QR-BP-001',
          totalScansToday: 186,
          avgFillLast7Days: 54,
          overflowsThisMonth: 3
        },
        {
          name: 'De Neve Plaza',
          contamination: 6.7,
          location: 'De Neve Plaza',
          qrCode: 'QR-DN-004',
          totalScansToday: 98,
          avgFillLast7Days: 81,
          overflowsThisMonth: 4
        }
      ]);
      console.log('Seeded ProblemBins');
    }

    const impactCount = await StudentImpact.estimatedDocumentCount();
    if (impactCount === 0) {
      await StudentImpact.create({
        userId: 'demoStudent',
        compost: 22,
        recycle: 19,
        landfill: 14
      });
      console.log('Seeded StudentImpact');
    }
  } catch (err) {
    console.error('Error seeding database', err);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/station/current', async (req, res) => {
  try {
    const station = await Station.findOne().lean();
    if (!station) {
      return res.status(404).json({ message: 'Station not found' });
    }
    res.json(station);
  } catch (err) {
    console.error('Error in /api/station/current', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/bins/nearby', async (req, res) => {
  try {
    const bins = await Bin.find().lean();
    res.json(bins);
  } catch (err) {
    console.error('Error in /api/bins/nearby', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/overview', async (req, res) => {
  try {
    const stats = await OverviewStat.find().sort({ statId: 1 }).lean();
    res.json(stats);
  } catch (err) {
    console.error('Error in /api/admin/overview', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/problem-bins', async (req, res) => {
  try {
    const bins = await ProblemBin.find().lean();
    res.json(bins);
  } catch (err) {
    console.error('Error in /api/admin/problem-bins', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/student/impact', async (req, res) => {
  try {
    const impact =
      (await StudentImpact.findOne({ userId: 'demoStudent' }).lean()) ||
      {
        userId: 'demoStudent',
        compost: 0,
        recycle: 0,
        landfill: 0
      };
    res.json(impact);
  } catch (err) {
    console.error('Error in /api/student/impact', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/segment', (req, res) => {
  try {
    const items = [
      { id: '1', label: 'Apple core', stream: 'compost' },
      { id: '2', label: 'Paper napkin', stream: 'compost' },
      { id: '3', label: 'Aluminum can', stream: 'recycle' },
      { id: '4', label: 'Plastic water bottle', stream: 'recycle' },
      { id: '5', label: 'Chip bag', stream: 'landfill' }
    ];
    res.json(items);
  } catch (err) {
    console.error('Error in /api/segment', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/bins/report-fullness', async (req, res) => {
  try {
    const { stationId, level } = req.body;
    if (!level) {
      return res.status(400).json({ message: 'Level is required' });
    }
    const report = await FullnessReport.create({
      station: stationId || undefined,
      level
    });
    res.json({ ok: true, id: report._id.toString() });
  } catch (err) {
    console.error('Error in /api/bins/report-fullness', err);
    res.status(500).json({ message: 'Server error' });
  }
});

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedDatabase();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });
