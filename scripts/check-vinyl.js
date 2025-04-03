const { Pool } = require('pg');

// Load database config
let config;
try {
  config = require('../database/config');
} catch (error) {
  console.error('Database config not found. Please create a config.js file based on config.example.js');
  process.exit(1);
}

// Determine which branch to use
const branch = process.argv[2] || 'preview';
if (!['preview', 'main'].includes(branch)) {
  console.error('Error: Branch must be either "preview" or "main"');
  process.exit(1);
}

// Connect to the database
const pool = new Pool(config[branch]);

async function checkVinyl() {
  try {
    console.log(`Checking vinyl data in ${branch.toUpperCase()} database...`);
    
    // Get all vinyl records with order details
    const vinylData = await pool.query(`
      SELECT 
        v.*,
        o.status as order_status,
        pc.customer_name as pickup_customer,
        dc.customer_name as delivery_customer
      FROM vinyl v
      JOIN orders o ON v.order_id = o.id
      JOIN customers pc ON o.pickup_customer_id = pc.id
      JOIN customers dc ON o.delivery_customer_id = dc.id
      ORDER BY v.order_id, v.id
    `);
    
    if (vinylData.rows.length > 0) {
      console.log('\nVinyl records:');
      console.table(vinylData.rows);
    } else {
      console.log('\nNo vinyl records found');
    }
    
    // Check for any NULL values in important fields
    const nullCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE width IS NULL) as null_width,
        COUNT(*) FILTER (WHERE length IS NULL) as null_length,
        COUNT(*) FILTER (WHERE square_footage IS NULL) as null_footage,
        COUNT(*) FILTER (WHERE quantity IS NULL) as null_quantity
      FROM vinyl
    `);
    
    console.log('\nNull value check:');
    console.table(nullCheck.rows);
    
  } catch (error) {
    console.error('Error checking vinyl:', error);
  } finally {
    await pool.end();
  }
}

checkVinyl(); 