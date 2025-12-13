import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/truckload-manager/data - Get both drivers and truckloads in one request
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch drivers
    const driversResult = await query(`
      SELECT 
        u.id,
        u.full_name,
        d.color
      FROM users u
      LEFT JOIN drivers d ON u.id = d.user_id
      WHERE u.role = 'driver'
      ORDER BY u.full_name ASC
    `)

    const drivers = driversResult.rows.map(row => ({
      id: row.id,
      full_name: row.full_name,
      color: row.color
    }))

    // Fetch truckloads (same query as /api/truckloads)
    const truckloadsResult = await query(`
      WITH truckload_assignments AS (
        SELECT 
          toa.truckload_id,
          toa.order_id,
          toa.assignment_type,
          COALESCE(
            (
              SELECT COALESCE(SUM(s.width * s.length * s.quantity), 0)
              FROM skids s
              WHERE s.order_id = o.id
            ) + (
              SELECT COALESCE(SUM(v.width * v.length * v.quantity), 0)
              FROM vinyl v
              WHERE v.order_id = o.id
            ),
            0
          ) as square_footage,
          EXISTS (
            SELECT 1 
            FROM truckload_order_assignments toa2 
            WHERE toa2.truckload_id = toa.truckload_id 
            AND toa2.order_id = toa.order_id 
            AND toa2.assignment_type != toa.assignment_type
          ) as is_transfer_order
        FROM truckload_order_assignments toa
        JOIN orders o ON toa.order_id = o.id
      ),
      footage_calculations AS (
        SELECT 
          ta.truckload_id,
          COALESCE(SUM(CASE 
            WHEN ta.assignment_type = 'pickup' AND ta.is_transfer_order = false
            THEN ta.square_footage
            ELSE 0 
          END), 0) as pickup_footage,
          COALESCE(SUM(CASE 
            WHEN ta.assignment_type = 'delivery' AND ta.is_transfer_order = false
            THEN ta.square_footage
            ELSE 0 
          END), 0) as delivery_footage,
          COALESCE((
            SELECT SUM(ta_transfer.square_footage)
            FROM (
              SELECT DISTINCT ON (order_id) order_id, square_footage
              FROM truckload_assignments
              WHERE truckload_id = ta.truckload_id
              AND is_transfer_order = true
              ORDER BY order_id
            ) ta_transfer
          ), 0) as transfer_footage
        FROM truckload_assignments ta
        GROUP BY ta.truckload_id
      ),
      quotes_status AS (
        SELECT 
          toa.truckload_id,
          COUNT(*) as total_assignments,
          COUNT(CASE WHEN o.freight_quote IS NOT NULL THEN 1 END) as quotes_filled
        FROM truckload_order_assignments toa
        JOIN orders o ON toa.order_id = o.id
        GROUP BY toa.truckload_id
      )
      SELECT 
        t.id,
        t.driver_id as "driverId",
        TO_CHAR(t.start_date, 'YYYY-MM-DD') as "startDate",
        TO_CHAR(t.end_date, 'YYYY-MM-DD') as "endDate",
        t.trailer_number as "trailerNumber",
        t.bill_of_lading_number as "billOfLadingNumber",
        t.description,
        t.is_completed as "isCompleted",
        t.total_mileage as "totalMileage",
        t.estimated_duration as "estimatedDuration",
        u.full_name as "driverName",
        d.color as "driverColor",
        COALESCE(fc.pickup_footage, 0) as "pickupFootage",
        COALESCE(fc.delivery_footage, 0) as "deliveryFootage",
        COALESCE(fc.transfer_footage, 0) as "transferFootage",
        COALESCE(qs.total_assignments, 0) as "totalAssignments",
        COALESCE(qs.quotes_filled, 0) as "quotesFilled",
        (COALESCE(qs.total_assignments, 0) > 0 AND COALESCE(qs.quotes_filled, 0) = COALESCE(qs.total_assignments, 0)) as "allQuotesFilled"
      FROM truckloads t
      LEFT JOIN users u ON t.driver_id = u.id
      LEFT JOIN drivers d ON u.id = d.user_id
      LEFT JOIN footage_calculations fc ON t.id = fc.truckload_id
      LEFT JOIN quotes_status qs ON t.id = qs.truckload_id
      ORDER BY t.start_date DESC
    `)

    const truckloads = truckloadsResult.rows.map(row => ({
      id: row.id,
      driverId: row.driverId,
      startDate: row.startDate,
      endDate: row.endDate,
      trailerNumber: row.trailerNumber,
      billOfLadingNumber: row.billOfLadingNumber,
      description: row.description,
      isCompleted: row.isCompleted,
      totalMileage: row.totalMileage,
      estimatedDuration: row.estimatedDuration,
      driverName: row.driverName,
      driverColor: row.driverColor,
      pickupFootage: parseFloat(row.pickupFootage) || 0,
      deliveryFootage: parseFloat(row.deliveryFootage) || 0,
      transferFootage: parseFloat(row.transferFootage) || 0,
      totalAssignments: parseInt(row.totalAssignments) || 0,
      quotesFilled: parseInt(row.quotesFilled) || 0,
      allQuotesFilled: row.allQuotesFilled || false
    }))

    return NextResponse.json({
      success: true,
      drivers,
      truckloads
    })
  } catch (error) {
    console.error('Error fetching truckload manager data:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

