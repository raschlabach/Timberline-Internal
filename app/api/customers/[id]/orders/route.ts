import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id

    const result = await query(
      `SELECT
        o.id,
        o.status,
        TO_CHAR(o.pickup_date, 'YYYY-MM-DD') as pickup_date,
        o.comments,
        COALESCE(o.is_rush, false) as is_rush,
        COALESCE(o.needs_attention, false) as needs_attention,
        o.freight_quote,
        o.created_at,
        o.updated_at,
        COALESCE(u.full_name, 'System') as creator,
        -- Load type filters
        json_build_object(
          'ohioToIndiana', COALESCE(o.oh_to_in, false),
          'backhaul', COALESCE(o.backhaul, false),
          'localFlatbed', COALESCE(o.local_flatbed, false),
          'rrOrder', COALESCE(o.rr_order, false),
          'localSemi', COALESCE(o.local_semi, false),
          'middlefield', COALESCE(o.middlefield, false),
          'paNy', COALESCE(o.pa_ny, false)
        ) as filters,
        -- Determine the customer's role on this order
        CASE
          WHEN o.pickup_customer_id = $1 AND o.delivery_customer_id = $1 THEN 'both'
          WHEN o.pickup_customer_id = $1 THEN 'pickup'
          WHEN o.delivery_customer_id = $1 THEN 'delivery'
          WHEN o.paying_customer_id = $1 THEN 'paying'
        END as customer_role,
        -- Pickup customer
        json_build_object(
          'id', pc.id,
          'name', pc.customer_name
        ) as pickup_customer,
        -- Delivery customer
        json_build_object(
          'id', dc.id,
          'name', dc.customer_name
        ) as delivery_customer,
        -- Freight summary
        COALESCE(ss.skids_count, 0) as skids,
        COALESCE(vs.vinyl_count, 0) as vinyl,
        CASE
          WHEN f.square_footage > 0 THEN f.square_footage
          ELSE COALESCE(ss.total_skid_footage, 0) + COALESCE(vs.total_vinyl_footage, 0)
        END as footage,
        -- Pickup assignment
        CASE WHEN pa.driver_name IS NOT NULL THEN
          json_build_object(
            'driverName', pa.driver_name,
            'driverColor', pa.driver_color,
            'truckloadId', pa.truckload_id,
            'startDate', pa.start_date,
            'endDate', pa.end_date
          )
        ELSE NULL END as pickup_assignment,
        -- Delivery assignment
        CASE WHEN da.driver_name IS NOT NULL THEN
          json_build_object(
            'driverName', da.driver_name,
            'driverColor', da.driver_color,
            'truckloadId', da.truckload_id,
            'startDate', da.start_date,
            'endDate', da.end_date
          )
        ELSE NULL END as delivery_assignment
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
      LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
      LEFT JOIN (
        SELECT order_id,
          COUNT(*) as skids_count,
          SUM(square_footage * quantity) as total_skid_footage
        FROM skids GROUP BY order_id
      ) ss ON o.id = ss.order_id
      LEFT JOIN (
        SELECT order_id,
          COUNT(*) as vinyl_count,
          SUM(square_footage * quantity) as total_vinyl_footage
        FROM vinyl GROUP BY order_id
      ) vs ON o.id = vs.order_id
      LEFT JOIN footage f ON o.id = f.order_id
      LEFT JOIN (
        SELECT toa.order_id,
          t.id as truckload_id,
          t.start_date,
          t.end_date,
          u.full_name as driver_name,
          d.color as driver_color
        FROM truckload_order_assignments toa
        JOIN truckloads t ON toa.truckload_id = t.id
        JOIN drivers d ON t.driver_id = d.user_id
        JOIN users u ON d.user_id = u.id
        WHERE toa.assignment_type = 'pickup'
      ) pa ON o.id = pa.order_id
      LEFT JOIN (
        SELECT toa.order_id,
          t.id as truckload_id,
          t.start_date,
          t.end_date,
          u.full_name as driver_name,
          d.color as driver_color
        FROM truckload_order_assignments toa
        JOIN truckloads t ON toa.truckload_id = t.id
        JOIN drivers d ON t.driver_id = d.user_id
        JOIN users u ON d.user_id = u.id
        WHERE toa.assignment_type = 'delivery'
      ) da ON o.id = da.order_id
      WHERE o.pickup_customer_id = $1
        OR o.delivery_customer_id = $1
        OR o.paying_customer_id = $1
      ORDER BY
        CASE WHEN o.status != 'completed' THEN 0 ELSE 1 END,
        o.created_at DESC`,
      [customerId]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching customer orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer orders' },
      { status: 500 }
    )
  }
}
