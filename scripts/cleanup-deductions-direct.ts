import { getClient } from '../lib/db'

async function cleanup() {
  console.log('Connecting to database...')
  
  const client = await getClient()
  
  try {
    console.log('Starting transaction...')
    await client.query('BEGIN')

    // Count what will be deleted
    console.log('Counting deductions to delete...')
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM cross_driver_freight_deductions
      WHERE is_manual = true
        AND (comment IS NULL OR comment NOT LIKE '%split load%')
    `)
    
    const count = parseInt(countResult.rows[0]?.total || '0')
    console.log(`Found ${count} manual deductions to delete`)

    if (count === 0) {
      await client.query('COMMIT')
      console.log('No deductions to delete. Exiting.')
      return
    }

    // Delete
    console.log('Deleting deductions...')
    const deleteResult = await client.query(`
      DELETE FROM cross_driver_freight_deductions
      WHERE is_manual = true
        AND (comment IS NULL OR comment NOT LIKE '%split load%')
    `)

    await client.query('COMMIT')
    console.log(`✅ Successfully deleted ${deleteResult.rowCount} manual deductions`)
    console.log('Split load deductions were preserved.')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
  }
}

cleanup()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

