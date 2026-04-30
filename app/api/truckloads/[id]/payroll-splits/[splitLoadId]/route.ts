import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient } from '@/lib/db'

// DELETE /api/truckloads/[id]/payroll-splits/[splitLoadId]
//
// Removes a split load entirely:
// - Deletes both cross_driver_freight_deductions entries that reference
//   this split (the deduction on the main side AND the addition on the
//   misc side, if it exists)
// - Clears exclude_from_load_value on the misc-side assignment
// - Deletes the split_loads row itself
//
// Each order is only allowed to have one active split, so this fully
// reverses what the user did when they created the split.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; splitLoadId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const truckloadId = parseInt(params.id, 10)
  const splitLoadId = parseInt(params.splitLoadId, 10)
  if (Number.isNaN(truckloadId) || Number.isNaN(splitLoadId)) {
    return NextResponse.json({ success: false, error: 'Invalid IDs' }, { status: 400 })
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Find the split's order_id and main side so we can clear the exclude
    // flag on the misc-side assignment.
    const splitResult = await client.query(
      `SELECT order_id, full_quote_assignment FROM split_loads WHERE id = $1`,
      [splitLoadId]
    )
    if (splitResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Split load not found' },
        { status: 404 }
      )
    }
    const orderId = Number(splitResult.rows[0].order_id)
    const mainAssignmentType = splitResult.rows[0].full_quote_assignment as
      | 'pickup'
      | 'delivery'
    const miscAssignmentType =
      mainAssignmentType === 'pickup' ? 'delivery' : 'pickup'

    // Verify the requester's truckload is connected to this split (security).
    const involvedResult = await client.query(
      `SELECT 1 FROM cross_driver_freight_deductions
       WHERE split_load_id = $1 AND truckload_id = $2
       LIMIT 1`,
      [splitLoadId, truckloadId]
    )
    if (involvedResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Split load not associated with this truckload' },
        { status: 403 }
      )
    }

    // Delete adjustments first (FK references split_loads.id).
    await client.query(
      `DELETE FROM cross_driver_freight_deductions
       WHERE split_load_id = $1`,
      [splitLoadId]
    )

    // Clear exclude_from_load_value on the misc-side assignment(s) for this
    // order. We touch all assignments matching the misc role on this order
    // because the split affects whichever load happens to have it.
    await client.query(
      `UPDATE truckload_order_assignments
       SET exclude_from_load_value = false
       WHERE order_id = $1 AND assignment_type = $2`,
      [orderId, miscAssignmentType]
    )

    // Finally delete the split itself.
    await client.query(`DELETE FROM split_loads WHERE id = $1`, [splitLoadId])

    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error deleting split load:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete split load' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
