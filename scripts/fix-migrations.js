const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration for Neon
const pool = new Pool({
  host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_D5hj1egPlAok',
  ssl: true
});

async function fixMigrations() {
  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1. Get all migrations from the migrations table
    const { rows: appliedMigrations } = await client.query(
      'SELECT * FROM migrations ORDER BY id'
    );

    // 2. Get all migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log('Current migrations in database:', appliedMigrations.length);
    console.log('Migration files found:', migrationFiles.length);

    // 3. Check for duplicates
    const seen = new Set();
    const duplicates = appliedMigrations.filter(migration => {
      if (seen.has(migration.name)) {
        return true;
      }
      seen.add(migration.name);
      return false;
    });

    if (duplicates.length > 0) {
      console.log('Found duplicate migrations:', duplicates);
      
      // Remove duplicates keeping the latest one
      for (const duplicate of duplicates) {
        const { rows: [latest] } = await client.query(
          'SELECT id FROM migrations WHERE name = $1 ORDER BY id DESC LIMIT 1',
          [duplicate.name]
        );
        
        await client.query(
          'DELETE FROM migrations WHERE name = $1 AND id != $2',
          [duplicate.name, latest.id]
        );
      }
    }

    // 4. Verify all migration files are tracked
    const trackedNames = new Set(appliedMigrations.map(m => m.name));
    const missingMigrations = migrationFiles.filter(file => !trackedNames.has(file));

    if (missingMigrations.length > 0) {
      console.log('Found untracked migrations:', missingMigrations);
      
      // Add missing migrations
      for (const file of missingMigrations) {
        await client.query(
          'INSERT INTO migrations (name, applied_at) VALUES ($1, NOW())',
          [file]
        );
      }
    }

    // 5. Verify no table exceeds column limit
    const { rows: tables } = await client.query(`
      SELECT 
        table_name,
        COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
      HAVING COUNT(*) > 1500
    `);

    if (tables.length > 0) {
      console.log('Tables exceeding 1500 columns:', tables);
      throw new Error('Some tables have too many columns. Please review the schema.');
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('Successfully fixed migrations table');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fixing migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the fix
fixMigrations()
  .then(() => {
    console.log('Migration fix completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to fix migrations:', error);
    process.exit(1);
  }); 