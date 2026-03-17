/**
 * Script to create the grain operator user
 * 
 * Usage:
 *   node scripts/create-grain-user.js [branch]
 * 
 * Where [branch] is either 'preview' or 'main' (defaults to 'preview')
 */

const { hash } = require('bcryptjs');
const { Pool } = require('pg');

let config;
try {
  config = require('../database/config');
} catch (error) {
  console.error('Database config not found. Please create a config.js file based on config.example.js');
  process.exit(1);
}

const branch = process.argv[2] || 'preview';
if (!['preview', 'main'].includes(branch)) {
  console.error('Error: Branch must be either "preview" or "main"');
  process.exit(1);
}

async function createGrainUser() {
  const username = 'Rodene';
  const password = 'GrainTracker';
  const fullName = 'Rodene';
  const role = 'grain_operator';

  try {
    const passwordHash = await hash(password, 10);
    const pool = new Pool(config[branch]);

    const checkResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (checkResult.rowCount > 0) {
      console.log(`User '${username}' already exists. Updating...`);
      await pool.query(
        'UPDATE users SET password_hash = $1, full_name = $2, role = $3, is_active = TRUE WHERE username = $4',
        [passwordHash, fullName, role, username]
      );
      console.log(`User '${username}' updated successfully.`);
    } else {
      await pool.query(
        'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5)',
        [username, passwordHash, fullName, role, true]
      );
      console.log(`Grain operator user '${username}' created successfully.`);
    }

    await pool.end();
  } catch (error) {
    console.error('Error creating grain user:', error);
  }
}

console.log(`Creating grain operator user in the ${branch.toUpperCase()} database branch...`);
createGrainUser();
