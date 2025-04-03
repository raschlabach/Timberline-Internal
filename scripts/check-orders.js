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

async function checkOrders() {
  try {
    console.log(`Checking orders in ${branch.toUpperCase()} database...`);
    
    // Get total orders count
    const orderCount = await pool.query('SELECT COUNT(*) FROM orders');
    console.log(`Total orders: ${orderCount.rows[0].count}`);
    
    // Get orders by status
    const ordersByStatus = await pool.query(`
      SELECT status, COUNT(*) 
      FROM orders 
      GROUP BY status 
      ORDER BY COUNT(*) DESC
    `);
    
    if (ordersByStatus.rows.length === 0) {
      console.log('No orders found in the database.');
    } else {
      console.log('\nOrders by status:');
      console.table(ordersByStatus.rows);
    }
    
    // Get recent orders
    const recentOrders = await pool.query(`
      SELECT 
        o.id,
        o.status,
        pc.customer_name as pickup_customer,
        dc.customer_name as delivery_customer,
        o.pickup_date,
        o.created_at
      FROM orders o
      JOIN customers pc ON o.pickup_customer_id = pc.id
      JOIN customers dc ON o.delivery_customer_id = dc.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    
    if (recentOrders.rows.length > 0) {
      console.log('\nMost recent orders:');
      console.table(recentOrders.rows);
    }
    
  } catch (error) {
    console.error('Error checking orders:', error);
  } finally {
    await pool.end();
  }
}

checkOrders(); 