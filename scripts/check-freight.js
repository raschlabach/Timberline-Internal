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

async function checkFreight() {
  try {
    console.log(`Checking freight data in ${branch.toUpperCase()} database...`);
    
    // Get counts from each freight table
    const skidsCount = await pool.query('SELECT COUNT(*) FROM skids');
    const vinylCount = await pool.query('SELECT COUNT(*) FROM vinyl');
    const footageCount = await pool.query('SELECT COUNT(*) FROM footage');
    
    console.log('Freight table counts:');
    console.log(`- Skids: ${skidsCount.rows[0].count}`);
    console.log(`- Vinyl: ${vinylCount.rows[0].count}`);
    console.log(`- Footage: ${footageCount.rows[0].count}`);
    
    // Check for any invalid data
    const invalidSkids = await pool.query(`
      SELECT s.*, o.id as order_id 
      FROM skids s 
      LEFT JOIN orders o ON s.order_id = o.id 
      WHERE o.id IS NULL
    `);
    
    const invalidVinyl = await pool.query(`
      SELECT v.*, o.id as order_id 
      FROM vinyl v 
      LEFT JOIN orders o ON v.order_id = o.id 
      WHERE o.id IS NULL
    `);
    
    const invalidFootage = await pool.query(`
      SELECT f.*, o.id as order_id 
      FROM footage f 
      LEFT JOIN orders o ON f.order_id = o.id 
      WHERE o.id IS NULL
    `);
    
    if (invalidSkids.rows.length > 0) {
      console.log('\nFound invalid skids records:', invalidSkids.rows);
    }
    
    if (invalidVinyl.rows.length > 0) {
      console.log('\nFound invalid vinyl records:', invalidVinyl.rows);
    }
    
    if (invalidFootage.rows.length > 0) {
      console.log('\nFound invalid footage records:', invalidFootage.rows);
    }
    
    // Check a sample order with freight data
    const sampleOrder = await pool.query(`
      SELECT 
        o.id,
        o.status,
        (SELECT COUNT(*) FROM skids WHERE order_id = o.id) as skids_count,
        (SELECT COUNT(*) FROM vinyl WHERE order_id = o.id) as vinyl_count,
        (SELECT COUNT(*) FROM footage WHERE order_id = o.id) as footage_count
      FROM orders o
      WHERE EXISTS (
        SELECT 1 FROM skids WHERE order_id = o.id
        UNION ALL
        SELECT 1 FROM vinyl WHERE order_id = o.id
        UNION ALL
        SELECT 1 FROM footage WHERE order_id = o.id
      )
      LIMIT 1
    `);
    
    if (sampleOrder.rows.length > 0) {
      console.log('\nSample order with freight data:');
      console.table(sampleOrder.rows);
    } else {
      console.log('\nNo orders found with freight data');
    }
    
  } catch (error) {
    console.error('Error checking freight:', error);
  } finally {
    await pool.end();
  }
}

checkFreight(); 