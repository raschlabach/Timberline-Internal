/**
 * Script to generate a .env.local file with necessary environment variables
 * 
 * Usage:
 *   node scripts/create-env.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a random secret key
const generateSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Main function
function createEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  
  // Check if .env.local already exists
  if (fs.existsSync(envPath)) {
    console.log('.env.local already exists. Do you want to overwrite it? (y/N)');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('', (answer) => {
      if (answer.toLowerCase() !== 'y') {
        console.log('Operation cancelled');
        rl.close();
        return;
      }
      
      writeEnvFile();
      rl.close();
    });
  } else {
    writeEnvFile();
  }
  
  function writeEnvFile() {
    const secret = generateSecret();
    
    const envContent = `# Generated on ${new Date().toISOString()}
# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${secret}

# Database Configuration
# These are loaded from database/config.js, but could also be set here
# DB_CONNECTION_STRING_PREVIEW=postgres://user:password@hostname:port/dbname
# DB_CONNECTION_STRING_MAIN=postgres://user:password@hostname:port/dbname

# Google Maps API Key (for place autocomplete)
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log(`Created .env.local with a new NEXTAUTH_SECRET`);
  }
}

// Run the script
createEnvFile(); 