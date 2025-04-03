/**
 * Script to check environment variables
 * 
 * Usage:
 *   node scripts/check-env.js
 */

const fs = require('fs');
const path = require('path');

// Load .env.local if it exists
const envPath = path.join(__dirname, '..', '.env.local');
let envContent = null;

console.log('Environment Check Report');
console.log('=======================');

// Check if .env.local exists
if (fs.existsSync(envPath)) {
  console.log('✅ .env.local file exists');
  envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check for required variables
  const requiredVars = ['NEXTAUTH_URL', 'NEXTAUTH_SECRET'];
  const missingVars = [];
  
  for (const varName of requiredVars) {
    if (!envContent.includes(varName + '=')) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.log(`❌ Missing required variables: ${missingVars.join(', ')}`);
  } else {
    console.log('✅ All required variables are present in .env.local');
  }
  
  // Extract and validate NEXTAUTH_URL
  const nextAuthUrlMatch = envContent.match(/NEXTAUTH_URL=(.+)/);
  if (nextAuthUrlMatch) {
    const url = nextAuthUrlMatch[1].trim();
    console.log(`ℹ️ NEXTAUTH_URL = ${url}`);
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.log('❌ NEXTAUTH_URL should start with http:// or https://');
    }
  }
  
  // Extract and validate NEXTAUTH_SECRET
  const nextAuthSecretMatch = envContent.match(/NEXTAUTH_SECRET=(.+)/);
  if (nextAuthSecretMatch) {
    const secret = nextAuthSecretMatch[1].trim();
    const secretMasked = secret.substring(0, 6) + '...' + secret.substring(secret.length - 6);
    console.log(`ℹ️ NEXTAUTH_SECRET = ${secretMasked}`);
    
    if (secret.length < 32) {
      console.log('❌ NEXTAUTH_SECRET should be at least 32 characters long');
    }
  }
} else {
  console.log('❌ .env.local file does not exist');
  console.log('ℹ️ You should create a .env.local file with NEXTAUTH_URL and NEXTAUTH_SECRET');
  console.log('ℹ️ You can run: node scripts/create-env.js');
}

// Check database config
const dbConfigPath = path.join(__dirname, '..', 'database', 'config.js');
if (fs.existsSync(dbConfigPath)) {
  console.log('✅ database/config.js exists');
} else {
  console.log('❌ database/config.js does not exist');
  console.log('ℹ️ You should create database/config.js from database/config.example.js');
}

// Log node environment
console.log(`ℹ️ NODE_ENV = ${process.env.NODE_ENV || 'not set (development)'}`);

console.log('\nProcess Environment Variables:');
console.log('-----------------------------');
// Log process.env variables that are safe to display
const safeEnvVars = Object.keys(process.env).filter(key => 
  !key.toLowerCase().includes('secret') && 
  !key.toLowerCase().includes('password') &&
  !key.toLowerCase().includes('token')
);

for (const key of safeEnvVars) {
  console.log(`${key} = ${process.env[key]}`);
}

console.log('\nFor a complete environment setup:');
console.log('1. Ensure .env.local contains NEXTAUTH_URL and NEXTAUTH_SECRET');
console.log('2. Ensure database/config.js is properly configured');
console.log('3. Run "npm run dev" to start the development server'); 