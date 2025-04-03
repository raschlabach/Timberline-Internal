/**
 * Script to import customers from a CSV file to the database
 * 
 * Usage:
 *   node scripts/import-customers.js [filename] [branch]
 * 
 * Where:
 *   [filename] is the path to the CSV file (default: './data/customers.csv')
 *   [branch] is either 'preview' or 'main' (default: 'preview')
 * 
 * Simplified CSV Format expected:
 * address,customer_name,notes,phone_number1,phone_number2
 */

const fs = require('fs');
const { parse } = require('csv-parse');
const { Pool } = require('pg');
const readline = require('readline');

// Load database config
let config;
try {
  config = require('../database/config');
} catch (error) {
  console.error('Database config not found. Please create a config.js file based on config.example.js');
  process.exit(1);
}

// Get command line arguments
const filename = process.argv[2] || './data/customers.csv';
const branch = process.argv[3] || 'preview';

if (!['preview', 'main'].includes(branch)) {
  console.error('Error: Branch must be either "preview" or "main"');
  process.exit(1);
}

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to the database
const pool = new Pool(config[branch]);

// Function to import customers
async function importCustomers() {
  console.log(`Importing customers from ${filename} to ${branch} branch...`);
  
  // Check if file exists
  if (!fs.existsSync(filename)) {
    console.error(`Error: File ${filename} does not exist`);
    process.exit(1);
  }
  
  // Create data directory if using default and it doesn't exist
  if (filename === './data/customers.csv' && !fs.existsSync('./data')) {
    fs.mkdirSync('./data');
    console.error('Created ./data directory. Please place your CSV file there and run again.');
    process.exit(1);
  }
  
  // Parse CSV
  const parser = fs
    .createReadStream(filename)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    }));
  
  console.log('Starting import...');
  
  let success = 0;
  let errors = 0;
  let skipped = 0;
  
  for await (const record of parser) {
    try {
      // Check if customer already exists (by name)
      const existingCheck = await pool.query(
        'SELECT id FROM customers WHERE customer_name = $1',
        [record.customer_name]
      );
      
      if (existingCheck.rows.length > 0) {
        console.log(`Skipping duplicate customer: ${record.customer_name}`);
        skipped++;
        continue;
      }
      
      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Split the address if possible to extract city/state
        let city = '';
        let state = '';
        let zip = '';
        
        // First create the location (with just the address field populated)
        const locationResult = await client.query(
          `INSERT INTO locations (
            name, address, city, state, zip_code
          ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            record.customer_name,
            record.address || '',
            city,
            state,
            zip
          ]
        );
        
        const locationId = locationResult.rows[0].id;
        
        // Then create the customer with reference to the location
        await client.query(
          `INSERT INTO customers (
            customer_name, location_id, phone_number_1, phone_number_2, notes
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            record.customer_name,
            locationId,
            record.phone_number1 ? record.phone_number1.replace(/\D/g, '') : '',
            record.phone_number2 ? record.phone_number2.replace(/\D/g, '') : null,
            record.notes || null
          ]
        );
        
        await client.query('COMMIT');
        success++;
        console.log(`Imported: ${record.customer_name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error importing ${record.customer_name}:`, err.message);
        errors++;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error processing ${record.customer_name}:`, error.message);
      errors++;
    }
  }
  
  console.log('\nImport completed:');
  console.log(`- Successfully imported: ${success} customers`);
  console.log(`- Skipped (duplicates): ${skipped} customers`);
  console.log(`- Errors: ${errors} customers`);
  
  await pool.end();
  rl.close();
}

// Ask for confirmation before importing
rl.question(`You are about to import customers to the ${branch.toUpperCase()} database branch. Continue? (y/N) `, (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('Import cancelled');
    rl.close();
    process.exit(0);
  }
  
  importCustomers().catch(err => {
    console.error('Fatal error during import:', err);
    process.exit(1);
  });
}); 