const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration(client, migrationFile, migrationName) {
  console.log(`\nRunning migration: ${migrationName}...`);
  
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    await client.query(sql);
    console.log(`✓ Migration ${migrationName} completed successfully`);
    return true;
  } catch (error) {
    console.error(`✗ Error running ${migrationName}:`, error.message);
    return false;
  }
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check which branch we're on
    const dbUrl = process.env.DATABASE_URL || '';
    const branch = dbUrl.includes('preview') ? 'PREVIEW' : 'MAIN';
    console.log(`\nDatabase branch: ${branch}`);
    console.log('⚠️  Make sure you want to apply migrations to this branch!\n');

    // Run migrations
    const migrations = [
      { file: 'add-lumber-load-id-ranges.sql', name: 'Load ID Ranges' },
      { file: 'add-lumber-load-presets.sql', name: 'Load Presets' }
    ];

    let successCount = 0;
    for (const migration of migrations) {
      const success = await runMigration(client, migration.file, migration.name);
      if (success) successCount++;
    }

    console.log(`\n${successCount}/${migrations.length} migrations completed successfully`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
