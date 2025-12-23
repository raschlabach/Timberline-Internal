import { getClient, query } from '../lib/db'

async function cleanupDeductions() {
  console.log('Starting cleanup of manual deductions from one-driver loads...\n')

  try {
    // Step 1: Count what will be deleted
    console.log('Step 1: Counting deductions to delete...')
    const countResult = await query(`
      SELECT COUNT(*) as total_manual_deductions_to_delete
      FROM cross_driver_freight_deductions
      WHERE is_manual = true
        AND (comment IS NULL OR comment NOT LIKE '%split load%')
    `)
    
    const count = parseInt(countResult.rows[0]?.total_manual_deductions_to_delete || '0')
    console.log(`Found ${count} manual deductions to delete (excluding split loads)\n`)

    if (count === 0) {
      console.log('No deductions to delete. Exiting.')
      return
    }

    // Step 2: Preview some examples
    console.log('Step 2: Previewing first 10 deductions that will be deleted...')
    const previewResult = await query(`
      SELECT 
        id,
        truckload_id,
        driver_name,
        deduction,
        comment,
        created_at
      FROM cross_driver_freight_deductions
      WHERE is_manual = true
        AND (comment IS NULL OR comment NOT LIKE '%split load%')
      ORDER BY truckload_id, created_at DESC
      LIMIT 10
    `)
    
    console.log('Sample deductions to be deleted:')
    previewResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ID: ${row.id}, Truckload: ${row.truckload_id}, Amount: $${row.deduction}, Comment: ${row.comment || '(none)'}`)
    })
    console.log('')

    // Step 3: Delete
    console.log('Step 3: Deleting deductions...')
    const deleteResult = await query(`
      DELETE FROM cross_driver_freight_deductions
      WHERE is_manual = true
        AND (comment IS NULL OR comment NOT LIKE '%split load%')
    `)

    console.log(`\n✅ Successfully deleted ${deleteResult.rowCount} manual deductions`)
    console.log('Split load deductions were preserved.')

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}

// Run the cleanup
cleanupDeductions()
  .then(() => {
    console.log('\nCleanup completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nCleanup failed:', error)
    process.exit(1)
  })

