/**
 * Script to check if admin users exist in the database
 * 
 * Usage:
 *   node scripts/check-user.js [branch]
 * 
 * Where:
 *   [branch] is either 'preview' or 'main' (defaults to 'preview')
 */

const { Pool } = require('pg');

// Load database config
let config;
try {
  config = require('../database/config');
} catch (error) {
  console.error('Database config not found. Please create a config.js file based on config.example.js');
  process.exit(1);
}

// Determine which branch to use
const branch = process.argv[2] || 'preview';
if (!['preview', 'main'].includes(branch)) {
  console.error('Error: Branch must be either "preview" or "main"');
  process.exit(1);
}

// Connect to the database
const pool = new Pool(config[branch]);

async function checkUsers() {
  try {
    console.log(`Checking users in ${branch.toUpperCase()} database...`);
    
    // Get all users
    const result = await pool.query(
      'SELECT id, username, full_name, email, role, is_active FROM users'
    );
    
    if (result.rows.length === 0) {
      console.log('No users found in the database.');
      console.log('You should run: npm run create-admin');
    } else {
      console.log(`Found ${result.rows.length} users:`);
      console.table(result.rows);
    }
    
    // Test database connection
    const connTest = await pool.query('SELECT NOW()');
    console.log('Database connection test:', connTest.rows[0].now);
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkUsers(); 