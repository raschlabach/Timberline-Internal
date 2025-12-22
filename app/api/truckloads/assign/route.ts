import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

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

    // Check if pending_split_loads table exists, if not, apply migration
    try {
      const tableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pending_split_loads'
      `)
      
      const hasPendingSplitLoadsTable = tableCheck.rows.length > 0
      
      if (!hasPendingSplitLoadsTable) {
        console.log('Applying pending_split_loads migration...')
        const migrationClient = await getClient()
        try {
          await migrationClient.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-pending-split-loads.sql'),
            'utf8'
          )
          await migrationClient.query(migrationSql)
          await migrationClient.query('COMMIT')
          console.log('pending_split_loads migration applied successfully')
        } catch (migrationError) {
          await migrationClient.query('ROLLBACK')
          console.error('Error applying pending_split_loads migration:', migrationError)
        } finally {
          migrationClient.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking/applying pending_split_loads migration:', migrationCheckError)
    }

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

      // Check for pending split load and apply it if this completes the split
      const pendingSplitCheck = await client.query(`
        SELECT 
          psl.*,
          o.freight_quote,
          dc.customer_name as delivery_customer_name,
          pc.customer_name as pickup_customer_name
        FROM pending_split_loads psl
        JOIN orders o ON psl.order_id = o.id
        LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
        LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
        WHERE psl.order_id = $1
      `, [orderId])

      if (pendingSplitCheck.rows.length > 0) {
        const pendingSplit = pendingSplitCheck.rows[0]
        const fullQuote = parseFloat(pendingSplit.freight_quote) || 0
        const miscAmount = parseFloat(pendingSplit.misc_value)
        const fullQuoteAmount = fullQuote - miscAmount

        // Check if applies_to column exists
        const appliesToCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'cross_driver_freight_deductions'
          AND column_name = 'applies_to'
        `)
        const hasAppliesTo = appliesToCheck.rows.length > 0

        // Determine which assignment gets which quote
        const isNewAssignmentFull = pendingSplit.full_quote_assignment === assignmentType
        const newAssignmentQuote = isNewAssignmentFull ? fullQuoteAmount : miscAmount
        const existingAssignmentQuote = isNewAssignmentFull ? miscAmount : fullQuoteAmount

        // Update both assignment quotes
        await client.query(`
          UPDATE truckload_order_assignments
          SET assignment_quote = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newAssignmentQuote, newAssignmentId])

        await client.query(`
          UPDATE truckload_order_assignments
          SET assignment_quote = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [existingAssignmentQuote, pendingSplit.existing_assignment_id])

        // Get customer names for deductions
        const fullQuoteCustomerName = pendingSplit.full_quote_assignment === 'pickup'
          ? pendingSplit.pickup_customer_name
          : pendingSplit.delivery_customer_name
        const miscCustomerName = pendingSplit.full_quote_assignment === 'pickup'
          ? pendingSplit.delivery_customer_name
          : pendingSplit.pickup_customer_name

        // Get truckload IDs
        const existingTruckloadResult = await client.query(`
          SELECT truckload_id
          FROM truckload_order_assignments
          WHERE id = $1
        `, [pendingSplit.existing_assignment_id])
        const existingTruckloadId = existingTruckloadResult.rows[0].truckload_id

        // Delete existing deductions for this order
        if (hasAppliesTo) {
          await client.query(`
            DELETE FROM cross_driver_freight_deductions
            WHERE truckload_id IN ($1, $2)
              AND comment LIKE '%split load%'
              AND is_manual = true
              AND applies_to = 'driver_pay'
          `, [truckloadId, existingTruckloadId])
        } else {
          await client.query(`
            DELETE FROM cross_driver_freight_deductions
            WHERE truckload_id IN ($1, $2)
              AND comment LIKE '%split load%'
              AND is_manual = true
          `, [truckloadId, existingTruckloadId])
        }

        // Create deductions/additions on both truckloads
        // Full quote truckload gets deduction
        const fullQuoteDeductionComment = `${miscCustomerName} split load (misc portion)`
        if (hasAppliesTo) {
          await client.query(`
            INSERT INTO cross_driver_freight_deductions (
              truckload_id,
              deduction,
              comment,
              is_manual,
              is_addition,
              applies_to,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, true, false, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            isNewAssignmentFull ? truckloadId : existingTruckloadId,
            miscAmount,
            fullQuoteDeductionComment,
            pendingSplit.full_quote_applies_to
          ])
        } else {
          await client.query(`
            INSERT INTO cross_driver_freight_deductions (
              truckload_id,
              deduction,
              comment,
              is_manual,
              is_addition,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            isNewAssignmentFull ? truckloadId : existingTruckloadId,
            miscAmount,
            fullQuoteDeductionComment
          ])
        }

        // Misc truckload gets addition
        const miscAdditionComment = `${fullQuoteCustomerName} split load (misc portion)`
        if (hasAppliesTo) {
          await client.query(`
            INSERT INTO cross_driver_freight_deductions (
              truckload_id,
              deduction,
              comment,
              is_manual,
              is_addition,
              applies_to,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, true, true, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            isNewAssignmentFull ? existingTruckloadId : truckloadId,
            miscAmount,
            miscAdditionComment,
            pendingSplit.misc_applies_to
          ])
        } else {
          await client.query(`
            INSERT INTO cross_driver_freight_deductions (
              truckload_id,
              deduction,
              comment,
              is_manual,
              is_addition,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            isNewAssignmentFull ? existingTruckloadId : truckloadId,
            miscAmount,
            miscAdditionComment
          ])
        }

        // Delete pending split load
        await client.query(`
          DELETE FROM pending_split_loads
          WHERE order_id = $1
        `, [orderId])
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