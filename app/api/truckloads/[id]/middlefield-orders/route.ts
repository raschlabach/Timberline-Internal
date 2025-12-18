import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// GET /api/truckloads/[id]/middlefield-orders - Get all split load orders for a truckload
// Includes middlefield orders automatically, plus any manually added orders
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

    // Check if middlefield_delivery_quote column exists, if not, apply migration automatically
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders'
        AND column_name = 'middlefield_delivery_quote'
      `)
      
      if (columnCheck.rows.length === 0) {
        console.log('middlefield_delivery_quote column not found, applying migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-middlefield-delivery-quote.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('middlefield_delivery_quote column migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying middlefield_delivery_quote migration:', migrationError)
          // Continue anyway - the error handling below will catch if column is missing
        } finally {
          client.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking/applying migration:', migrationCheckError)
      // Continue anyway - will try to query and handle gracefully
    }

    // Check if ohio_to_indiana_pickup_quote column exists, if not, apply migration automatically
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders'
        AND column_name = 'ohio_to_indiana_pickup_quote'
      `)
      
      if (columnCheck.rows.length === 0) {
        console.log('ohio_to_indiana_pickup_quote column not found, applying migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-ohio-to-indiana-pickup-quote.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('ohio_to_indiana_pickup_quote column migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying ohio_to_indiana_pickup_quote migration:', migrationError)
          // Continue anyway - the error handling below will catch if column is missing
        } finally {
          client.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking/applying migration:', migrationCheckError)
      // Continue anyway - will try to query and handle gracefully
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

    // Get all orders in this truckload that need split load management
    // Automatically includes:
    // 1. middlefield + backhaul: pickup gets full quote, delivery gets smaller delivery quote (deducted from pickup)
    // 2. middlefield + ohio_to_indiana: delivery gets full quote, pickup gets smaller pickup quote (deducted from delivery)
    // Also includes any orders manually added to split loads (tracked by having a quote set)
    // Build query conditionally based on whether applies_to column exists
    let sqlQuery = `
      SELECT 
        o.id as "orderId",
        toa.assignment_type as "assignmentType",
        o.freight_quote as "fullQuote",
        -- For middlefield+backhaul: delivery quote (used on delivery truckload)
        o.middlefield_delivery_quote as "deliveryQuote",
        -- For middlefield+ohio_to_indiana: pickup quote (used on pickup truckload)
        o.ohio_to_indiana_pickup_quote as "pickupQuote",
        dc.customer_name as "deliveryCustomerName",
        pc.customer_name as "pickupCustomerName",
        -- Determine the scenario type
        -- If it's a middlefield order, use the load type to determine scenario
        -- Otherwise, determine by which quote is set
        CASE 
          WHEN o.middlefield = true AND o.backhaul = true THEN 'backhaul'
          WHEN o.middlefield = true AND o.oh_to_in = true THEN 'ohio_to_indiana'
          WHEN o.middlefield_delivery_quote IS NOT NULL AND o.middlefield_delivery_quote > 0 THEN 'backhaul'
          WHEN o.ohio_to_indiana_pickup_quote IS NOT NULL AND o.ohio_to_indiana_pickup_quote > 0 THEN 'ohio_to_indiana'
          ELSE NULL
        END as "scenarioType",
        -- Track if this is automatically included (middlefield) or manually added
        (o.middlefield = true AND (o.backhaul = true OR o.oh_to_in = true)) as "isAutoIncluded",
        -- Find the pickup truckload for this order (for backhaul scenario)
        (
          SELECT t.id
          FROM truckload_order_assignments toa_pickup
          JOIN truckloads t ON toa_pickup.truckload_id = t.id
          WHERE toa_pickup.order_id = o.id
            AND toa_pickup.assignment_type = 'pickup'
          ORDER BY t.start_date DESC
          LIMIT 1
        ) as "pickupTruckloadId",
        -- Find the delivery truckload for this order (for ohio_to_indiana scenario)
        (
          SELECT t.id
          FROM truckload_order_assignments toa_delivery
          JOIN truckloads t ON toa_delivery.truckload_id = t.id
          WHERE toa_delivery.order_id = o.id
            AND toa_delivery.assignment_type = 'delivery'
          ORDER BY t.start_date DESC
          LIMIT 1
        ) as "deliveryTruckloadId",
        -- Check if deduction already exists (for backhaul scenario - deducted from pickup)
        (
          SELECT COUNT(*)
          FROM cross_driver_freight_deductions cdfd
          WHERE cdfd.truckload_id = (
            SELECT t.id
            FROM truckload_order_assignments toa_pickup
            JOIN truckloads t ON toa_pickup.truckload_id = t.id
            WHERE toa_pickup.order_id = o.id
              AND toa_pickup.assignment_type = 'pickup'
            ORDER BY t.start_date DESC
            LIMIT 1
          )
          AND cdfd.comment LIKE '%' || COALESCE(dc.customer_name, '') || '%middlefield drop%'
          AND cdfd.is_manual = true`

    if (hasAppliesTo) {
      sqlQuery += `
          AND cdfd.applies_to = 'driver_pay'`
    }

    sqlQuery += `
        ) as "hasDeductionBackhaul",
        -- Check if deduction already exists (for ohio_to_indiana scenario - deducted from delivery)
        (
          SELECT COUNT(*)
          FROM cross_driver_freight_deductions cdfd
          WHERE cdfd.truckload_id = (
            SELECT t.id
            FROM truckload_order_assignments toa_delivery
            JOIN truckloads t ON toa_delivery.truckload_id = t.id
            WHERE toa_delivery.order_id = o.id
              AND toa_delivery.assignment_type = 'delivery'
            ORDER BY t.start_date DESC
            LIMIT 1
          )
          AND cdfd.comment LIKE '%' || COALESCE(pc.customer_name, '') || '%ohio to indiana pickup%'
          AND cdfd.is_manual = true`

    if (hasAppliesTo) {
      sqlQuery += `
          AND cdfd.applies_to = 'driver_pay'`
    }

    sqlQuery += `
        ) as "hasDeductionOhioToIndiana"
      FROM truckload_order_assignments toa
      JOIN orders o ON toa.order_id = o.id
      LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
      LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
      WHERE toa.truckload_id = $1
        AND (
          -- Automatically include middlefield orders
          (o.middlefield = true AND (o.backhaul = true OR o.oh_to_in = true))
          -- OR manually added orders (have a split quote set)
          OR (o.middlefield_delivery_quote IS NOT NULL AND o.middlefield_delivery_quote > 0)
          OR (o.ohio_to_indiana_pickup_quote IS NOT NULL AND o.ohio_to_indiana_pickup_quote > 0)
        )
      ORDER BY o.id
    `

    const result = await query(sqlQuery, [truckloadId])

    return NextResponse.json({
      success: true,
      orders: result.rows
    })
  } catch (error) {
    console.error('Error fetching middlefield orders:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch middlefield orders'
    }, { status: 500 })
  }
}

