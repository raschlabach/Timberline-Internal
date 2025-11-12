const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_D5hj1egPlAok',
  ssl: true
});

async function testReorder() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Test truckload ID
    const truckloadId = 15; // Replace with your actual truckload ID
    
    console.log('Testing reorder functionality...');
    
    // 1. Get current sequence numbers
    console.log('\nCurrent sequence numbers:');
    const beforeResult = await client.query(
      `SELECT order_id, assignment_type, sequence_number 
       FROM truckload_order_assignments 
       WHERE truckload_id = $1 
       ORDER BY sequence_number`,
      [truckloadId]
    );
    console.table(beforeResult.rows);
    
    // 2. Create test reorder data (reverse the current order)
    const orders = beforeResult.rows.map((row, index) => ({
      id: row.order_id,
      assignment_type: row.assignment_type,
      sequence_number: beforeResult.rows.length - index
    }));
    
    // 3. Build and execute the update query using (order_id, assignment_type)
    const caseExpressions = orders.map(order => 
      `WHEN order_id = ${order.id} AND assignment_type = '${order.assignment_type}' THEN ${order.sequence_number}`
    ).join(' ');
    
    await client.query(
      `UPDATE truckload_order_assignments 
       SET sequence_number = CASE ${caseExpressions} END,
           updated_at = CURRENT_TIMESTAMP
       WHERE truckload_id = $1 
       AND (order_id, assignment_type) IN (${orders.map((_, i) => `($${i * 2 + 2}, $${i * 2 + 3})`).join(', ')})`,
      [
        truckloadId,
        ...orders.flatMap(o => [o.id, o.assignment_type])
      ]
    );
    
    // 4. Verify the changes
    console.log('\nNew sequence numbers:');
    const afterResult = await client.query(
      `SELECT order_id, assignment_type, sequence_number 
       FROM truckload_order_assignments 
       WHERE truckload_id = $1 
       ORDER BY sequence_number`,
      [truckloadId]
    );
    console.table(afterResult.rows);
    
    // 5. Verify the changes were applied correctly by comparing each (order_id, assignment_type) pair
    const expectedMap = new Map(orders.map(o => [`${o.id}-${o.assignment_type}`, o.sequence_number]));
    const changesCorrect = afterResult.rows.every(row => {
      const key = `${row.order_id}-${row.assignment_type}`;
      return expectedMap.get(key) === row.sequence_number;
    });
    
    console.log('\nTest Results:');
    console.log('Changes applied correctly:', changesCorrect);
    
    // Rollback the changes to not affect production data
    await client.query('ROLLBACK');
    console.log('\nTest completed - changes rolled back');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during test:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testReorder().catch(console.error); 