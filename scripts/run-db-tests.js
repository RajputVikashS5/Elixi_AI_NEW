#!/usr/bin/env node

// Quick test runner for database connections
const { execSync } = require('child_process');
const path = require('path');

console.log('Setting up environment...');

try {
  // Navigate to backend and run the test
  process.chdir(path.join(__dirname, '..', 'backend'));
  
  console.log('Installing dependencies if needed...');
  try {
    execSync('npm list ts-node', { stdio: 'ignore' });
  } catch (e) {
    console.log('Installing ts-node...');
    execSync('npm install --save-dev ts-node', { stdio: 'inherit' });
  }
  
  console.log('Running database connection tests...\n');
  execSync('npx ts-node ../scripts/test-db-connections.ts', { stdio: 'inherit' });
} catch (error) {
  console.error('Test execution failed:', error.message);
  process.exit(1);
}
