import { NextRequest, NextResponse } from 'next/server'
import { query, getClient, runMigrations } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/orders/[id]/split-load - Get split load info for a specific order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = parseInt(params.id)
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
    }

    // Ensure migrations have run (creates split_loads table if needed)
    try {
      await runMigrations()
    } catch (migrationError) {
      console.error('Migration error (non-fatal):', migrationError)
      // Continue - table might already exist or migration might have partially run
    }

    // Get split load config from split_loads table
    // Use a try-catch to handle case where table doesn't exist yet
    let splitLoadResult = { rows: [] }
    try {
      const result = await query(`
        SELECT 
          id,
          order_id,
          misc_value,
          full_quote_assignment,
          full_quote_applies_to,
          misc_applies_to
        FROM split_loads
        WHERE order_id = $1
      `, [orderId])
      splitLoadResult = result
    } catch (tableError: any) {
      // If table doesn't exist (PostgreSQL error code 42P01), return empty result
      if (tableError?.code === '42P01' || 
          tableError?.message?.includes('does not exist') ||
          tableError?.message?.includes('relation') && tableError?.message?.includes('split_loads')) {
        console.log('split_loads table does not exist yet, returning empty result')
        splitLoadResult = { rows: [] }
      } else {
        // Re-throw other errors
        console.error('Error querying split_loads table:', tableError)
        throw tableError
      }
    }

    // Get order info
    const orderResult = await query(`
      SELECT 
        o.freight_quote,
        dc.customer_name as delivery_customer_name,
        pc.customer_name as pickup_customer_name,
        (
          SELECT json_build_object(
            'assignmentId', toa_pickup.id,
            'truckloadId', t_pickup.id,
            'assignmentQuote', toa_pickup.assignment_quote,
            'driverName', u_pickup.full_name
          )
          FROM truckload_order_assignments toa_pickup
          JOIN truckloads t_pickup ON toa_pickup.truckload_id = t_pickup.id
          LEFT JOIN users u_pickup ON t_pickup.driver_id = u_pickup.id
          WHERE toa_pickup.order_id = o.id
            AND toa_pickup.assignment_type = 'pickup'
          ORDER BY t_pickup.start_date DESC
          LIMIT 1
        ) as pickup_assignment,
        (
          SELECT json_build_object(
            'assignmentId', toa_delivery.id,
            'truckloadId', t_delivery.id,
            'assignmentQuote', toa_delivery.assignment_quote,
            'driverName', u_delivery.full_name
          )
          FROM truckload_order_assignments toa_delivery
          JOIN truckloads t_delivery ON toa_delivery.truckload_id = t_delivery.id
          LEFT JOIN users u_delivery ON t_delivery.driver_id = u_delivery.id
          WHERE toa_delivery.order_id = o.id
            AND toa_delivery.assignment_type = 'delivery'
          ORDER BY t_delivery.start_date DESC
          LIMIT 1
        ) as delivery_assignment
      FROM orders o
      LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
      LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
      WHERE o.id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const order = orderResult.rows[0]
    const hasSplitLoad = splitLoadResult.rows.length > 0

    return NextResponse.json({
      success: true,
      order: {
        orderId,
        hasSplitLoad,
        fullQuote: parseFloat(order.freight_quote) || 0,
        pickupAssignment: order.pickup_assignment,
        deliveryAssignment: order.delivery_assignment,
        existingSplitLoadAppliesTo: hasSplitLoad ? {
          fullQuoteAppliesTo: splitLoadResult.rows[0].full_quote_applies_to,
          miscAppliesTo: splitLoadResult.rows[0].misc_applies_to
        } : null,
        splitLoad: hasSplitLoad ? {
          id: splitLoadResult.rows[0].id,
          miscValue: parseFloat(splitLoadResult.rows[0].misc_value) || 0,
          fullQuoteAssignment: splitLoadResult.rows[0].full_quote_assignment,
          fullQuoteAppliesTo: splitLoadResult.rows[0].full_quote_applies_to,
          miscAppliesTo: splitLoadResult.rows[0].misc_applies_to
        } : null
      }
    })
  } catch (error) {
    console.error('Error fetching split load:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch split load',
      details: errorMessage
    }, { status: 500 })
  }
}

// POST /api/orders/[id]/split-load - Save split load config (SIMPLIFIED)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = parseInt(params.id)
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
    }

    const data = await request.json()
    const { miscValue, fullQuoteAssignment, fullQuoteAppliesTo, miscAppliesTo } = data

    if (!miscValue || miscValue <= 0) {
      return NextResponse.json({ success: false, error: 'Misc value must be greater than 0' }, { status: 400 })
    }

    if (!fullQuoteAssignment || !['pickup', 'delivery'].includes(fullQuoteAssignment)) {
      return NextResponse.json({ success: false, error: 'fullQuoteAssignment must be "pickup" or "delivery"' }, { status: 400 })
    }

    const fullQuoteAppliesToValue = fullQuoteAppliesTo && ['load_value', 'driver_pay'].includes(fullQuoteAppliesTo) 
      ? fullQuoteAppliesTo 
      : 'driver_pay'
    const miscAppliesToValue = miscAppliesTo && ['load_value', 'driver_pay'].includes(miscAppliesTo) 
      ? miscAppliesTo 
      : 'driver_pay'

    const miscAmount = parseFloat(miscValue)

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      // Get order info
      const orderResult = await client.query(`
        SELECT 
          o.freight_quote,
          dc.customer_name as delivery_customer_name,
          pc.customer_name as pickup_customer_name,
          (
            SELECT json_build_object(
              'assignmentId', toa_pickup.id,
              'truckloadId', t_pickup.id,
              'assignmentQuote', toa_pickup.assignment_quote
            )
            FROM truckload_order_assignments toa_pickup
            JOIN truckloads t_pickup ON toa_pickup.truckload_id = t_pickup.id
            WHERE toa_pickup.order_id = o.id
              AND toa_pickup.assignment_type = 'pickup'
            ORDER BY t_pickup.start_date DESC
            LIMIT 1
          ) as pickup_assignment,
          (
            SELECT json_build_object(
              'assignmentId', toa_delivery.id,
              'truckloadId', t_delivery.id,
              'assignmentQuote', toa_delivery.assignment_quote
            )
            FROM truckload_order_assignments toa_delivery
            JOIN truckloads t_delivery ON toa_delivery.truckload_id = t_delivery.id
            WHERE toa_delivery.order_id = o.id
              AND toa_delivery.assignment_type = 'delivery'
            ORDER BY t_delivery.start_date DESC
            LIMIT 1
          ) as delivery_assignment
        FROM orders o
        LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
        LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
        WHERE o.id = $1
      `, [orderId])

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found')
      }

      const order = orderResult.rows[0]
      const fullQuote = parseFloat(order.freight_quote) || 0
      const pickupAssignment = order.pickup_assignment
      const deliveryAssignment = order.delivery_assignment

      // Validation checks
      if (fullQuote <= 0) {
        throw new Error('Order must have a valid freight quote greater than 0')
      }

      if (miscAmount >= fullQuote) {
        throw new Error(`Misc value ($${miscAmount.toFixed(2)}) must be less than full quote ($${fullQuote.toFixed(2)})`)
      }

      const hasBothAssignments = pickupAssignment && deliveryAssignment

      if (hasBothAssignments) {
        // Verify both assignments are on different truckloads (not a transfer)
        if (pickupAssignment.truckloadId === deliveryAssignment.truckloadId) {
          throw new Error('Cannot create split load: both assignments must be on different truckloads. Transfer orders cannot be split loads.')
        }
      }

      if (hasBothAssignments) {
        // Both assignments exist - apply split load immediately
        const fullQuoteAmount = fullQuote - miscAmount
        const miscQuoteAmount = miscAmount

        const assignmentThatGetsFull = fullQuoteAssignment === 'pickup' ? pickupAssignment : deliveryAssignment
        const assignmentThatGetsMisc = fullQuoteAssignment === 'pickup' ? deliveryAssignment : pickupAssignment

        const fullQuoteAssignmentId = assignmentThatGetsFull.assignmentId
        const miscQuoteAssignmentId = assignmentThatGetsMisc.assignmentId
        const fullQuoteTruckloadId = assignmentThatGetsFull.truckloadId
        const miscQuoteTruckloadId = assignmentThatGetsMisc.truckloadId

        const fullQuoteCustomerName = fullQuoteAssignment === 'pickup' 
          ? order.pickup_customer_name 
          : order.delivery_customer_name
        const miscQuoteCustomerName = fullQuoteAssignment === 'pickup' 
          ? order.delivery_customer_name 
          : order.pickup_customer_name

        // Update assignment quotes
        await client.query(`
          UPDATE truckload_order_assignments
          SET assignment_quote = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [fullQuoteAmount, fullQuoteAssignmentId])

        await client.query(`
          UPDATE truckload_order_assignments
          SET assignment_quote = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [miscQuoteAmount, miscQuoteAssignmentId])

        // Save or update split_loads config
        const splitLoadResult = await client.query(`
          INSERT INTO split_loads (
            order_id, misc_value, full_quote_assignment, 
            full_quote_applies_to, misc_applies_to, 
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (order_id) 
          DO UPDATE SET
            misc_value = EXCLUDED.misc_value,
            full_quote_assignment = EXCLUDED.full_quote_assignment,
            full_quote_applies_to = EXCLUDED.full_quote_applies_to,
            misc_applies_to = EXCLUDED.misc_applies_to,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [orderId, miscAmount, fullQuoteAssignment, fullQuoteAppliesToValue, miscAppliesToValue])

        const splitLoadId = splitLoadResult.rows[0].id

        // Delete old deductions for this split load (cascade will handle, but explicit for clarity)
        await client.query(`
          DELETE FROM cross_driver_freight_deductions
          WHERE split_load_id = $1
        `, [splitLoadId])

        // Create deductions/additions
        const fullQuoteDeductionComment = `${miscQuoteCustomerName} split load (misc portion)`
        const miscQuoteAdditionComment = `${fullQuoteCustomerName} split load (misc portion)`

        // Deduction on full quote truckload
        await client.query(`
          INSERT INTO cross_driver_freight_deductions (
            truckload_id, order_id, split_load_id, deduction, comment,
            is_manual, is_addition, applies_to, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, true, false, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [fullQuoteTruckloadId, orderId, splitLoadId, miscAmount, fullQuoteDeductionComment, fullQuoteAppliesToValue])

        // Addition on misc truckload
        await client.query(`
          INSERT INTO cross_driver_freight_deductions (
            truckload_id, order_id, split_load_id, deduction, comment,
            is_manual, is_addition, applies_to, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, true, true, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [miscQuoteTruckloadId, orderId, splitLoadId, miscAmount, miscQuoteAdditionComment, miscAppliesToValue])
      } else {
        // Only one assignment exists - just save config for later
        await client.query(`
          INSERT INTO split_loads (
            order_id, misc_value, full_quote_assignment, 
            full_quote_applies_to, misc_applies_to, 
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (order_id) 
          DO UPDATE SET
            misc_value = EXCLUDED.misc_value,
            full_quote_assignment = EXCLUDED.full_quote_assignment,
            full_quote_applies_to = EXCLUDED.full_quote_applies_to,
            misc_applies_to = EXCLUDED.misc_applies_to,
            updated_at = CURRENT_TIMESTAMP
        `, [orderId, miscAmount, fullQuoteAssignment, fullQuoteAppliesToValue, miscAppliesToValue])
      }

      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true,
        message: hasBothAssignments 
          ? 'Split load updated successfully'
          : 'Split load configured. Will be applied when the missing assignment is created.'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating split load:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to update split load',
      details: errorMessage
    }, { status: 500 })
  }
}

// DELETE /api/orders/[id]/split-load - Clear split load (SIMPLIFIED)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = parseInt(params.id)
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      // Get assignments to clear quotes
      const assignmentsResult = await client.query(`
        SELECT id FROM truckload_order_assignments WHERE order_id = $1
      `, [orderId])

      const assignmentIds = assignmentsResult.rows.map(r => r.id)

      // Clear assignment quotes
      if (assignmentIds.length > 0) {
        await client.query(`
          UPDATE truckload_order_assignments
          SET assignment_quote = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[])
        `, [assignmentIds])
      }

      // Delete split_loads record - cascade will automatically delete all related deductions
      await client.query(`
        DELETE FROM split_loads WHERE order_id = $1
      `, [orderId])

      // Also delete any old split load deductions that might not have split_load_id (cleanup)
      await client.query(`
        DELETE FROM cross_driver_freight_deductions
        WHERE order_id = $1
          AND comment LIKE '%split load%'
          AND is_manual = true
          AND split_load_id IS NULL
      `, [orderId])

      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true,
        message: 'Split load cleared successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error clearing split load:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear split load'
    }, { status: 500 })
  }
}

