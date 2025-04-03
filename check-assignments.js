const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://neondb_owner:npg_D5hj1egPlAok@ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'
});

async function checkAssignments() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        o.id as order_id,
        o.status,
        pc.customer_name as pickup_customer,
        dc.customer_name as delivery_customer,
        t.trailer_number,
        u.full_name as driver_name,
        toa.assignment_type
      FROM orders o
      JOIN customers pc ON o.pickup_customer_id = pc.id
      JOIN customers dc ON o.delivery_customer_id = dc.id
      JOIN truckload_order_assignments toa ON o.id = toa.order_id
      JOIN truckloads t ON toa.truckload_id = t.id
      LEFT JOIN drivers d ON t.driver_id = d.user_id
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY o.id;
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    client.release();
    pool.end();
  }
}

checkAssignments().catch(console.error); 