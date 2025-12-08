#!/usr/bin/env node

/**
 * UCLA Facilities Data Import Script
 * 
 * This script helps import bin location data from UCLA Facilities Management
 * Usage: node importFacilityData.js <json-file>
 * 
 * Expected JSON format:
 * {
 *   "bins": [
 *     {
 *       "facilityId": "UCLA-BIN-001",
 *       "name": "Ackerman Union - Food Court",
 *       "building": "Ackerman Union",
 *       "floor": "Level 1",
 *       "latitude": 34.070266,
 *       "longitude": -118.444183,
 *       "streams": ["compost", "recycle", "landfill"],
 *       "capacity": 50,
 *       "type": "standard"
 *     }
 *   ]
 * }
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
const FacilitiesIntegration = require('./services/facilitiesIntegration');

// Load environment variables
dotenv.config();

async function importData() {
  try {
    // Get file path from command line
    const filePath = process.argv[2];
    
    if (!filePath) {
      console.error('Usage: node importFacilityData.js <json-file>');
      console.error('Example: node importFacilityData.js ucla_bins.json');
      process.exit(1);
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    // Read and parse JSON file
    console.log(`Reading file: ${filePath}`);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    if (!data.bins || !Array.isArray(data.bins)) {
      console.error('Invalid file format. Expected { "bins": [...] }');
      process.exit(1);
    }

    console.log(`Found ${data.bins.length} bins to import`);

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

    // Process the data
    console.log('Processing facility data...');
    const result = await FacilitiesIntegration.processFacilityData(data.bins);

    // Display results
    console.log('\n=== Import Results ===');
    console.log(`✓ Created: ${result.created} new bins`);
    console.log(`✓ Updated: ${result.updated} existing bins`);
    console.log(`✓ Total processed: ${result.processed.length}`);
    
    if (result.errors.length > 0) {
      console.log(`✗ Errors: ${result.errors.length}`);
      console.log('\nError details:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.bin.name || error.bin.facilityId}: ${error.error}`);
      });
    }

    // Generate import report
    const reportPath = `import_report_${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(`\n✓ Import report saved to: ${reportPath}`);

    // Close database connection
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
    
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}

// Run import
importData();