/**
 * Script to import customers from a Bubble.io CSV export
 * 
 * Usage:
 *   node scripts/import-bubble-customers.js [filename] [branch]
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
  console.log(`Importing Bubble.io customers from ${filename} to ${branch} branch...`);
  
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
  
  // Log the first record to see the field names
  let isFirstRecord = true;
  let headerFields = [];
  
  // Try to find these fields in the CSV headers
  const possibleCustomerNameFields = ['Customer', 'Customer Name', 'Name', 'Business', 'Company', 'customer_name'];
  const possibleAddressFields = ['Address', 'Full Address', 'Location', 'address'];
  const possiblePhoneFields = ['Phone', 'Phone 1', 'Phone Number', 'phone', 'phone_number1', 'Contact'];
  const possiblePhone2Fields = ['Phone 2', 'Secondary Phone', 'Alt Phone', 'phone_number2'];
  const possibleNotesFields = ['Notes', 'Comments', 'Description', 'Info', 'notes'];
  
  for await (const record of parser) {
    try {
      // Debug: Print the first record to see the field structure
      if (isFirstRecord) {
        console.log('CSV Record Structure:');
        console.log(JSON.stringify(record, null, 2));
        isFirstRecord = false;
        
        // Get all header fields
        headerFields = Object.keys(record);
        
        // Try to auto-map fields
        const fieldMap = {
          customerName: findMatchingField(headerFields, possibleCustomerNameFields),
          address: findMatchingField(headerFields, possibleAddressFields),
          phone1: findMatchingField(headerFields, possiblePhoneFields),
          phone2: findMatchingField(headerFields, possiblePhone2Fields),
          notes: findMatchingField(headerFields, possibleNotesFields)
        };
        
        console.log('\nAuto-mapped fields:');
        console.log(JSON.stringify(fieldMap, null, 2));
        
        // Ask if user wants to continue with import
        const continueImport = await new Promise((resolve) => {
          rl.question('\nDo you want to continue with the import using these field mappings? (y/N) ', (answer) => {
            resolve(answer.toLowerCase() === 'y');
          });
        });
        
        if (!continueImport) {
          console.log('Import cancelled');
          rl.close();
          await pool.end();
          process.exit(0);
        }
        
        // Store the field map in global for use during import
        global.fieldMap = fieldMap;
      }
      
      // Get values using the field map
      const customerName = record[global.fieldMap.customerName] || '';
      const address = record[global.fieldMap.address] || '';
      const phone1 = record[global.fieldMap.phone1] || '';
      const phone2 = record[global.fieldMap.phone2] || '';
      const notes = record[global.fieldMap.notes] || '';
      
      // Skip if no customer name
      if (!customerName.trim()) {
        console.log(`Skipping record with no customer name`);
        skipped++;
        continue;
      }
      
      // Check if customer already exists (by name)
      const existingCheck = await pool.query(
        'SELECT id FROM customers WHERE customer_name = $1',
        [customerName]
      );
      
      if (existingCheck.rows.length > 0) {
        console.log(`Skipping duplicate customer: ${customerName}`);
        skipped++;
        continue;
      }
      
      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // First create the location with the address from Bubble
        const locationResult = await client.query(
          `INSERT INTO locations (
            name, address, city, state, zip_code
          ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            customerName,
            address, // Store the full address from Bubble
            '',      // We don't have separate city field
            '',      // We don't have separate state field
            ''       // We don't have separate zip field
          ]
        );
        
        const locationId = locationResult.rows[0].id;
        
        // Clean phone numbers (remove non-digits)
        const cleanPhone1 = phone1.toString().replace(/\D/g, '');
        const cleanPhone2 = phone2 ? phone2.toString().replace(/\D/g, '') : null;
        
        // Then create the customer with reference to the location
        await client.query(
          `INSERT INTO customers (
            customer_name, location_id, phone_number_1, phone_number_2, notes
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            customerName,
            locationId,
            cleanPhone1 || null,
            cleanPhone2 || null,
            notes || null
          ]
        );
        
        await client.query('COMMIT');
        success++;
        console.log(`Imported: ${customerName}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error importing ${customerName}:`, err.message);
        errors++;
      } finally {
        client.release();
      }
    } catch (error) {
      const customerName = record[global.fieldMap?.customerName] || 'Unknown';
      console.error(`Error processing ${customerName}:`, error.message);
      errors++;
    }
  }
  
  console.log('\nImport completed:');
  console.log(`- Successfully imported: ${success} customers`);
  console.log(`- Skipped (duplicates/empty): ${skipped} customers`);
  console.log(`- Errors: ${errors} customers`);
  
  await pool.end();
  rl.close();
}

// Function to find a matching field from possible options
function findMatchingField(headerFields, possibleFields) {
  for (const possible of possibleFields) {
    // Try exact match first
    const exactMatch = headerFields.find(h => h.toLowerCase() === possible.toLowerCase());
    if (exactMatch) return exactMatch;
    
    // Try contains match
    const containsMatch = headerFields.find(h => 
      h.toLowerCase().includes(possible.toLowerCase()) || 
      possible.toLowerCase().includes(h.toLowerCase())
    );
    if (containsMatch) return containsMatch;
  }
  
  return null; // No match found
}

// Ask for confirmation before importing
rl.question(`You are about to import Bubble.io customers to the ${branch.toUpperCase()} database branch. Continue? (y/N) `, (answer) => {
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