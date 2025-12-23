import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/orders/[id]/split-load-simple - Get split load config for an order
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

    // Check if split_loads table exists
    const tableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'split_loads'
    `)
    
    if (tableCheck.rows.length === 0) {
      // Table doesn't exist yet, return empty
      return NextResponse.json({
        success: true,
        order: {
          orderId,
          hasSplitLoad: false,
          splitLoad: null
        }
      })
    }

    // Get split load config
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

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        order: {
          orderId,
          hasSplitLoad: false,
          splitLoad: null
        }
      })
    }

    const splitLoad = result.rows[0]
    
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
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const order = orderResult.rows[0]

    return NextResponse.json({
      success: true,
      order: {
        orderId,
        hasSplitLoad: true,
        fullQuote: parseFloat(order.freight_quote) || 0,
        pickupAssignment: order.pickup_assignment,
        deliveryAssignment: order.delivery_assignment,
        splitLoad: {
          id: splitLoad.id,
          miscValue: parseFloat(splitLoad.misc_value) || 0,
          fullQuoteAssignment: splitLoad.full_quote_assignment,
          fullQuoteAppliesTo: splitLoad.full_quote_applies_to,
          miscAppliesTo: splitLoad.misc_applies_to
        }
      }
    })
  } catch (error) {
    console.error('Error fetching split load:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch split load'
    }, { status: 500 })
  }
}

// POST /api/orders/[id]/split-load-simple - Save split load config
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

      // Check if split_loads table exists, create if not
      const tableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'split_loads'
      `)
      
      if (tableCheck.rows.length === 0) {
        // Apply migration
        const migrationSql = `
          CREATE TABLE IF NOT EXISTS split_loads (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            misc_value DECIMAL(10, 2) NOT NULL,
            full_quote_assignment VARCHAR(20) NOT NULL,
            full_quote_applies_to VARCHAR(20) NOT NULL DEFAULT 'driver_pay',
            misc_applies_to VARCHAR(20) NOT NULL DEFAULT 'driver_pay',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(order_id)
          );
          CREATE INDEX IF NOT EXISTS idx_split_loads_order ON split_loads(order_id);
          ALTER TABLE cross_driver_freight_deductions
          ADD COLUMN IF NOT EXISTS split_load_id INTEGER REFERENCES split_loads(id) ON DELETE CASCADE;
          CREATE INDEX IF NOT EXISTS idx_deductions_split_load ON cross_driver_freight_deductions(split_load_id);
        `
        await client.query(migrationSql)
      }

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

      const hasBothAssignments = pickupAssignment && deliveryAssignment

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

        // Delete old deductions (cascade will handle this, but we do it explicitly for clarity)
        await client.query(`
          DELETE FROM cross_driver_freight_deductions
          WHERE split_load_id = $1
        `, [splitLoadId])

        // Check if columns exist
        const orderIdCheck = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'cross_driver_freight_deductions'
          AND column_name = 'order_id'
        `)
        const hasOrderId = orderIdCheck.rows.length > 0

        const appliesToCheck = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'cross_driver_freight_deductions'
          AND column_name = 'applies_to'
        `)
        const hasAppliesTo = appliesToCheck.rows.length > 0

        // Create deductions/additions
        const fullQuoteDeductionComment = `${miscQuoteCustomerName} split load (misc portion)`
        const miscQuoteAdditionComment = `${fullQuoteCustomerName} split load (misc portion)`

        if (hasAppliesTo && hasOrderId) {
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
        } else if (hasAppliesTo) {
          await client.query(`
            INSERT INTO cross_driver_freight_deductions (
              truckload_id, split_load_id, deduction, comment,
              is_manual, is_addition, applies_to, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, true, false, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [fullQuoteTruckloadId, splitLoadId, miscAmount, fullQuoteDeductionComment, fullQuoteAppliesToValue])

          await client.query(`
            INSERT INTO cross_driver_freight_deductions (
              truckload_id, split_load_id, deduction, comment,
              is_manual, is_addition, applies_to, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, true, true, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [miscQuoteTruckloadId, splitLoadId, miscAmount, miscQuoteAdditionComment, miscAppliesToValue])
        }
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

// DELETE /api/orders/[id]/split-load-simple - Clear split load
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

      // Delete split_loads record - cascade will delete all related deductions
      await client.query(`
        DELETE FROM split_loads WHERE order_id = $1
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

