const { Pool } = require('pg');

// Database configuration
const config = {
  preview: {
    user: 'neondb_owner',
    password: 'npg_D5hj1egPlAok',
    host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
    port: 5432,
    database: 'neondb',
    ssl: {
      rejectUnauthorized: true
    }
  }
};

async function checkTruckloads() {
  const pool = new Pool(config.preview);
  
  try {
    console.log('Checking truckloads...');
    
    // Check truckloads
    const truckloads = await pool.query(
      'SELECT id, driver_id, start_date, end_date FROM truckloads ORDER BY id DESC LIMIT 5'
    );
    
    console.log(`Found ${truckloads.rows.length} truckloads:`);
    truckloads.rows.forEach(tl => {
      console.log(`- Truckload ID: ${tl.id}, Driver: ${tl.driver_id}, Dates: ${tl.start_date} to ${tl.end_date}`);
    });
    
    // Check orders
    const orders = await pool.query(
      'SELECT id, pickup_customer_id, delivery_customer_id, status FROM orders ORDER BY id DESC LIMIT 5'
    );
    
    console.log(`\nFound ${orders.rows.length} orders:`);
    orders.rows.forEach(order => {
      console.log(`- Order ID: ${order.id}, Pickup: ${order.pickup_customer_id}, Delivery: ${order.delivery_customer_id}, Status: ${order.status}`);
    });
    
    // Check truckload assignments
    const assignments = await pool.query(
      'SELECT truckload_id, order_id, assignment_type FROM truckload_order_assignments ORDER BY truckload_id DESC LIMIT 5'
    );
    
    console.log(`\nFound ${assignments.rows.length} assignments:`);
    assignments.rows.forEach(assignment => {
      console.log(`- Truckload: ${assignment.truckload_id}, Order: ${assignment.order_id}, Type: ${assignment.assignment_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking data:', error.message);
  } finally {
    await pool.end();
  }
}

checkTruckloads();
