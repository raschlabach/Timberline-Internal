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
      const assignmentResult = await client.query(
        `INSERT INTO truckload_order_assignments (
          truckload_id,
          order_id,
          assignment_type,
          sequence_number,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id`,
        [truckloadId, orderId, assignmentType, nextSequence]
      )
      const newAssignmentId = assignmentResult.rows[0].id

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

      // Check for split_loads config and apply it if this completes the split
      const splitLoadCheck = await client.query(`
        SELECT 
          sl.*,
          o.freight_quote,
          dc.customer_name as delivery_customer_name,
          pc.customer_name as pickup_customer_name
        FROM split_loads sl
        JOIN orders o ON sl.order_id = o.id
        LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
        LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
        WHERE sl.order_id = $1
      `, [orderId])

      if (splitLoadCheck.rows.length > 0) {
        const splitLoad = splitLoadCheck.rows[0]
        const fullQuote = parseFloat(splitLoad.freight_quote) || 0
        const miscAmount = parseFloat(splitLoad.misc_value)
        const fullQuoteAmount = fullQuote - miscAmount

        // Check if both assignments now exist
        const bothAssignmentsCheck = await client.query(`
          SELECT 
            COUNT(*) FILTER (WHERE assignment_type = 'pickup') as pickup_count,
            COUNT(*) FILTER (WHERE assignment_type = 'delivery') as delivery_count
          FROM truckload_order_assignments
          WHERE order_id = $1
        `, [orderId])

        const { pickup_count, delivery_count } = bothAssignmentsCheck.rows[0]

        if (pickup_count > 0 && delivery_count > 0) {
          // Both assignments exist - apply split load
          const isNewAssignmentFull = splitLoad.full_quote_assignment === assignmentType
        const newAssignmentQuote = isNewAssignmentFull ? fullQuoteAmount : miscAmount
        const existingAssignmentQuote = isNewAssignmentFull ? miscAmount : fullQuoteAmount

          // Get existing assignment
          const existingAssignmentResult = await client.query(`
            SELECT id, truckload_id, assignment_type
            FROM truckload_order_assignments
            WHERE order_id = $1
              AND assignment_type != $2
            ORDER BY created_at DESC
            LIMIT 1
          `, [orderId, assignmentType])

          if (existingAssignmentResult.rows.length > 0) {
            const existingAssignment = existingAssignmentResult.rows[0]

        // Update both assignment quotes
        await client.query(`
          UPDATE truckload_order_assignments
              SET assignment_quote = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newAssignmentQuote, newAssignmentId])

        await client.query(`
          UPDATE truckload_order_assignments
              SET assignment_quote = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            `, [existingAssignmentQuote, existingAssignment.id])

            // Get customer names
            const fullQuoteCustomerName = splitLoad.full_quote_assignment === 'pickup'
              ? splitLoad.pickup_customer_name
              : splitLoad.delivery_customer_name
            const miscCustomerName = splitLoad.full_quote_assignment === 'pickup'
              ? splitLoad.delivery_customer_name
              : splitLoad.pickup_customer_name

            const fullQuoteTruckloadId = isNewAssignmentFull ? truckloadId : existingAssignment.truckload_id
            const miscTruckloadId = isNewAssignmentFull ? existingAssignment.truckload_id : truckloadId

            // Delete old deductions for this split load
          await client.query(`
            DELETE FROM cross_driver_freight_deductions
              WHERE split_load_id = $1
            `, [splitLoad.id])

            // Create new deductions/additions
        const fullQuoteDeductionComment = `${miscCustomerName} split load (misc portion)`
            const miscAdditionComment = `${fullQuoteCustomerName} split load (misc portion)`

            // Deduction on full quote truckload
          await client.query(`
            INSERT INTO cross_driver_freight_deductions (
                truckload_id, order_id, split_load_id, deduction, comment,
                is_manual, is_addition, applies_to, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, true, false, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [fullQuoteTruckloadId, orderId, splitLoad.id, miscAmount, fullQuoteDeductionComment, splitLoad.full_quote_applies_to])

            // Addition on misc truckload
          await client.query(`
            INSERT INTO cross_driver_freight_deductions (
                truckload_id, order_id, split_load_id, deduction, comment,
                is_manual, is_addition, applies_to, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, true, true, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [miscTruckloadId, orderId, splitLoad.id, miscAmount, miscAdditionComment, splitLoad.misc_applies_to])
          }
        }
        // If only one assignment exists, split_loads config remains for later
      }

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

      // Handle split load cleanup
      const splitLoadCheck = await client.query(`
        SELECT id FROM split_loads WHERE order_id = $1
      `, [orderId])

      if (splitLoadCheck.rows.length > 0) {
        const splitLoadId = splitLoadCheck.rows[0].id

        if (total_count === 0) {
          // Both assignments deleted - delete split_loads record (cascade will clean deductions)
          await client.query(`
            DELETE FROM split_loads WHERE id = $1
          `, [splitLoadId])
        } else if (total_count === 1) {
          // Only one assignment remains - clear assignment_quote but keep split_loads config
          await client.query(`
            UPDATE truckload_order_assignments
            SET assignment_quote = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $1
          `, [orderId])
          // Deductions will be cleaned up by cascade when split_loads is eventually deleted
        }
        // If both assignments still exist, keep everything as is
      }

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