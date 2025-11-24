#!/usr/bin/env node

/**
 * Setup and Diagnostic Script for Zero Waste Bin System
 * 
 * This script checks your setup and helps diagnose connection issues
 * Usage: node checkSetup.js
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

async function checkEnvFile() {
  log('\n1. Checking .env file...', colors.blue);
  
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  try {
    await fs.access(envPath);
    log('✓ .env file exists', colors.green);
    
    const content = await fs.readFile(envPath, 'utf8');
    if (content.includes('MONGODB_URI=')) {
      if (content.includes('your-username') || content.includes('your-password')) {
        log('✗ .env file contains placeholder values. Please update with your MongoDB credentials.', colors.red);
        return false;
      }
      log('✓ MongoDB URI is configured', colors.green);
      return true;
    } else {
      log('✗ MongoDB URI not found in .env file', colors.red);
      return false;
    }
  } catch (err) {
    log('✗ .env file not found', colors.red);
    
    try {
      await fs.access(envExamplePath);
      log('  Creating .env from .env.example...', colors.yellow);
      await fs.copyFile(envExamplePath, envPath);
      log('  ✓ Created .env file. Please update it with your MongoDB credentials.', colors.yellow);
    } catch (copyErr) {
      log('  ✗ Could not create .env file', colors.red);
    }
    return false;
  }
}

async function checkNodeModules() {
  log('\n2. Checking dependencies...', colors.blue);
  
  try {
    await fs.access(path.join(__dirname, 'node_modules'));
    log('✓ node_modules exists', colors.green);
    return true;
  } catch (err) {
    log('✗ node_modules not found', colors.red);
    log('  Run: npm install', colors.yellow);
    return false;
  }
}

async function checkMongoDB() {
  log('\n3. Testing MongoDB connection...', colors.blue);
  
  try {
    const mongoose = require('mongoose');
    const dotenv = require('dotenv');
    dotenv.config();
    
    if (!process.env.MONGODB_URI) {
      log('✗ MONGODB_URI not set in environment', colors.red);
      return false;
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    log('✓ Successfully connected to MongoDB', colors.green);
    await mongoose.connection.close();
    return true;
  } catch (err) {
    log('✗ Failed to connect to MongoDB', colors.red);
    log(`  Error: ${err.message}`, colors.yellow);
    log('  Please check your MongoDB URI and ensure MongoDB is running', colors.yellow);
    return false;
  }
}

async function checkPort(port = 5000) {
  log(`\n4. Checking if port ${port} is available...`, colors.blue);
  
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        log(`✗ Port ${port} is already in use`, colors.red);
        log('  Another instance might be running or another app is using this port', colors.yellow);
        resolve(false);
      } else {
        log(`✗ Error checking port: ${err.message}`, colors.red);
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      log(`✓ Port ${port} is available`, colors.green);
      server.close();
      resolve(true);
    });
    
    server.listen(port, '0.0.0.0');
  });
}

async function testServerEndpoint() {
  log('\n5. Testing server endpoint...', colors.blue);
  
  try {
    const http = require('http');
    
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/health',
        method: 'GET',
        timeout: 3000
      };
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          log('✓ Server is responding at http://localhost:5000/api/health', colors.green);
          resolve(true);
        } else {
          log(`✗ Server returned status ${res.statusCode}`, colors.red);
          resolve(false);
        }
      });
      
      req.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
          log('✗ Server is not running on port 5000', colors.red);
          log('  Run: npm start', colors.yellow);
        } else {
          log(`✗ Error connecting to server: ${err.message}`, colors.red);
        }
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        log('✗ Server request timed out', colors.red);
        resolve(false);
      });
      
      req.end();
    });
  } catch (err) {
    log(`✗ Error testing server: ${err.message}`, colors.red);
    return false;
  }
}

async function main() {
  log('Zero Waste Bin System - Setup Diagnostics', colors.blue);
  log('=========================================', colors.blue);
  
  let allGood = true;
  
  // Check each requirement
  const hasEnv = await checkEnvFile();
  allGood = allGood && hasEnv;
  
  const hasModules = await checkNodeModules();
  allGood = allGood && hasModules;
  
  if (hasEnv && hasModules) {
    const mongoConnects = await checkMongoDB();
    allGood = allGood && mongoConnects;
    
    const serverRunning = await testServerEndpoint();
    if (!serverRunning) {
      const portAvailable = await checkPort(5000);
      if (portAvailable) {
        log('\n  The server is not running but the port is available.', colors.yellow);
        log('  Start the server with: npm start', colors.yellow);
      }
    }
  }
  
  // Summary
  log('\n=========================================', colors.blue);
  if (allGood) {
    log('✓ All checks passed! Your system is ready.', colors.green);
    log('\nTo start the server:', colors.blue);
    log('  npm start', colors.yellow);
    log('\nTo generate test data:', colors.blue);
    log('  node generateTestData.js', colors.yellow);
    log('\nTo import UCLA bin locations:', colors.blue);
    log('  node importFacilityData.js ucla_bins_sample.json', colors.yellow);
  } else {
    log('✗ Some issues were found. Please fix them and run this script again.', colors.red);
    log('\nQuick fix commands:', colors.blue);
    
    if (!hasModules) {
      log('  npm install                    # Install dependencies', colors.yellow);
    }
    if (!hasEnv) {
      log('  cp .env.example .env           # Create .env file', colors.yellow);
      log('  # Then edit .env and add your MongoDB URI', colors.yellow);
    }
  }
  
  log('\nFor more help, check the README.md file.', colors.blue);
}

// Run the diagnostic
main().catch(err => {
  log(`\nUnexpected error: ${err.message}`, colors.red);
  process.exit(1);
});