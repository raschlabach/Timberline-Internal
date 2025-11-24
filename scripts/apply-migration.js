const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load database config
const config = require('../database/config');

// Use main branch for production
const branch = process.argv[3] || 'main';

console.log(`Applying migration to ${branch} branch...`);

// Create a connection pool
const pool = new Pool({
  ...config[branch],
  ssl: true
});

async function applyMigration(filePath) {
  const client = await pool.connect();
  try {
    // Read the migration file
    const sql = fs.readFileSync(filePath, 'utf8');

    // Start transaction
    await client.query('BEGIN');

    try {
      // Execute the migration
      await client.query(sql);

      // Commit transaction
      await client.query('COMMIT');
      console.log('Migration applied successfully');
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

// Get migration file path from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Please provide a migration file path');
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), migrationFile);
if (!fs.existsSync(fullPath)) {
  console.error(`Migration file not found: ${fullPath}`);
  process.exit(1);
}

applyMigration(fullPath).catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 