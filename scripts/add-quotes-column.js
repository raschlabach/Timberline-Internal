const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../database/config');

// Read the SQL script
const sqlFile = path.join(__dirname, '../database/add-quotes-column.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

async function main() {
  const dbBranch = process.argv[2] || 'preview';
  
  if (!['preview', 'main'].includes(dbBranch)) {
    console.error('Invalid database branch. Use "preview" or "main".');
    process.exit(1);
  }
  
  console.log(`Using database branch: ${dbBranch}`);
  
  // Get the config for the specified branch
  const dbConfig = config[dbBranch];
  
  if (!dbConfig || !dbConfig.connectionString) {
    console.error(`Connection string for ${dbBranch} branch not found in config.js`);
    process.exit(1);
  }
  
  // Create a new pool
  const pool = new Pool({
    connectionString: dbConfig.connectionString,
    ssl: dbConfig.ssl
  });
  
  try {
    console.log('Connecting to database...');
    await pool.query('SELECT 1'); // Test connection
    console.log('Successfully connected to database');
    
    console.log('Adding quotes column to customers table...');
    await pool.query(sql);
    console.log('Successfully added quotes column');
    
  } catch (error) {
    console.error('Error executing SQL:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main(); 