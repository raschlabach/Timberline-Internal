const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load database config
const config = require('./config');

// Use preview branch by default
const branch = process.env.NODE_ENV === 'production' ? 'main' : 'preview';
const dbConfig = config[branch];

async function runMigration() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log(`Running migration on ${branch} branch...`);
    
    // Read the migration file
    const migration = fs.readFileSync(
      path.join(__dirname, 'migrations', '20240324_create_schedule_notes.sql'),
      'utf8'
    );
    
    // Run the migration
    await pool.query(migration);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration(); 