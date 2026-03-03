import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = await getClient()
  const truckloadId = parseInt(params.id)

  try {
    const { orderId, assignmentType } = await request.json()

    // Start transaction
    await client.query('BEGIN')

    // Delete the assignment
    await client.query(
      `DELETE FROM truckload_order_assignments 
       WHERE truckload_id = $1 
       AND order_id = $2 
       AND assignment_type = $3`,
      [truckloadId, orderId, assignmentType]
    )

    // Update sequence numbers for remaining stops
    await client.query(
      `WITH ordered_stops AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY sequence_number) as new_sequence
        FROM truckload_order_assignments
        WHERE truckload_id = $1
      )
      UPDATE truckload_order_assignments
      SET sequence_number = ordered_stops.new_sequence
      FROM ordered_stops
      WHERE truckload_order_assignments.id = ordered_stops.id`,
      [truckloadId]
    )

    // Check remaining assignments for the unassigned order to update transfer status
    const remainingAssignments = await client.query(
      `WITH assignments AS (
         SELECT 
           assignment_type,
           truckload_id
         FROM truckload_order_assignments
         WHERE order_id = $1
       )
       SELECT 
         COUNT(*) as total_count,
         COUNT(*) FILTER (
           WHERE assignment_type = 'pickup'
         ) as pickup_count,
         COUNT(*) FILTER (
           WHERE assignment_type = 'delivery'
         ) as delivery_count,
         COUNT(DISTINCT truckload_id) as distinct_truckloads
       FROM assignments`,
      [orderId]
    )

    const totalCount = parseInt(remainingAssignments.rows[0].total_count)
    const pickupCount = parseInt(remainingAssignments.rows[0].pickup_count)
    const deliveryCount = parseInt(remainingAssignments.rows[0].delivery_count)
    const distinctTruckloads = parseInt(remainingAssignments.rows[0].distinct_truckloads)

    const isTransfer = totalCount === 2 && distinctTruckloads === 1

    await client.query(
      `UPDATE orders
       SET status = $1,
           is_transfer_order = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [
        totalCount === 0 ? 'unassigned' : (
          pickupCount > 0 ? 'pickup_assigned' : 'delivery_assigned'
        ),
        isTransfer,
        orderId
      ]
    )

    // Commit transaction
    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK')
    console.error('Error unassigning stop:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to unassign stop'
    }, { status: 500 })
  } finally {
    client.release()
  }
} 