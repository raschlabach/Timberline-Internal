import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// GET /api/truckloads/[id]/middlefield-orders - Get all middlefield orders for a truckload
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

    // Check if applies_to column exists
    const appliesToCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cross_driver_freight_deductions'
      AND column_name = 'applies_to'
    `)
    const hasAppliesTo = appliesToCheck.rows.length > 0

    // Get all middlefield orders that are pickup assignments in this truckload
    // These are orders that need delivery quotes set
    // Build query conditionally based on whether applies_to column exists
    let sqlQuery = `
      SELECT 
        o.id as "orderId",
        toa.assignment_type as "assignmentType",
        o.freight_quote as "fullQuote",
        o.middlefield_delivery_quote as "deliveryQuote",
        dc.customer_name as "deliveryCustomerName",
        pc.customer_name as "pickupCustomerName",
        -- Find the pickup truckload for this order
        (
          SELECT t.id
          FROM truckload_order_assignments toa_pickup
          JOIN truckloads t ON toa_pickup.truckload_id = t.id
          WHERE toa_pickup.order_id = o.id
            AND toa_pickup.assignment_type = 'pickup'
          ORDER BY t.start_date DESC
          LIMIT 1
        ) as "pickupTruckloadId",
        -- Check if deduction already exists
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
        ) as "hasDeduction"
      FROM truckload_order_assignments toa
      JOIN orders o ON toa.order_id = o.id
      LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
      LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
      WHERE toa.truckload_id = $1
        AND toa.assignment_type = 'pickup'
        AND o.middlefield = true
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

