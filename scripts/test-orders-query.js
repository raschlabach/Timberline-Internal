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

async function testOrdersQuery() {
  try {
    console.log(`Testing orders query in ${branch.toUpperCase()} database...`);
    
    // First test just the vinyl_summary CTE
    const vinylSummaryQuery = `
      WITH vinyl_summary AS (
        SELECT 
          order_id,
          COUNT(*) as vinyl_count,
          json_agg(
            json_build_object(
              'id', id,
              'type', 'vinyl',
              'width', width,
              'length', length,
              'footage', square_footage,
              'quantity', quantity
            )
          ) as vinyl_data
        FROM vinyl
        GROUP BY order_id
      )
      SELECT * FROM vinyl_summary;
    `;
    
    console.log('\nTesting vinyl_summary CTE...');
    const vinylSummaryResult = await pool.query(vinylSummaryQuery);
    console.log('Vinyl summary result:');
    console.table(vinylSummaryResult.rows);
    
    // Now test both CTEs together
    const bothCtesQuery = `
      WITH skids_summary AS (
        SELECT 
          order_id,
          COUNT(*) as skids_count,
          json_agg(
            json_build_object(
              'id', id,
              'type', 'skid',
              'width', width,
              'length', length,
              'footage', square_footage,
              'quantity', quantity
            )
          ) as skids_data
        FROM skids
        GROUP BY order_id
      ),
      vinyl_summary AS (
        SELECT 
          order_id,
          COUNT(*) as vinyl_count,
          json_agg(
            json_build_object(
              'id', id,
              'type', 'vinyl',
              'width', width,
              'length', length,
              'footage', square_footage,
              'quantity', quantity
            )
          ) as vinyl_data
        FROM vinyl
        GROUP BY order_id
      )
      SELECT 
        o.id,
        COALESCE(ss.skids_count, 0) as skids_count,
        COALESCE(vs.vinyl_count, 0) as vinyl_count,
        ss.skids_data,
        vs.vinyl_data
      FROM orders o
      LEFT JOIN skids_summary ss ON o.id = ss.order_id
      LEFT JOIN vinyl_summary vs ON o.id = vs.order_id
      WHERE o.status = 'unassigned'
      ORDER BY o.id;
    `;
    
    console.log('\nTesting both CTEs...');
    const bothCtesResult = await pool.query(bothCtesQuery);
    console.log('Both CTEs result:');
    console.table(bothCtesResult.rows);
    
  } catch (error) {
    console.error('Error testing query:', error);
  } finally {
    await pool.end();
  }
}

testOrdersQuery(); 