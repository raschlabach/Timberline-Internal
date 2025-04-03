/**
 * Script to apply the database schema to Neon.tech using Node.js (no psql required)
 * 
 * Usage:
 *   node apply-schema-node.js [branch]
 * 
 * Where [branch] is either 'preview' or 'main' (defaults to 'preview')
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');

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
rl.question(`You are about to apply migrations to the ${branch.toUpperCase()} database branch. Are you sure? (y/N) `, async (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('Operation cancelled');
    rl.close();
    process.exit(0);
  }
  
  // Get the connection config
  const connectionConfig = config[branch];
  
  if (!connectionConfig || !connectionConfig.connectionString) {
    console.error(`Error: Connection string for "${branch}" branch not found in config.js`);
    rl.close();
    process.exit(1);
  }
  
  console.log(`Applying migrations to ${branch} branch...`);
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '20240328_fix_layout_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Connect to the database
    const client = new Client(connectionConfig);
    await client.connect();
    
    console.log('Connected to database. Executing migration...');
    
    try {
      // Execute the migration SQL
      await client.query(migrationSQL);
      console.log('Migration applied successfully!');
    } catch (error) {
      console.error('Error executing SQL:', error.message);
    } finally {
      // Always close the client
      await client.end();
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  rl.close();
}); 