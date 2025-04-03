/**
 * Script to import customers from a CSV file to the database
 * 
 * Usage:
 *   node scripts/import-customers-fixed.js [filename] [branch]
 * 
 * Where:
 *   [filename] is the path to the CSV file (default: './data/customers.csv')
 *   [branch] is either 'preview' or 'main' (default: 'preview')
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
    // Skip empty records
    if (!record.customer_name || record.customer_name.trim() === '') {
      console.log('Skipping empty record');
      continue;
    }

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
        
        // Extract potential city/state/zip from address
        // Example: "14150 Hubbard Rd, Burton, OH 44021, USA"
        let city = '';
        let state = '';
        let zip = '';
        
        // Simple parsing for addresses with format: street, city, state zip, country
        if (record.address && record.address.includes(',')) {
          const parts = record.address.split(',').map(part => part.trim());
          if (parts.length >= 3) {
            // Try to extract state and zip from the state/zip part
            const stateZipPart = parts[parts.length - 2]; // e.g. "OH 44021"
            const stateZipMatch = stateZipPart.match(/([A-Z]{2})\s+(\d{5})/);
            
            if (stateZipMatch) {
              state = stateZipMatch[1]; // e.g. "OH"
              zip = stateZipMatch[2];   // e.g. "44021"
            }
            
            // Set city from the part before state/zip
            if (parts.length >= 3) {
              city = parts[parts.length - 3]; // e.g. "Burton"
            }
          }
        }
        
        // First create the location
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
            record.phone_number_1 ? record.phone_number_1.replace(/\D/g, '') : '',
            record.phone_number_2 ? record.phone_number_2.replace(/\D/g, '') : null,
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
      console.error(`Error processing record:`, error.message);
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