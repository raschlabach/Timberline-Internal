const { Pool } = require('pg')
require('dotenv').config()

async function checkAssignments() {
  const pool = new Pool({
    host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
    port: 5432,
    database: 'neondb',
    user: 'neondb_owner',
    password: 'npg_D5hj1egPlAok',
    ssl: true
  })

  try {
    // Get all assignments for truckload 15
    const { rows: assignments } = await pool.query(`
      SELECT 
        a.id,
        a.truckload_id,
        a.order_id,
        a.assignment_type,
        a.sequence_number,
        a.is_completed,
        a.created_at,
        a.updated_at
      FROM truckload_order_assignments a
      WHERE a.truckload_id = 15
      ORDER BY a.sequence_number DESC;
    `)

    console.log('\nCurrent Assignments:')
    console.log('-------------------')
    assignments.forEach(a => {
      console.log(`ID: ${a.id}`)
      console.log(`Order ID: ${a.order_id}`)
      console.log(`Type: ${a.assignment_type}`)
      console.log(`Sequence: ${a.sequence_number}`)
      console.log(`Last Updated: ${a.updated_at}`)
      console.log('-------------------')
    })

    // Check table structure
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'truckload_order_assignments'
      ORDER BY ordinal_position;
    `)

    console.log('\nTable Structure:')
    console.log('----------------')
    columns.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`)
    })

  } catch (error) {
    console.error('Error checking assignments:', error)
  } finally {
    await pool.end()
  }
}

checkAssignments() 