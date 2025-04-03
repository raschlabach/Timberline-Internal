/**
 * Script to apply a specific migration to the preview database
 * 
 * Usage: node apply-migration.js <migration-file>
 * Example: node apply-migration.js migrations/add-order-tracking-fields.sql
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const config = require('./config');

// Use preview branch by default for safety
const branch = 'preview';
const connectionConfig = config[branch];

// Check command line arguments
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Error: Migration file not specified');
  console.log('Usage: node apply-migration.js <migration-file>');
  console.log('Example: node apply-migration.js migrations/add-order-tracking-fields.sql');
  process.exit(1);
}

// Resolve the migration file path
const migrationPath = path.resolve(__dirname, migrationFile);
if (!fs.existsSync(migrationPath)) {
  console.error(`Error: Migration file not found: ${migrationPath}`);
  process.exit(1);
}

// Read migration SQL
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
    
    console.log(`Applying migration: ${migrationFile}`);
    await client.query(migrationSql);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Migration applied successfully');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration(); 