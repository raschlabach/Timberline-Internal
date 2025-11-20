/**
 * Script to apply the favorite_customer_groups migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load database config
const config = require('../database/config');

// Use preview branch by default
const branch = 'preview';

console.log(`Applying migration to ${branch} branch...`);

// Create a connection pool
const pool = new Pool({
  ...config[branch],
  ssl: true
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-favorite-customer-groups.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration: add-favorite-customer-groups.sql');
    
    // Start transaction
    await client.query('BEGIN');
    
    try {
      // Execute the migration
      await client.query(migrationSql);
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('Migration applied successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error applying migration:', error);
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});

