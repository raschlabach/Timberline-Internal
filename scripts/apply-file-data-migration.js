/**
 * Script to apply the file_data migration to order_links table
 * 
 * Usage: node scripts/apply-file-data-migration.js [branch]
 * Where [branch] is either 'preview' or 'main' (defaults to 'main' for production)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const config = require('../database/config');

// Determine which branch to use (default to main for production)
const branch = process.argv[2] || 'main';
if (!['preview', 'main'].includes(branch)) {
  console.error('Error: Branch must be either "preview" or "main"');
  process.exit(1);
}

const connectionConfig = config[branch];

if (!connectionConfig || !connectionConfig.connectionString) {
  console.error(`Error: Connection config for "${branch}" branch not found in database/config.js`);
  process.exit(1);
}

// Read migration SQL
const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '20241120_add_file_data_to_order_links.sql');
if (!fs.existsSync(migrationPath)) {
  console.error(`Error: Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Connect to database
console.log(`Connecting to ${branch} database...`);
const client = new Client(connectionConfig);

async function applyMigration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Start transaction
    await client.query('BEGIN');
    
    console.log(`Applying migration: 20241120_add_file_data_to_order_links.sql`);
    console.log('This will add file_data, file_name, file_type, and file_size columns to order_links table...');
    
    await client.query(migrationSql);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Migration applied successfully!');
    console.log('The order_links table now supports file uploads.');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Error applying migration:', error.message);
    if (error.code === '42701') {
      console.log('Note: Some columns may already exist. This is okay.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

