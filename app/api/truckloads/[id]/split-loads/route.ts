import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/truckloads/[id]/split-loads - Get all split load orders for a truckload
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const includeOrderId = searchParams.get('includeOrderId')
    const includeOrderIdNum = includeOrderId ? parseInt(includeOrderId, 10) : null

    // Check if applies_to column exists
    const appliesToCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cross_driver_freight_deductions'
      AND column_name = 'applies_to'
    `)
    const hasAppliesTo = appliesToCheck.rows.length > 0

    // Get all orders in this truckload that have assignment_quote set OR are middlefield orders
    const sqlQuery = `
      SELECT 
        o.id as "orderId",
        toa.id as "assignmentId",
        toa.assignment_type as "assignmentType",
        o.freight_quote as "fullQuote",
        toa.assignment_quote as "assignmentQuote",
        dc.customer_name as "deliveryCustomerName",
        pc.customer_name as "pickupCustomerName",
        -- Find the other assignment (pickup if viewing delivery, delivery if viewing pickup)
        (
          SELECT toa_other.id
          FROM truckload_order_assignments toa_other
          WHERE toa_other.order_id = o.id
            AND toa_other.assignment_type != toa.assignment_type
          ORDER BY toa_other.created_at DESC
          LIMIT 1
        ) as "otherAssignmentId",
        -- Find the other truckload ID
        (
          SELECT t.id
          FROM truckload_order_assignments toa_other
          JOIN truckloads t ON toa_other.truckload_id = t.id
          WHERE toa_other.order_id = o.id
            AND toa_other.assignment_type != toa.assignment_type
          ORDER BY t.start_date DESC
          LIMIT 1
        ) as "otherTruckloadId",
        -- Check if deduction already exists on the other truckload
        (
          SELECT COUNT(*)
          FROM cross_driver_freight_deductions cdfd
          WHERE cdfd.truckload_id = (
            SELECT t.id
            FROM truckload_order_assignments toa_other
            JOIN truckloads t ON toa_other.truckload_id = t.id
            WHERE toa_other.order_id = o.id
              AND toa_other.assignment_type != toa.assignment_type
            ORDER BY t.start_date DESC
            LIMIT 1
          )
          AND cdfd.comment LIKE '%' || COALESCE(
            CASE WHEN toa.assignment_type = 'delivery' THEN dc.customer_name ELSE pc.customer_name END,
            ''
          ) || '%split load%'
          AND cdfd.is_manual = true
          ${hasAppliesTo ? "AND cdfd.applies_to = 'driver_pay'" : ''}
        ) as "hasDeduction",
        -- Track if this is automatically included (middlefield) or manually added
        (o.middlefield = true AND (o.backhaul = true OR o.oh_to_in = true)) as "isAutoIncluded"
      FROM truckload_order_assignments toa
      JOIN orders o ON toa.order_id = o.id
      LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
      LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
      WHERE toa.truckload_id = $1
        AND (
          -- Automatically include middlefield orders
          (o.middlefield = true AND (o.backhaul = true OR o.oh_to_in = true))
          -- OR manually added orders (have an assignment_quote set)
          OR (toa.assignment_quote IS NOT NULL AND toa.assignment_quote > 0)
          ${includeOrderIdNum ? 'OR o.id = $2' : ''}
        )
      ORDER BY o.id
    `

    const queryParams = includeOrderIdNum ? [truckloadId, includeOrderIdNum] : [truckloadId]
    const result = await query(sqlQuery, queryParams)

    return NextResponse.json({
      success: true,
      orders: result.rows
    })
  } catch (error) {
    console.error('Error fetching split load orders:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch split load orders'
    }, { status: 500 })
  }
}

// POST /api/truckloads/[id]/split-loads - Update assignment quotes and create deductions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { updates } = data // Array of { assignmentId, assignmentQuote, otherTruckloadId, customerName }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Updates array is required' }, { status: 400 })
    }

    // Check if applies_to column exists
    const appliesToCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cross_driver_freight_deductions'
      AND column_name = 'applies_to'
    `)
    const hasAppliesTo = appliesToCheck.rows.length > 0

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      for (const update of updates) {
        const { assignmentId, assignmentQuote, otherTruckloadId, customerName } = update

        if (!assignmentId) {
          throw new Error('assignmentId is required')
        }

        if (!otherTruckloadId) {
          throw new Error('otherTruckloadId is required')
        }

        const newAssignmentQuote = assignmentQuote ? parseFloat(assignmentQuote) : null
        const customerNameForDeduction = customerName || 'Unknown Customer'

        // Get the order's full quote to calculate deduction amount
        const orderResult = await client.query(`
          SELECT o.freight_quote
          FROM truckload_order_assignments toa
          JOIN orders o ON toa.order_id = o.id
          WHERE toa.id = $1
        `, [assignmentId])

        if (orderResult.rows.length === 0) {
          throw new Error(`Assignment ${assignmentId} not found`)
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
          if (hasAppliesTo) {
            await client.query(`
              DELETE FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
                AND applies_to = 'driver_pay'
            `, [otherTruckloadId, customerNameForDeduction])
          } else {
            await client.query(`
              DELETE FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
            `, [otherTruckloadId, customerNameForDeduction])
          }
        } else if (deductionAmount !== null && deductionAmount > 0) {
          // Check if deduction already exists
          let existingDeduction
          if (hasAppliesTo) {
            existingDeduction = await client.query(`
              SELECT id
              FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
                AND applies_to = 'driver_pay'
              LIMIT 1
            `, [otherTruckloadId, customerNameForDeduction])
          } else {
            existingDeduction = await client.query(`
              SELECT id
              FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
              LIMIT 1
            `, [otherTruckloadId, customerNameForDeduction])
          }

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
                ) VALUES ($1, $2, $3, true, false, 'driver_pay', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `, [otherTruckloadId, deductionAmount, comment])
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
              `, [otherTruckloadId, deductionAmount, comment])
            }
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

