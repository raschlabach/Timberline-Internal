#!/usr/bin/env node

/**
 * Comprehensive setup script for Timberline Logistics Dashboard
 * 
 * Usage:
 *   node scripts/setup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚚 Setting up Timberline Logistics Dashboard...\n');

// Check if Node.js version is sufficient
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  if (major < 18) {
    console.error('❌ Node.js 18 or higher is required. Current version:', version);
    process.exit(1);
  }
  
  console.log('✅ Node.js version:', version);
}

// Install dependencies
function installDependencies() {
  console.log('\n📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Create environment file
function createEnvironmentFile() {
  console.log('\n🔧 Setting up environment variables...');
  
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env.local already exists. Skipping environment setup.');
    return;
  }
  
  try {
    // Run the create-env script
    execSync('node scripts/create-env.js', { stdio: 'inherit' });
    console.log('✅ Environment file created');
  } catch (error) {
    console.error('❌ Failed to create environment file:', error.message);
  }
}

// Check database configuration
function checkDatabaseConfig() {
  console.log('\n🗄️  Checking database configuration...');
  
  const configPath = path.join(__dirname, '..', 'database', 'config.js');
  
  if (!fs.existsSync(configPath)) {
    console.log('⚠️  Database config not found. Please:');
    console.log('   1. Copy database/config.example.js to database/config.js');
    console.log('   2. Update with your Neon.tech credentials');
    console.log('   3. Run: npm run db:apply-preview');
  } else {
    console.log('✅ Database config found');
  }
}

// Run database migrations
function runDatabaseMigrations() {
  console.log('\n🔄 Setting up database...');
  
  try {
    console.log('Applying schema to preview database...');
    execSync('npm run db:apply-preview', { stdio: 'inherit' });
    console.log('✅ Database schema applied successfully');
  } catch (error) {
    console.log('⚠️  Database setup failed. Please check your configuration.');
    console.log('   Error:', error.message);
  }
}

// Create admin user
function createAdminUser() {
  console.log('\n👤 Creating admin user...');
  
  try {
    execSync('npm run create-admin', { stdio: 'inherit' });
    console.log('✅ Admin user created successfully');
  } catch (error) {
    console.log('⚠️  Admin user creation failed. You can create one manually later.');
    console.log('   Error:', error.message);
  }
}

// Final instructions
function showFinalInstructions() {
  console.log('\n🎉 Setup complete!');
  console.log('\n📋 Next steps:');
  console.log('   1. Update your .env.local file with your actual credentials');
  console.log('   2. Add your Google Maps API key to .env.local if needed');
  console.log('   3. Start the development server: npm run dev');
  console.log('   4. Open http://localhost:3000 in your browser');
  console.log('\n🔧 Available commands:');
  console.log('   npm run dev          - Start development server');
  console.log('   npm run build        - Build for production');
  console.log('   npm run db:apply-preview - Apply schema to preview DB');
  console.log('   npm run db:apply-main    - Apply schema to main DB');
  console.log('   npm run create-admin     - Create admin user');
  console.log('\n📚 Documentation:');
  console.log('   - README.md for project overview');
  console.log('   - database/README.md for database setup');
  console.log('\n🚨 Important:');
  console.log('   - Never commit .env.local or database/config.js to version control');
  console.log('   - Use preview database for development, main for production');
}

// Main setup function
async function main() {
  try {
    checkNodeVersion();
    installDependencies();
    createEnvironmentFile();
    checkDatabaseConfig();
    runDatabaseMigrations();
    createAdminUser();
    showFinalInstructions();
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
main();
