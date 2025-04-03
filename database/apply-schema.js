/**
 * Script to apply the database schema to Neon.tech
 * 
 * Usage:
 *   node apply-schema.js [branch]
 * 
 * Where [branch] is either 'preview' or 'main' (defaults to 'preview')
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Check if config.js exists
if (!fs.existsSync(path.join(__dirname, 'config.js'))) {
  console.error('Error: config.js not found. Please copy config.example.js to config.js and update with your database credentials.');
  process.exit(1);
}

// Import configuration
const config = require('./config');

// Determine which branch to use
const branch = process.argv[2] || 'preview';
if (!['preview', 'main'].includes(branch)) {
  console.error('Error: Branch must be either "preview" or "main"');
  process.exit(1);
}

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for confirmation, especially important for main branch
rl.question(`You are about to apply the schema to the ${branch.toUpperCase()} database branch. Are you sure? (y/N) `, (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('Operation cancelled');
    rl.close();
    process.exit(0);
  }
  
  // Get the connection string
  const connectionString = config[branch].connectionString;
  
  if (!connectionString) {
    console.error(`Error: Connection string for "${branch}" branch not found in config.js`);
    rl.close();
    process.exit(1);
  }
  
  console.log(`Applying schema to ${branch} branch...`);
  
  try {
    // Check if psql is installed
    try {
      execSync('psql --version', { stdio: 'ignore' });
    } catch (error) {
      console.error('Error: psql command not found. Please install PostgreSQL client tools.');
      rl.close();
      process.exit(1);
    }
    
    // Apply the schema using psql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const command = `psql "${connectionString}" -f "${schemaPath}"`;
    
    console.log('Executing SQL script...');
    execSync(command, { stdio: 'inherit' });
    
    console.log('Schema applied successfully!');
  } catch (error) {
    console.error('Error applying schema:', error.message);
  }
  
  rl.close();
}); 