const { getClient } = require('../lib/db')

async function deleteAutomaticDeductions() {

  try {
    console.log('Connecting to database...')
    const client = await getClient()
    
    try {
      await client.query('BEGIN')
      
      // First, count how many automatic deductions exist
      const countResult = await client.query(`
        SELECT COUNT(*) as count
        FROM cross_driver_freight_deductions
        WHERE is_manual = false
      `)
      
      const count = parseInt(countResult.rows[0].count)
      console.log(`Found ${count} automatic deductions to delete.`)
      
      if (count === 0) {
        console.log('No automatic deductions found. Nothing to delete.')
        await client.query('ROLLBACK')
        return
      }
      
      // Delete all automatic deductions
      const deleteResult = await client.query(`
        DELETE FROM cross_driver_freight_deductions
        WHERE is_manual = false
      `)
      
      await client.query('COMMIT')
      
      console.log(`Successfully deleted ${deleteResult.rowCount} automatic deduction(s).`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting automatic deductions:', error)
    process.exit(1)
  }
}

deleteAutomaticDeductions()
  .then(() => {
    console.log('Script completed successfully.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

