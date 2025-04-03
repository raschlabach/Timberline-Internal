/**
 * Script to inspect CSV file structure without importing
 * 
 * Usage:
 *   node scripts/csv-inspect.js [filename]
 * 
 * Where:
 *   [filename] is the path to the CSV file (default: './data/customers.csv')
 */

const fs = require('fs');
const { parse } = require('csv-parse');

// Get command line arguments
const filename = process.argv[2] || './data/customers.csv';

// Function to inspect CSV
async function inspectCsv() {
  console.log(`Inspecting CSV file: ${filename}`);
  
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
  
  // Get the first record to inspect structure
  let count = 0;
  for await (const record of parser) {
    if (count === 0) {
      console.log('CSV Headers:');
      console.log(Object.keys(record));
      console.log('\nSample Record:');
      console.log(JSON.stringify(record, null, 2));
    }
    
    count++;
    
    // Only process first record
    if (count >= 1) {
      break;
    }
  }
  
  console.log(`\nTotal records in CSV: ${count}`);
}

// Run the inspection
inspectCsv().catch(err => {
  console.error('Error inspecting CSV:', err);
}); 