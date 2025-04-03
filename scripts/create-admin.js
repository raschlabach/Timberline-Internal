/**
 * Script to create an admin user in the database
 * 
 * Usage:
 *   node scripts/create-admin.js [branch]
 * 
 * Where [branch] is either 'preview' or 'main' (defaults to 'preview')
 */

const { hash } = require('bcryptjs');
const readline = require('readline');
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

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createUser() {
  try {
    // Get user input
    const username = await question('Username: ');
    const password = await question('Password: ');
    const fullName = await question('Full Name: ');
    const email = await question('Email: ');
    
    // Hash the password
    const passwordHash = await hash(password, 10);
    
    // Connect to the database
    const pool = new Pool(config[branch]);
    
    // Check if user already exists
    const checkResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (checkResult.rowCount > 0) {
      console.log(`User '${username}' already exists. Updating...`);
      
      // Update existing user
      await pool.query(
        'UPDATE users SET password_hash = $1, full_name = $2, email = $3, role = $4, is_active = TRUE WHERE username = $5',
        [passwordHash, fullName, email, 'admin', username]
      );
      
      console.log(`User '${username}' updated successfully.`);
    } else {
      // Insert new user
      await pool.query(
        'INSERT INTO users (username, password_hash, full_name, email, role, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
        [username, passwordHash, fullName, email, 'admin', true]
      );
      
      console.log(`Admin user '${username}' created successfully.`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    rl.close();
  }
}

// Helper function for prompting questions
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Run the script
console.log(`Creating admin user in the ${branch.toUpperCase()} database branch...`);
createUser(); 