import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

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

    // Check if assignment_quote column exists, if not, apply migration
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'truckload_order_assignments'
        AND column_name = 'assignment_quote'
      `)
      
      const hasAssignmentQuote = columnCheck.rows.length > 0
      
      if (!hasAssignmentQuote) {
        console.log('Applying assignment_quote migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-assignment-quote.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('assignment_quote migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying assignment_quote migration:', migrationError)
        } finally {
          client.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking/applying assignment_quote migration:', migrationCheckError)
    }

    // Check if assignment_quote column exists after migration
    const columnCheckAfter = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'truckload_order_assignments'
      AND column_name = 'assignment_quote'
    `)
    const hasAssignmentQuote = columnCheckAfter.rows.length > 0

    // Get order with both pickup and delivery assignments
    let result
    if (hasAssignmentQuote) {
      result = await query(`
        SELECT 
          o.id as "orderId",
          o.freight_quote as "fullQuote",
          dc.customer_name as "deliveryCustomerName",
          pc.customer_name as "pickupCustomerName",
          -- Pickup assignment
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
          ) as "pickupAssignment",
          -- Delivery assignment
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
          ) as "deliveryAssignment"
        FROM orders o
        LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
        LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
        WHERE o.id = $1
      `, [orderId])
    } else {
      // Fallback query if column doesn't exist (shouldn't happen after migration, but just in case)
      result = await query(`
        SELECT 
          o.id as "orderId",
          o.freight_quote as "fullQuote",
          dc.customer_name as "deliveryCustomerName",
          pc.customer_name as "pickupCustomerName",
          -- Pickup assignment
          (
            SELECT json_build_object(
              'assignmentId', toa_pickup.id,
              'truckloadId', t_pickup.id,
              'assignmentQuote', NULL::DECIMAL(10, 2),
              'driverName', u_pickup.full_name
            )
            FROM truckload_order_assignments toa_pickup
            JOIN truckloads t_pickup ON toa_pickup.truckload_id = t_pickup.id
            LEFT JOIN users u_pickup ON t_pickup.driver_id = u_pickup.id
            WHERE toa_pickup.order_id = o.id
              AND toa_pickup.assignment_type = 'pickup'
            ORDER BY t_pickup.start_date DESC
            LIMIT 1
          ) as "pickupAssignment",
          -- Delivery assignment
          (
            SELECT json_build_object(
              'assignmentId', toa_delivery.id,
              'truckloadId', t_delivery.id,
              'assignmentQuote', NULL::DECIMAL(10, 2),
              'driverName', u_delivery.full_name
            )
            FROM truckload_order_assignments toa_delivery
            JOIN truckloads t_delivery ON toa_delivery.truckload_id = t_delivery.id
            LEFT JOIN users u_delivery ON t_delivery.driver_id = u_delivery.id
            WHERE toa_delivery.order_id = o.id
              AND toa_delivery.assignment_type = 'delivery'
            ORDER BY t_delivery.start_date DESC
            LIMIT 1
          ) as "deliveryAssignment"
        FROM orders o
        LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
        LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
        WHERE o.id = $1
      `, [orderId])
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const order = result.rows[0]
    const pickupAssignment = order.pickupAssignment || null
    const deliveryAssignment = order.deliveryAssignment || null

    // Check if either assignment has a quote set (split load exists)
    const hasSplitLoad = (pickupAssignment?.assignmentQuote !== null && pickupAssignment?.assignmentQuote !== undefined) ||
                        (deliveryAssignment?.assignmentQuote !== null && deliveryAssignment?.assignmentQuote !== undefined)

    // Check for pending split load
    const pendingSplitCheck = await query(`
      SELECT 
        psl.*,
        toa.truckload_id as existing_truckload_id
      FROM pending_split_loads psl
      JOIN truckload_order_assignments toa ON psl.existing_assignment_id = toa.id
      WHERE psl.order_id = $1
    `, [orderId])

    const pendingSplit = pendingSplitCheck.rows.length > 0 ? pendingSplitCheck.rows[0] : null

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.orderId,
        fullQuote: order.fullQuote,
        deliveryCustomerName: order.deliveryCustomerName,
        pickupCustomerName: order.pickupCustomerName,
        pickupAssignment,
        deliveryAssignment,
        hasSplitLoad: hasSplitLoad || !!pendingSplit,
        pendingSplit: pendingSplit ? {
          miscValue: pendingSplit.misc_value,
          fullQuoteAssignment: pendingSplit.full_quote_assignment,
          fullQuoteAppliesTo: pendingSplit.full_quote_applies_to,
          miscAppliesTo: pendingSplit.misc_applies_to,
          existingAssignmentType: pendingSplit.existing_assignment_type
        } : null
      }
    })
  } catch (error) {
    console.error('Error fetching split load info:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch split load info'
    }, { status: 500 })
  }
}

// POST /api/orders/[id]/split-load - Set split load for a specific order
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
    const { miscValue, fullQuoteAssignment, fullQuoteAppliesTo, miscAppliesTo } = data // 'pickup' or 'delivery'

    if (!miscValue || miscValue <= 0) {
      return NextResponse.json({ success: false, error: 'Misc value must be greater than 0' }, { status: 400 })
    }

    if (!fullQuoteAssignment || !['pickup', 'delivery'].includes(fullQuoteAssignment)) {
      return NextResponse.json({ success: false, error: 'fullQuoteAssignment must be "pickup" or "delivery"' }, { status: 400 })
    }

    // Validate applies_to values, default to 'driver_pay' if not provided
    const fullQuoteAppliesToValue = fullQuoteAppliesTo && ['load_value', 'driver_pay'].includes(fullQuoteAppliesTo) 
      ? fullQuoteAppliesTo 
      : 'driver_pay'
    const miscAppliesToValue = miscAppliesTo && ['load_value', 'driver_pay'].includes(miscAppliesTo) 
      ? miscAppliesTo 
      : 'driver_pay'

    const miscAmount = parseFloat(miscValue)

    // Check if assignment_quote column exists, if not, apply migration
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'truckload_order_assignments'
        AND column_name = 'assignment_quote'
      `)
      
      const hasAssignmentQuote = columnCheck.rows.length > 0
      
      if (!hasAssignmentQuote) {
        console.log('Applying assignment_quote migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-assignment-quote.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('assignment_quote migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying assignment_quote migration:', migrationError)
        } finally {
          client.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking/applying assignment_quote migration:', migrationCheckError)
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

      // Get order and assignments
      const orderResult = await client.query(`
        SELECT 
          o.freight_quote,
          o.delivery_customer_id,
          o.pickup_customer_id,
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

      // Check if both assignments exist
      const hasBothAssignments = pickupAssignment && deliveryAssignment

      if (hasBothAssignments) {
        // Existing logic: both assignments exist
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
          SET assignment_quote = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [fullQuoteAmount, fullQuoteAssignmentId])

        await client.query(`
          UPDATE truckload_order_assignments
          SET assignment_quote = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [miscQuoteAmount, miscQuoteAssignmentId])

        // Delete existing deductions and pending split loads
        if (hasAppliesTo) {
          await client.query(`
            DELETE FROM cross_driver_freight_deductions
            WHERE truckload_id IN ($1, $2)
              AND comment LIKE '%split load%'
              AND is_manual = true
              AND applies_to = 'driver_pay'
          `, [fullQuoteTruckloadId, miscQuoteTruckloadId])
        } else {
          await client.query(`
            DELETE FROM cross_driver_freight_deductions
            WHERE truckload_id IN ($1, $2)
              AND comment LIKE '%split load%'
              AND is_manual = true
          `, [fullQuoteTruckloadId, miscQuoteTruckloadId])
        }

        // Delete pending split load if it exists
        await client.query(`
          DELETE FROM pending_split_loads
          WHERE order_id = $1
        `, [orderId])

        // Create deductions/additions on both truckloads
        const fullQuoteDeductionComment = `${miscQuoteCustomerName} split load (misc portion)`
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
          `, [fullQuoteTruckloadId, miscAmount, fullQuoteDeductionComment, fullQuoteAppliesToValue])
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
          `, [fullQuoteTruckloadId, miscAmount, fullQuoteDeductionComment])
        }

        const miscQuoteAdditionComment = `${fullQuoteCustomerName} split load (misc portion)`
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
          `, [miscQuoteTruckloadId, miscAmount, miscQuoteAdditionComment, miscAppliesToValue])
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
          `, [miscQuoteTruckloadId, miscAmount, miscQuoteAdditionComment])
        }
      } else {
        // New logic: only one assignment exists - store as pending
        const existingAssignment = pickupAssignment || deliveryAssignment
        if (!existingAssignment) {
          throw new Error('Order must have at least one assignment (pickup or delivery)')
        }

        const existingAssignmentType = pickupAssignment ? 'pickup' : 'delivery'
        const fullQuoteAmount = fullQuote - miscAmount
        const miscQuoteAmount = miscAmount

        // Determine which assignment gets which quote
        let assignmentThatGetsFull, assignmentThatGetsMisc
        if (fullQuoteAssignment === existingAssignmentType) {
          // The existing assignment gets the full quote - misc
          assignmentThatGetsFull = existingAssignment
          assignmentThatGetsMisc = null // Will be created later
        } else {
          // The existing assignment gets the misc value
          assignmentThatGetsFull = null // Will be created later
          assignmentThatGetsMisc = existingAssignment
        }

        // Update the existing assignment's quote
        if (assignmentThatGetsFull) {
          await client.query(`
            UPDATE truckload_order_assignments
            SET assignment_quote = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [fullQuoteAmount, existingAssignment.assignmentId])
        } else {
          await client.query(`
            UPDATE truckload_order_assignments
            SET assignment_quote = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [miscQuoteAmount, existingAssignment.assignmentId])
        }

        // Delete existing pending split load and deductions
        await client.query(`
          DELETE FROM pending_split_loads
          WHERE order_id = $1
        `, [orderId])

        if (hasAppliesTo) {
          await client.query(`
            DELETE FROM cross_driver_freight_deductions
            WHERE truckload_id = $1
              AND comment LIKE '%split load%'
              AND is_manual = true
              AND applies_to = 'driver_pay'
          `, [existingAssignment.truckloadId])
        } else {
          await client.query(`
            DELETE FROM cross_driver_freight_deductions
            WHERE truckload_id = $1
              AND comment LIKE '%split load%'
              AND is_manual = true
          `, [existingAssignment.truckloadId])
        }

        // Create deduction/addition on existing truckload
        const customerName = existingAssignmentType === 'pickup' 
          ? order.pickup_customer_name 
          : order.delivery_customer_name
        const otherCustomerName = existingAssignmentType === 'pickup' 
          ? order.delivery_customer_name 
          : order.pickup_customer_name

        if (assignmentThatGetsFull) {
          // Existing assignment gets full quote - misc, so create deduction
          const deductionComment = `${otherCustomerName} split load (misc portion)`
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
            `, [existingAssignment.truckloadId, miscAmount, deductionComment, fullQuoteAppliesToValue])
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
            `, [existingAssignment.truckloadId, miscAmount, deductionComment])
          }
        } else {
          // Existing assignment gets misc, so create addition
          const additionComment = `${otherCustomerName} split load (misc portion)`
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
            `, [existingAssignment.truckloadId, miscAmount, additionComment, miscAppliesToValue])
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
            `, [existingAssignment.truckloadId, miscAmount, additionComment])
          }
        }

        // Store pending split load configuration
        await client.query(`
          INSERT INTO pending_split_loads (
            order_id,
            existing_assignment_type,
            existing_assignment_id,
            misc_value,
            full_quote_assignment,
            full_quote_applies_to,
            misc_applies_to,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (order_id) 
          DO UPDATE SET
            existing_assignment_type = EXCLUDED.existing_assignment_type,
            existing_assignment_id = EXCLUDED.existing_assignment_id,
            misc_value = EXCLUDED.misc_value,
            full_quote_assignment = EXCLUDED.full_quote_assignment,
            full_quote_applies_to = EXCLUDED.full_quote_applies_to,
            misc_applies_to = EXCLUDED.misc_applies_to,
            updated_at = CURRENT_TIMESTAMP
        `, [
          orderId,
          existingAssignmentType,
          existingAssignment.assignmentId,
          miscAmount,
          fullQuoteAssignment,
          fullQuoteAppliesToValue,
          miscAppliesToValue
        ])
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

// DELETE /api/orders/[id]/split-load - Clear split load for a specific order
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

    // Check if assignment_quote column exists, if not, apply migration
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'truckload_order_assignments'
        AND column_name = 'assignment_quote'
      `)
      
      const hasAssignmentQuote = columnCheck.rows.length > 0
      
      if (!hasAssignmentQuote) {
        console.log('Applying assignment_quote migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-assignment-quote.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('assignment_quote migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying assignment_quote migration:', migrationError)
        } finally {
          client.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking/applying assignment_quote migration:', migrationCheckError)
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

      // Get assignments
      const assignmentsResult = await client.query(`
        SELECT 
          toa.id as assignment_id,
          toa.truckload_id,
          toa.assignment_type
        FROM truckload_order_assignments toa
        WHERE toa.order_id = $1
      `, [orderId])

      const assignmentIds = assignmentsResult.rows.map(r => r.assignment_id)
      const truckloadIds = assignmentsResult.rows.map(r => r.truckload_id)

      // Clear assignment quotes
      await client.query(`
        UPDATE truckload_order_assignments
        SET assignment_quote = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[])
      `, [assignmentIds])

      // Delete pending split loads
      await client.query(`
        DELETE FROM pending_split_loads
        WHERE order_id = $1
      `, [orderId])

      // Delete deductions
      if (hasAppliesTo) {
        await client.query(`
          DELETE FROM cross_driver_freight_deductions
          WHERE truckload_id = ANY($1::int[])
            AND comment LIKE '%split load%'
            AND is_manual = true
            AND applies_to = 'driver_pay'
        `, [truckloadIds])
      } else {
        await client.query(`
          DELETE FROM cross_driver_freight_deductions
          WHERE truckload_id = ANY($1::int[])
            AND comment LIKE '%split load%'
            AND is_manual = true
        `, [truckloadIds])
      }

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

