const { query } = require('../lib/db');
const fs = require('fs');
const path = require('path');

async function applyMigration(filePath: string) {
  try {
    console.log(`Reading migration file: ${filePath}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log('Applying migration...');
    await query(sql);
    console.log('Migration applied successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
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

applyMigration(fullPath); 