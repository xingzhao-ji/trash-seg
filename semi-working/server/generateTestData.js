#!/usr/bin/env node

/**
 * Test Data Generator for Zero Waste Bin System
 * 
 * This script generates realistic test data for development and testing
 * Usage: node generateTestData.js [options]
 * 
 * Options:
 *   --reports <number>  Number of fullness reports to generate (default: 100)
 *   --days <number>     Number of days to spread reports over (default: 7)
 *   --bins <number>     Number of bins to create (default: 10)
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Bin = require('./models/Bin');
const FullnessReport = require('./models/FullnessReport');
const StudentImpact = require('./models/StudentImpact');
const ProblemBin = require('./models/ProblemBin');

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  reports: 100,
  days: 7,
  bins: 10
};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = parseInt(args[i + 1]);
  if (key in options && !isNaN(value)) {
    options[key] = value;
  }
}

// UCLA campus locations for realistic data
const uclaLocations = [
  { building: 'Ackerman Union', floor: 'Level 1', lat: 34.070266, lng: -118.444183 },
  { building: 'Powell Library', floor: '1st Floor', lat: 34.071518, lng: -118.442181 },
  { building: 'Engineering VI', floor: 'Ground Floor', lat: 34.068930, lng: -118.443650 },
  { building: 'Court of Sciences', floor: 'Ground', lat: 34.069580, lng: -118.441920 },
  { building: 'Bruin Plate', floor: '1st Floor', lat: 34.071950, lng: -118.449820 },
  { building: 'De Neve Plaza', floor: 'Ground', lat: 34.070450, lng: -118.450120 },
  { building: 'Young Hall', floor: '1st Floor', lat: 34.069120, lng: -118.441500 },
  { building: 'Royce Hall', floor: 'Ground', lat: 34.073150, lng: -118.442280 },
  { building: 'Mathematical Sciences', floor: 'Ground Floor', lat: 34.069880, lng: -118.442950 },
  { building: 'Boelter Hall', floor: '1st Floor', lat: 34.069350, lng: -118.443120 },
  { building: 'Murphy Hall', floor: 'Lobby', lat: 34.071120, lng: -118.443890 },
  { building: 'Bunche Hall', floor: '1st Floor', lat: 34.074520, lng: -118.441230 },
  { building: 'Moore Hall', floor: 'Ground', lat: 34.070890, lng: -118.444560 },
  { building: 'Haines Hall', floor: 'Ground Floor', lat: 34.073450, lng: -118.442780 },
  { building: 'Dodd Hall', floor: '1st Floor', lat: 34.072230, lng: -118.443120 }
];

async function generateTestData() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      console.error('MONGODB_URI not found in .env file');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected to MongoDB');

    // Clear existing test data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing test data...');
    await FullnessReport.deleteMany({});
    await Bin.deleteMany({});
    await ProblemBin.deleteMany({});
    console.log('✓ Cleared existing data');

    // Generate bins
    console.log(`\nGenerating ${options.bins} bins...`);
    const bins = [];
    
    for (let i = 0; i < options.bins && i < uclaLocations.length; i++) {
      const location = uclaLocations[i];
      const binType = ['standard', 'smart', 'compactor'][Math.floor(Math.random() * 3)];
      const streams = Math.random() > 0.3 
        ? ['compost', 'recycle', 'landfill']
        : ['recycle', 'landfill'];
      
      const bin = await Bin.create({
        name: `${location.building} — ${['Main', 'North', 'South', 'East', 'West'][Math.floor(Math.random() * 5)]}`,
        facilityId: `UCLA-BIN-${String(i + 1).padStart(3, '0')}`,
        qrCode: `QR-${location.building.substring(0, 2).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
        building: location.building,
        floor: location.floor,
        latitude: location.lat,
        longitude: location.lng,
        streams: streams,
        capacity: 40 + Math.floor(Math.random() * 40),
        type: binType,
        fullness: Math.floor(Math.random() * 100),
        level: 'Good',
        contamination: Math.random() * 15,
        active: true
      });
      
      bins.push(bin);
      console.log(`  ✓ Created bin: ${bin.name}`);
    }

    // Generate fullness reports
    console.log(`\nGenerating ${options.reports} fullness reports over ${options.days} days...`);
    const levels = ['Empty', '1/4 Full', 'Half Full', '3/4 Full', 'Full', 'Overflowing'];
    const levelWeights = [0.05, 0.15, 0.35, 0.25, 0.15, 0.05]; // Realistic distribution
    
    for (let i = 0; i < options.reports; i++) {
      // Random bin
      const bin = bins[Math.floor(Math.random() * bins.length)];
      
      // Random date within the specified range
      const daysAgo = Math.random() * options.days;
      const reportDate = new Date();
      reportDate.setDate(reportDate.getDate() - daysAgo);
      
      // Weighted random level selection
      const rand = Math.random();
      let cumWeight = 0;
      let selectedLevel = levels[0];
      for (let j = 0; j < levels.length; j++) {
        cumWeight += levelWeights[j];
        if (rand < cumWeight) {
          selectedLevel = levels[j];
          break;
        }
      }
      
      await FullnessReport.create({
        station: bin._id,
        level: selectedLevel,
        createdAt: reportDate,
        reportedBy: `testUser${Math.floor(Math.random() * 20)}`
      });
    }
    
    console.log(`  ✓ Created ${options.reports} fullness reports`);

    // Update bin fullness based on most recent reports
    console.log('\nUpdating bin fullness levels...');
    for (const bin of bins) {
      const latestReport = await FullnessReport.findOne({ station: bin._id })
        .sort({ createdAt: -1 });
      
      if (latestReport) {
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
        
        await Bin.findByIdAndUpdate(bin._id, {
          fullness: fullnessMap[latestReport.level],
          level: levelMap[latestReport.level]
        });
      }
    }
    console.log('  ✓ Updated bin fullness levels');

    // Create some problem bins
    console.log('\nIdentifying problem bins...');
    const highContaminationBins = bins
      .filter(bin => bin.contamination > 5)
      .slice(0, 5);
    
    for (const bin of highContaminationBins) {
      await ProblemBin.create({
        name: bin.name,
        contamination: bin.contamination,
        location: bin.building,
        qrCode: bin.qrCode,
        totalScansToday: Math.floor(Math.random() * 200) + 50,
        avgFillLast7Days: Math.floor(Math.random() * 40) + 60,
        overflowsThisMonth: Math.floor(Math.random() * 10)
      });
      console.log(`  ✓ Marked as problem bin: ${bin.name} (${bin.contamination.toFixed(1)}% contamination)`);
    }

    // Create sample student impact
    console.log('\nCreating student impact data...');
    await StudentImpact.findOneAndUpdate(
      { userId: 'demoStudent' },
      {
        compost: Math.floor(Math.random() * 50) + 10,
        recycle: Math.floor(Math.random() * 40) + 10,
        landfill: Math.floor(Math.random() * 30) + 5
      },
      { upsert: true }
    );
    console.log('  ✓ Created student impact data');

    // Summary
    console.log('\n=== Test Data Generation Complete ===');
    console.log(`✓ Created ${options.bins} bins`);
    console.log(`✓ Generated ${options.reports} fullness reports`);
    console.log(`✓ Identified ${highContaminationBins.length} problem bins`);
    console.log(`✓ Data spread over ${options.days} days`);
    
    // Calculate some statistics
    const todayReports = await FullnessReport.countDocuments({
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });
    const overflowingBins = await Bin.countDocuments({ fullness: { $gte: 80 } });
    
    console.log('\n=== Current System Stats ===');
    console.log(`Reports today: ${todayReports}`);
    console.log(`Bins over 80% full: ${overflowingBins}`);
    console.log(`Average contamination: ${(highContaminationBins.reduce((sum, b) => sum + b.contamination, 0) / highContaminationBins.length).toFixed(1)}%`);

    // Close connection
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    console.log('Test data generation complete! Your system now has realistic data.');
    
    process.exit(0);
  } catch (err) {
    console.error('Error generating test data:', err);
    process.exit(1);
  }
}

// Run the generator
console.log('Zero Waste Bin System - Test Data Generator');
console.log('============================================');
console.log(`Options: ${JSON.stringify(options)}\n`);

generateTestData();