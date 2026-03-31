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
      SELECT DISTINCT
        u.id,
        u.full_name,
        d.color
      FROM users u
      JOIN drivers d ON u.id = d.user_id
      WHERE u.role = 'driver'
      ORDER BY u.full_name ASC
    `)

    // Deduplicate drivers by id (in case of any join issues)
    const driversMap = new Map()
    driversResult.rows.forEach(row => {
      if (!driversMap.has(row.id)) {
        driversMap.set(row.id, {
          id: row.id,
          full_name: row.full_name,
          color: row.color
        })
      }
    })
    const drivers = Array.from(driversMap.values())

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
        (COALESCE(qs.total_assignments, 0) > 0 AND COALESCE(qs.quotes_filled, 0) = COALESCE(qs.total_assignments, 0)) as "allQuotesFilled",
        t.truckload_sheet_printed_at as "truckloadSheetPrintedAt",
        t.pickup_list_printed_at as "pickupListPrintedAt",
        t.loading_sheet_printed_at as "loadingSheetPrintedAt"
      FROM truckloads t
      LEFT JOIN users u ON t.driver_id = u.id
      LEFT JOIN drivers d ON u.id = d.user_id
      LEFT JOIN footage_calculations fc ON t.id = fc.truckload_id
      LEFT JOIN quotes_status qs ON t.id = qs.truckload_id
      WHERE COALESCE(t.status, 'active') != 'draft'
      ORDER BY t.start_date DESC
    `)

    // Fetch last-modified timestamps only for truckloads that have print tracking
    const printedTruckloadIds = truckloadsResult.rows
      .filter(row => !row.isCompleted && (row.truckloadSheetPrintedAt || row.pickupListPrintedAt || row.loadingSheetPrintedAt))
      .map(row => row.id)

    const lastModifiedMap = new Map<number, string>()

    if (printedTruckloadIds.length > 0) {
      const lastModifiedResult = await query(`
        SELECT
          toa.truckload_id,
          GREATEST(
            MAX(toa.updated_at),
            MAX(o.updated_at),
            MAX(c_pickup.updated_at),
            MAX(c_delivery.updated_at),
            MAX(l_pickup.updated_at),
            MAX(l_delivery.updated_at)
          ) as last_data_modified_at
        FROM truckload_order_assignments toa
        JOIN orders o ON toa.order_id = o.id
        LEFT JOIN customers c_pickup ON o.pickup_customer_id = c_pickup.id
        LEFT JOIN locations l_pickup ON c_pickup.location_id = l_pickup.id
        LEFT JOIN customers c_delivery ON o.delivery_customer_id = c_delivery.id
        LEFT JOIN locations l_delivery ON c_delivery.location_id = l_delivery.id
        WHERE toa.truckload_id = ANY($1)
        GROUP BY toa.truckload_id
      `, [printedTruckloadIds])

      for (const row of lastModifiedResult.rows) {
        lastModifiedMap.set(row.truckload_id, row.last_data_modified_at)
      }
    }

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
      allQuotesFilled: row.allQuotesFilled || false,
      truckloadSheetPrintedAt: row.truckloadSheetPrintedAt || null,
      pickupListPrintedAt: row.pickupListPrintedAt || null,
      loadingSheetPrintedAt: row.loadingSheetPrintedAt || null,
      lastDataModifiedAt: lastModifiedMap.get(row.id) || null,
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

