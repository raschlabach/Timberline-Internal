import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/truckloads/[id]/middlefield-orders - Get all split load orders for a truckload
// Query params: ?includeOrderId=123 to include a specific order even if it doesn't have quotes set
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

    // Check for includeOrderId query parameter
    const { searchParams } = new URL(request.url)
    const includeOrderId = searchParams.get('includeOrderId')
    const includeOrderIdNum = includeOrderId ? parseInt(includeOrderId, 10) : null

    // Get all orders in this truckload that need split load management
    // Automatically includes middlefield orders, plus any with assignment_quote set
    const sqlQuery = `
      SELECT 
        o.id as "orderId",
        toa.assignment_type as "assignmentType",
        o.freight_quote as "fullQuote",
        toa.assignment_quote as "assignmentQuote",
        dc.customer_name as "deliveryCustomerName",
        pc.customer_name as "pickupCustomerName",
        -- Find the other truckload (pickup if viewing delivery, delivery if viewing pickup)
        CASE 
          WHEN toa.assignment_type = 'delivery' THEN (
            SELECT t.id
            FROM truckload_order_assignments toa_pickup
            JOIN truckloads t ON toa_pickup.truckload_id = t.id
            WHERE toa_pickup.order_id = o.id
              AND toa_pickup.assignment_type = 'pickup'
            ORDER BY t.start_date DESC
            LIMIT 1
          )
          WHEN toa.assignment_type = 'pickup' THEN (
            SELECT t.id
            FROM truckload_order_assignments toa_delivery
            JOIN truckloads t ON toa_delivery.truckload_id = t.id
            WHERE toa_delivery.order_id = o.id
              AND toa_delivery.assignment_type = 'delivery'
            ORDER BY t.start_date DESC
            LIMIT 1
          )
          ELSE NULL
        END as "otherTruckloadId",
        -- Check if deduction already exists
        (
          SELECT COUNT(*)
          FROM cross_driver_freight_deductions cdfd
          WHERE cdfd.truckload_id = CASE 
            WHEN toa.assignment_type = 'delivery' THEN (
              SELECT t.id
              FROM truckload_order_assignments toa_pickup
              JOIN truckloads t ON toa_pickup.truckload_id = t.id
              WHERE toa_pickup.order_id = o.id
                AND toa_pickup.assignment_type = 'pickup'
              ORDER BY t.start_date DESC
              LIMIT 1
            )
            WHEN toa.assignment_type = 'pickup' THEN (
              SELECT t.id
              FROM truckload_order_assignments toa_delivery
              JOIN truckloads t ON toa_delivery.truckload_id = t.id
              WHERE toa_delivery.order_id = o.id
                AND toa_delivery.assignment_type = 'delivery'
              ORDER BY t.start_date DESC
              LIMIT 1
            )
            ELSE NULL
          END
          AND cdfd.comment LIKE '%' || COALESCE(
            CASE WHEN toa.assignment_type = 'delivery' THEN dc.customer_name ELSE pc.customer_name END,
            ''
          ) || '%split load%'
          AND cdfd.is_manual = true
          AND cdfd.applies_to = 'driver_pay'
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
