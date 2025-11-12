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
# Copy these from your Neon.tech dashboard and replace with your actual connection strings
DB_CONNECTION_STRING_PREVIEW=postgresql://neondb_owner:npg_D5hj1egPlAok@ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech/neondb?sslmode=require
DB_CONNECTION_STRING_MAIN=postgresql://neondb_owner:npg_D5hj1egPlAok@ep-calm-frog-a8qxyo8o-pooler.eastus2.azure.neon.tech/neondb?sslmode=require

# Google Maps API Key (for place autocomplete)
# Get this from Google Cloud Console: https://console.cloud.google.com/
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Environment
NODE_ENV=development
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log(`Created .env.local with database connection strings and NEXTAUTH_SECRET`);
    console.log(`⚠️  IMPORTANT: Update the database connection strings with your actual Neon.tech credentials`);
  }
}

// Run the script
createEnvFile(); 