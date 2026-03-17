/**
 * Apply grain migration + create/update grain operator user on a given branch.
 * Use this so both development (preview) and production (main) have grain tables and user.
 *
 * Usage:
 *   node scripts/setup-grain.js preview   # for local dev (uses preview DB)
 *   node scripts/setup-grain.js main       # for production
 */

const fs = require('fs');
const path = require('path');
const { hash } = require('bcryptjs');
const { Pool } = require('pg');

let config;
try {
  config = require('../database/config');
} catch (error) {
  console.error('Database config not found. Create database/config.js from config.example.js');
  process.exit(1);
}

const branch = process.argv[2] || 'preview';
if (!['preview', 'main'].includes(branch)) {
  console.error('Usage: node scripts/setup-grain.js [preview|main]');
  process.exit(1);
}

const pool = new Pool(config[branch]);

async function applyMigration() {
  const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'add-grain-tracking.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
}

async function ensureUser() {
  const username = 'Rodene';
  const password = 'GrainTracker';
  const passwordHash = await hash(password, 10);

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE users SET password_hash = $1, full_name = $2, role = $3, is_active = TRUE WHERE username = $4',
      [passwordHash, 'Rodene', 'grain_operator', username]
    );
    console.log(`  User "${username}" updated.`);
  } else {
    await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5)',
      [username, passwordHash, 'Rodene', 'grain_operator', true]
    );
    console.log(`  User "${username}" created.`);
  }
}

async function run() {
  console.log(`Setting up grain (migration + user) on ${branch.toUpperCase()}...`);
  try {
    await applyMigration();
    console.log('  Migration applied.');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('  Grain tables already exist.');
    } else {
      console.error('Migration failed:', e.message);
      process.exit(1);
    }
  }
  try {
    await ensureUser();
  } catch (e) {
    console.error('User create/update failed:', e.message);
    process.exit(1);
  }
  console.log('Done.');
  await pool.end();
}

run();
