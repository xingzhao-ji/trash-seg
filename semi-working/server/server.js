const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const Station = require('./models/Station');
const Bin = require('./models/Bin');
const OverviewStat = require('./models/OverviewStat');
const ProblemBin = require('./models/ProblemBin');
const FullnessReport = require('./models/FullnessReport');
const StudentImpact = require('./models/StudentImpact');

// Import services
const FacilitiesIntegration = require('./services/facilitiesIntegration');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

// Check for MongoDB URI
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not set in the environment.');
  console.error('Please create a .env file with MONGODB_URI=your_connection_string');
  process.exit(1);
}

// Initialize database with minimal required data
async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Only create a default station if none exists
    const stationCount = await Station.estimatedDocumentCount();
    if (stationCount === 0) {
      await Station.create({
        name: 'Default Station',
        shortName: 'Station 1',
        qrCode: 'QR-DEFAULT-001',
        description: 'Default station - update with real location data'
      });
      console.log('✓ Created default station');
    }

    // Initialize empty collections if needed
    console.log('✓ Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Update bin statistics in real-time
async function updateBinStatistics() {
  try {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setSeconds(-1);

    // Calculate scans today (fullness reports count as scans)
    const scansToday = await FullnessReport.countDocuments({
      createdAt: { $gte: todayStart }
    });

    // Calculate scans yesterday for comparison
    const scansYesterday = await FullnessReport.countDocuments({
      createdAt: { $gte: yesterdayStart, $lt: todayStart }
    });

    // Calculate percentage change
    let scansDelta = 'No change';
    if (scansYesterday > 0) {
      const percentChange = ((scansToday - scansYesterday) / scansYesterday * 100).toFixed(1);
      scansDelta = percentChange >= 0 ? `+${percentChange}% from yesterday` : `${percentChange}% from yesterday`;
    } else if (scansToday > 0) {
      scansDelta = 'First reports today!';
    }

    // Calculate bins over 80% full
    const fullBins = await Bin.countDocuments({
      fullness: { $gt: 80 }
    });

    // Calculate average contamination
    const binsWithContamination = await Bin.find({
      contamination: { $exists: true, $gt: 0 }
    });

    const problemBinsData = await ProblemBin.find();

    let avgContamination = 0;
    let contaminationDelta = 'No contamination data';

    if (binsWithContamination.length > 0 || problemBinsData.length > 0) {
      // Combine contamination data from both collections
      const allContaminations = [
        ...binsWithContamination.map(b => b.contamination),
        ...problemBinsData.map(b => b.contamination)
      ].filter(c => c > 0);

      if (allContaminations.length > 0) {
        avgContamination = (allContaminations.reduce((sum, c) => sum + c, 0) / allContaminations.length).toFixed(1);
        contaminationDelta = 'Based on reported bins';
      }
    }

    // Count overflow reports today
    const overflowReports = await FullnessReport.countDocuments({
      level: 'Overflowing',
      createdAt: { $gte: todayStart }
    });

    // Update or create overview stats
    await OverviewStat.findOneAndUpdate(
      { statId: 'scansToday' },
      {
        label: 'Scans Today',
        value: scansToday,
        delta: scansDelta
      },
      { upsert: true, new: true }
    );

    await OverviewStat.findOneAndUpdate(
      { statId: 'avgContamination' },
      {
        label: 'Avg Contamination',
        value: parseFloat(avgContamination),
        delta: contaminationDelta
      },
      { upsert: true, new: true }
    );

    await OverviewStat.findOneAndUpdate(
      { statId: 'binsOver80' },
      {
        label: 'Bins > 80% Full',
        value: fullBins,
        delta: fullBins > 0 ? 'Require attention' : 'All good'
      },
      { upsert: true, new: true }
    );

    await OverviewStat.findOneAndUpdate(
      { statId: 'overflowReports' },
      {
        label: 'Overflow Reports',
        value: overflowReports,
        delta: 'Today'
      },
      { upsert: true, new: true }
    );

    console.log(`✓ Statistics updated: ${scansToday} scans, ${fullBins} full bins, ${overflowReports} overflows`);
  } catch (err) {
    console.error('Error updating statistics:', err);
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Get current station
app.get('/api/station/current', async (req, res) => {
  try {
    const station = await Station.findOne().lean();
    if (!station) {
      return res.status(404).json({ message: 'Station not found' });
    }
    res.json(station);
  } catch (err) {
    console.error('Error in /api/station/current:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get nearby bins
app.get('/api/bins/nearby', async (req, res) => {
  try {
    const bins = await Bin.find().sort({ distance: 1 }).lean();
    res.json(bins);
  } catch (err) {
    console.error('Error in /api/bins/nearby:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get admin overview stats
app.get('/api/admin/overview', async (req, res) => {
  try {
    // Always calculate fresh statistics
    await updateBinStatistics();

    const stats = await OverviewStat.find().sort({ statId: 1 }).lean();

    // If no stats exist yet, create default ones
    if (stats.length === 0) {
      const defaultStats = [
        { statId: 'scansToday', label: 'Scans Today', value: 0, delta: 'No data yet' },
        { statId: 'avgContamination', label: 'Avg Contamination', value: 0, delta: 'No data yet' },
        { statId: 'binsOver80', label: 'Bins > 80% Full', value: 0, delta: 'All good' },
        { statId: 'overflowReports', label: 'Overflow Reports', value: 0, delta: 'Today' }
      ];

      for (const stat of defaultStats) {
        await OverviewStat.create(stat);
      }

      const newStats = await OverviewStat.find().sort({ statId: 1 }).lean();
      return res.json(newStats);
    }

    res.json(stats);
  } catch (err) {
    console.error('Error in /api/admin/overview:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get problem bins
app.get('/api/admin/problem-bins', async (req, res) => {
  try {
    // First, check for bins with high contamination in ProblemBin collection
    let problemBins = await ProblemBin.find().sort({ contamination: -1 }).lean();

    // Also check regular bins for high fullness or issues
    const criticalBins = await Bin.find({
      $or: [
        { fullness: { $gte: 80 } },
        { level: 'Critical' },
        { contamination: { $gte: 5 } }
      ]
    }).lean();

    // Merge and deduplicate problem bins
    const binMap = new Map();

    // Add existing problem bins
    problemBins.forEach(bin => {
      binMap.set(bin.name, bin);
    });

    // Add or update with critical bins
    criticalBins.forEach(bin => {
      if (!binMap.has(bin.name)) {
        // Create problem bin entry from regular bin
        binMap.set(bin.name, {
          _id: bin._id,
          name: bin.name,
          contamination: bin.contamination || 0,
          location: bin.location || bin.building || 'Unknown',
          qrCode: bin.qrCode || `QR-${bin._id}`,
          totalScansToday: 0,
          avgFillLast7Days: bin.fullness || 0,
          overflowsThisMonth: 0
        });
      }
    });

    // Convert map back to array and sort by contamination/criticality
    const allProblemBins = Array.from(binMap.values())
      .sort((a, b) => b.contamination - a.contamination);

    res.json(allProblemBins);
  } catch (err) {
    console.error('Error in /api/admin/problem-bins:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student impact
app.get('/api/student/impact', async (req, res) => {
  try {
    let impact = await StudentImpact.findOne({ userId: 'demoStudent' }).lean();

    // If no impact found, return zeros
    if (!impact) {
      impact = {
        userId: 'demoStudent',
        compost: 0,
        recycle: 0,
        landfill: 0
      };
    }

    res.json(impact);
  } catch (err) {
    console.error('Error in /api/student/impact:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student impact (after sorting items)
app.post('/api/student/impact', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    // Count items by stream
    const counts = {
      compost: 0,
      recycle: 0,
      landfill: 0
    };

    items.forEach(item => {
      if (counts.hasOwnProperty(item.stream)) {
        counts[item.stream]++;
      }
    });

    // Update the student impact
    const impact = await StudentImpact.findOneAndUpdate(
      { userId: 'demoStudent' },
      {
        $inc: {
          compost: counts.compost,
          recycle: counts.recycle,
          landfill: counts.landfill
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    res.json(impact);
  } catch (err) {
    console.error('Error in POST /api/student/impact:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Segment image endpoint (returns mock data until AI integration)
app.post('/api/segment', (req, res) => {
  try {
    // Pool of possible items for more variety
    const itemPool = [
      // Compost items
      { label: 'Apple core', stream: 'compost' },
      { label: 'Banana peel', stream: 'compost' },
      { label: 'Orange peel', stream: 'compost' },
      { label: 'Paper napkin', stream: 'compost' },
      { label: 'Food scraps', stream: 'compost' },
      { label: 'Coffee grounds', stream: 'compost' },
      { label: 'Tea bag', stream: 'compost' },
      { label: 'Eggshells', stream: 'compost' },
      { label: 'Paper towel', stream: 'compost' },
      { label: 'Pizza crust', stream: 'compost' },

      // Recycle items
      { label: 'Aluminum can', stream: 'recycle' },
      { label: 'Plastic water bottle', stream: 'recycle' },
      { label: 'Cardboard box', stream: 'recycle' },
      { label: 'Glass bottle', stream: 'recycle' },
      { label: 'Paper', stream: 'recycle' },
      { label: 'Newspaper', stream: 'recycle' },
      { label: 'Plastic container', stream: 'recycle' },
      { label: 'Milk carton', stream: 'recycle' },
      { label: 'Soda can', stream: 'recycle' },
      { label: 'Magazine', stream: 'recycle' },

      // Landfill items
      { label: 'Chip bag', stream: 'landfill' },
      { label: 'Plastic wrapper', stream: 'landfill' },
      { label: 'Styrofoam cup', stream: 'landfill' },
      { label: 'Plastic straw', stream: 'landfill' },
      { label: 'Candy wrapper', stream: 'landfill' },
      { label: 'Disposable mask', stream: 'landfill' },
      { label: 'Cigarette butt', stream: 'landfill' },
      { label: 'Plastic utensils', stream: 'landfill' },
      { label: 'Paper cup (lined)', stream: 'landfill' },
      { label: 'Broken pen', stream: 'landfill' }
    ];

    // Generate random number of items (3-7)
    const numItems = Math.floor(Math.random() * 5) + 3;

    // Randomly select items without duplicates
    const shuffled = [...itemPool].sort(() => 0.5 - Math.random());
    const selectedItems = shuffled.slice(0, numItems);

    // Add unique IDs to each item
    const items = selectedItems.map((item, index) => ({
      id: `${Date.now()}-${index}`,
      label: item.label,
      stream: item.stream
    }));

    // Log the segmentation request for statistics
    console.log(`Segmentation requested: ${items.length} items detected`);

    // Simulate processing delay
    setTimeout(() => {
      res.json(items);
    }, 500);
  } catch (err) {
    console.error('Error in /api/segment:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Report bin fullness
app.post('/api/bins/report-fullness', async (req, res) => {
  try {
    const { stationId, level, binId } = req.body;

    if (!level) {
      return res.status(400).json({ message: 'Level is required' });
    }

    // Validate level
    const validLevels = ['Empty', '1/4 Full', 'Half Full', '3/4 Full', 'Full', 'Overflowing'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ message: 'Invalid level' });
    }

    // Create fullness report
    const report = await FullnessReport.create({
      station: stationId || undefined,
      level,
      createdAt: new Date()
    });

    // Update bin fullness if binId provided
    if (binId) {
      const fullnessMap = {
        'Empty': 0,
        '1/4 Full': 25,
        'Half Full': 50,
        '3/4 Full': 75,
        'Full': 90,
        'Overflowing': 100
      };

      const levelMap = {
        'Empty': 'Good',
        '1/4 Full': 'Good',
        'Half Full': 'Good',
        '3/4 Full': 'Warning',
        'Full': 'Critical',
        'Overflowing': 'Critical'
      };

      await Bin.findByIdAndUpdate(binId, {
        fullness: fullnessMap[level],
        level: levelMap[level],
        lastReported: new Date()
      });
    }

    // Update statistics
    await updateBinStatistics();

    res.json({
      ok: true,
      id: report._id.toString(),
      message: 'Fullness report submitted successfully'
    });
  } catch (err) {
    console.error('Error in /api/bins/report-fullness:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// API endpoint for UCLA facilities management to update bin locations
app.post('/api/facilities/update-bins', async (req, res) => {
  try {
    const { bins } = req.body;

    if (!bins || !Array.isArray(bins)) {
      return res.status(400).json({ message: 'Bins array is required' });
    }

    // Process facility data using integration service
    const result = await FacilitiesIntegration.processFacilityData(bins);

    res.json({
      ok: true,
      created: result.created,
      updated: result.updated,
      processed: result.processed.length,
      errors: result.errors.length,
      message: `Created ${result.created} bins, updated ${result.updated} bins`,
      details: result
    });
  } catch (err) {
    console.error('Error in /api/facilities/update-bins:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Sync contamination data from facilities
app.post('/api/facilities/sync-contamination', async (req, res) => {
  try {
    const { contaminationData } = req.body;

    if (!contaminationData || !Array.isArray(contaminationData)) {
      return res.status(400).json({ message: 'Contamination data array is required' });
    }

    await FacilitiesIntegration.syncContaminationData(contaminationData);

    res.json({
      ok: true,
      message: `Processed ${contaminationData.length} contamination reports`
    });
  } catch (err) {
    console.error('Error syncing contamination:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get facility report
app.get('/api/facilities/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const report = await FacilitiesIntegration.generateFacilityReport(start, end);

    res.json(report);
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bin statistics for a specific bin
app.get('/api/bins/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const bin = await Bin.findById(id);
    if (!bin) {
      return res.status(404).json({ message: 'Bin not found' });
    }

    // Calculate real-time statistics
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(now.setDate(now.getDate() - 7));
    const monthAgo = new Date(now.setMonth(now.getMonth() - 1));

    // Get reports for this specific bin
    const todayReports = await FullnessReport.countDocuments({
      station: bin._id,
      createdAt: { $gte: todayStart }
    });

    const weekReports = await FullnessReport.find({
      station: bin._id,
      createdAt: { $gte: weekAgo }
    });

    const overflowReports = await FullnessReport.countDocuments({
      station: bin._id,
      level: 'Overflowing',
      createdAt: { $gte: monthAgo }
    });

    // Calculate average fullness
    const avgFullness = weekReports.length > 0
      ? weekReports.reduce((sum, report) => {
        const fullnessMap = {
          'Empty': 0, '1/4 Full': 25, 'Half Full': 50,
          '3/4 Full': 75, 'Full': 90, 'Overflowing': 100
        };
        return sum + (fullnessMap[report.level] || 0);
      }, 0) / weekReports.length
      : 0;

    res.json({
      binId: bin._id,
      name: bin.name,
      currentFullness: bin.fullness,
      todayReports,
      avgFullnessLastWeek: Math.round(avgFullness),
      overflowsThisMonth: overflowReports,
      lastReported: bin.lastReported || null
    });
  } catch (err) {
    console.error('Error getting bin stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new bin
app.post('/api/bin', async (req, res) => {
  try {
    const {
      name,
      facilityId,
      qrCode,
      location,
      building,
      floor,
      streams,
      description,
      latitude,
      longitude
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Bin name is required' });
    }

    // Validate latitude/longitude if provided
    if (latitude !== undefined && latitude !== null) {
      if (typeof latitude !== 'number' || Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
        return res.status(400).json({ message: 'Invalid latitude' });
      }
    }
    if (longitude !== undefined && longitude !== null) {
      if (typeof longitude !== 'number' || Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
        return res.status(400).json({ message: 'Invalid longitude' });
      }
    }

    // Optional: Check for duplicates
    const duplicateQuery = [];
    if (facilityId) duplicateQuery.push({ facilityId });
    if (qrCode) duplicateQuery.push({ qrCode });

    if (duplicateQuery.length > 0) {
      const existing = await Bin.findOne({ $or: duplicateQuery }).lean();
      if (existing) {
        return res.status(409).json({
          message: 'A bin with this facilityId or qrCode already exists.',
          binId: existing._id
        });
      }
    }

    // Create the bin
    const bin = await Bin.create({
      name,
      facilityId: facilityId || null,
      qrCode: qrCode || null,
      location: location || '',
      building: building || '',
      floor: floor || '',
      streams: streams || [],
      description: description || '',
      latitude: latitude !== undefined ? latitude : null,
      longitude: longitude !== undefined ? longitude : null
    });

    res.status(201).json({
      ok: true,
      message: 'Bin created successfully',
      bin
    });

  } catch (err) {
    console.error('Error creating bin:', err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: 'facilityId or qrCode must be unique',
        keyValue: err.keyValue
      });
    }

    res.status(500).json({ message: 'Server error' });
  }
});


// 404 handler for undefined routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Connect to MongoDB and start server
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(async () => {
    console.log('✓ Connected to MongoDB');

    // Initialize database with minimal setup
    await initializeDatabase();

    // Update statistics on startup
    await updateBinStatistics();

    // Update statistics every 5 minutes
    setInterval(updateBinStatistics, 5 * 60 * 1000);

    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server listening on port ${PORT}`);
      console.log(`  API: http://localhost:${PORT}/api`);
      console.log(`  Health check: http://localhost:${PORT}/api/health`);
      console.log(`  Ready for UCLA Facilities Management integration`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.error('Please check your MONGODB_URI in the .env file');
    process.exit(1);
  });
