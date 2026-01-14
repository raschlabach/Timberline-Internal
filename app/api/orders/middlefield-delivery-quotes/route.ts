import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/orders/middlefield-delivery-quotes - Update split quotes and create deductions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { updates } = data // Array of { orderId, splitQuote, otherTruckloadId, assignmentType, customerName }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Updates array is required' }, { status: 400 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      for (const update of updates) {
        const { orderId, splitQuote, otherTruckloadId, assignmentType, customerName } = update

        if (!orderId) {
          throw new Error('orderId is required')
        }

        if (!otherTruckloadId) {
          throw new Error('otherTruckloadId is required')
        }

        if (!assignmentType) {
          throw new Error('assignmentType is required')
        }

        const newAssignmentQuote = splitQuote ? parseFloat(splitQuote) : null
        const customerNameForDeduction = customerName || 'Unknown Customer'

        // Get the assignment ID for this order and assignment type
        const assignmentResult = await client.query(`
          SELECT id, truckload_id
          FROM truckload_order_assignments
          WHERE order_id = $1 AND assignment_type = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [orderId, assignmentType])

        if (assignmentResult.rows.length === 0) {
          throw new Error(`Assignment not found for order ${orderId} with type ${assignmentType}`)
        }

        const assignmentId = assignmentResult.rows[0].id
        const currentTruckloadId = assignmentResult.rows[0].truckload_id

        // Get the order's full quote to calculate deduction amount
        const orderResult = await client.query(`
          SELECT freight_quote FROM orders WHERE id = $1
        `, [orderId])

        if (orderResult.rows.length === 0) {
          throw new Error(`Order ${orderId} not found`)
        }

        const fullQuote = parseFloat(orderResult.rows[0].freight_quote) || 0
        const deductionAmount = newAssignmentQuote !== null && newAssignmentQuote > 0 
          ? (fullQuote - newAssignmentQuote)
          : null

        // Update the assignment's quote
        await client.query(`
          UPDATE truckload_order_assignments
          SET assignment_quote = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newAssignmentQuote, assignmentId])

        // Handle deduction: delete existing if assignment quote is cleared, or update/create if set
        if (newAssignmentQuote === null || newAssignmentQuote <= 0) {
          // Delete existing deduction if assignment quote is cleared
            await client.query(`
              DELETE FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
                AND applies_to = 'driver_pay'
            `, [otherTruckloadId, customerNameForDeduction])
        } else if (deductionAmount !== null && deductionAmount > 0) {
          // Check if deduction already exists
          const existingDeduction = await client.query(`
              SELECT id
              FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
                AND applies_to = 'driver_pay'
              LIMIT 1
            `, [otherTruckloadId, customerNameForDeduction])

          const comment = `${customerNameForDeduction} split load`

          if (existingDeduction.rows.length > 0) {
            // Update existing deduction
            await client.query(`
              UPDATE cross_driver_freight_deductions
              SET deduction = $1,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [deductionAmount, existingDeduction.rows[0].id])
          } else {
            // Create new deduction
              await client.query(`
                INSERT INTO cross_driver_freight_deductions (
                  truckload_id,
                order_id,
                  deduction,
                comment,
                  is_manual,
                  is_addition,
                applies_to,
                created_at,
                updated_at
              ) VALUES ($1, $2, $3, $4, true, false, 'driver_pay', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [otherTruckloadId, orderId, deductionAmount, comment])
          }
        }
      }

      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true,
        message: `Updated ${updates.length} assignment quote(s)`
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating assignment quotes:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to update assignment quotes',
      details: errorMessage
    }, { status: 500 })
  }
}
