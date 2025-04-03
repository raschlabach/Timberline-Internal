import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/truckloads/assign - Assign an order to a truckload
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, truckloadId, assignmentType, isTransferOrder } = body

    if (!orderId || !truckloadId || !assignmentType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate assignment type
    if (!['pickup', 'delivery'].includes(assignmentType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid assignment type' },
        { status: 400 }
      )
    }

    // Get the next sequence number for this truckload
    const sequenceResult = await query(
      `SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_sequence
       FROM truckload_order_assignments
       WHERE truckload_id = $1`,
      [truckloadId]
    )
    const nextSequence = sequenceResult.rows[0].next_sequence

    // Begin transaction
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Insert the assignment
      await client.query(
        `INSERT INTO truckload_order_assignments (
          truckload_id,
          order_id,
          assignment_type,
          sequence_number,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [truckloadId, orderId, assignmentType, nextSequence]
      )

      // Check if this creates a transfer order (both pickup and delivery in same truckload)
      const transferCheck = await client.query(
        `SELECT COUNT(*) as count
         FROM truckload_order_assignments
         WHERE order_id = $1 
         AND truckload_id = $2
         AND assignment_type != $3`,
        [orderId, truckloadId, assignmentType]
      )

      const isTransfer = transferCheck.rows[0].count > 0

      // Update the order status and transfer flag
      await client.query(
        `UPDATE orders
         SET status = $1,
             is_transfer_order = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [assignmentType === 'pickup' ? 'pickup_assigned' : 'delivery_assigned', isTransfer, orderId]
      )

      await client.query('COMMIT')

      return NextResponse.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error assigning order to truckload:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/truckloads/assign - Unassign an order from a truckload
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, assignmentType } = body

    if (!orderId || !assignmentType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate assignment type
    if (!['pickup', 'delivery'].includes(assignmentType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid assignment type' },
        { status: 400 }
      )
    }

    // Begin transaction
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Get the truckload_id before deleting the assignment
      const truckloadResult = await client.query(
        `SELECT truckload_id
         FROM truckload_order_assignments
         WHERE order_id = $1 AND assignment_type = $2`,
        [orderId, assignmentType]
      )
      
      const truckloadId = truckloadResult.rows[0]?.truckload_id

      // Delete the assignment
      await client.query(
        `DELETE FROM truckload_order_assignments
         WHERE order_id = $1 AND assignment_type = $2`,
        [orderId, assignmentType]
      )

      // Check remaining assignments - we want to know:
      // 1. If there are any assignments left at all
      // 2. If both pickup and delivery are assigned to the same truckload
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

      const { 
        total_count, 
        pickup_count,
        delivery_count,
        distinct_truckloads 
      } = remainingAssignments.rows[0]

      // An order is a transfer only if:
      // 1. Both pickup and delivery are assigned (pickup_count = 1 and delivery_count = 1)
      // 2. They are assigned to the same truckload (distinct_truckloads = 1)
      const isTransfer = total_count === 2 && distinct_truckloads === 1

      // Update order status and transfer flag
      await client.query(
        `UPDATE orders
         SET status = $1,
             is_transfer_order = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [
          total_count === 0 ? 'unassigned' : (
            pickup_count > 0 ? 'pickup_assigned' : 'delivery_assigned'
          ),
          isTransfer,
          orderId
        ]
      )

      await client.query('COMMIT')

      return NextResponse.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error unassigning order from truckload:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
} 