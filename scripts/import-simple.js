/**
 * Simple script to import customers from CSV
 * 
 * Usage:
 *   node scripts/import-simple.js [filename] [branch]
 */

const fs = require('fs');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

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

console.log(`Importing customers from ${filename} to ${branch} branch...`);

// Connect to the database
const pool = new Pool(config[branch]);

async function importCustomers() {
  try {
    // Check if file exists
    if (!fs.existsSync(filename)) {
      console.error(`Error: File ${filename} does not exist`);
      process.exit(1);
    }
    
    // Read and parse CSV
    const input = fs.readFileSync(filename, 'utf8');
    const records = await new Promise((resolve, reject) => {
      parse(input, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
    
    console.log(`Found ${records.length} records in CSV`);
    
    let success = 0;
    let errors = 0;
    let skipped = 0;
    
    // Process each record
    for (const record of records) {
      // Skip if customer_name is empty
      if (!record.customer_name || record.customer_name.trim() === '') {
        console.log("Skipping empty customer name");
        skipped++;
        continue;
      }

      try {
        // Check if customer already exists
        const existingCheck = await pool.query(
          'SELECT id FROM customers WHERE customer_name = $1',
          [record.customer_name]
        );
        
        if (existingCheck.rows.length > 0) {
          console.log(`Skipping duplicate: ${record.customer_name}`);
          skipped++;
          continue;
        }
        
        // Begin transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Insert location
          const locationResult = await client.query(
            `INSERT INTO locations (
              name, address, city, state, zip_code
            ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
              record.customer_name,
              record.address || '',
              '', // city (empty for now)
              '', // state (empty for now)
              ''  // zip (empty for now)
            ]
          );
          
          const locationId = locationResult.rows[0].id;
          
          // Insert customer
          await client.query(
            `INSERT INTO customers (
              customer_name, location_id, phone_number_1, phone_number_2, notes
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              record.customer_name,
              locationId,
              record.phone_number_1 || null,
              record.phone_number_2 || null,
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
    console.log(`- Skipped (duplicates/empty): ${skipped} customers`);
    console.log(`- Errors: ${errors} customers`);
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the import
importCustomers(); 