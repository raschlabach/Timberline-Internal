import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/truckloads/[id]/orders - Get all orders assigned to a specific truckload
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

    const result = await query(`
      WITH skids_summary AS (
        SELECT 
          order_id,
          COUNT(*) as skids_count,
          SUM(width * length * quantity) as total_skid_footage,
          json_agg(
            json_build_object(
              'id', id,
              'type', 'skid',
              'width', width,
              'length', length,
              'footage', square_footage,
              'quantity', quantity
            )
          ) as skids_data
        FROM skids
        GROUP BY order_id
      ),
      vinyl_summary AS (
        SELECT 
          order_id,
          COUNT(*) as vinyl_count,
          SUM(width * length * quantity) as total_vinyl_footage,
          json_agg(
            json_build_object(
              'id', id,
              'type', 'vinyl',
              'width', width,
              'length', length,
              'footage', square_footage,
              'quantity', quantity
            )
          ) as vinyl_data
        FROM vinyl
        GROUP BY order_id
      ),
      hand_bundles_summary AS (
        SELECT 
          order_id,
          COUNT(*) as hand_bundles_count,
          json_agg(
            json_build_object(
              'id', id::text,
              'quantity', quantity,
              'description', description
            )
          ) as hand_bundles_data
        FROM freight_items
        WHERE type = 'hand_bundle'
        GROUP BY order_id
      ),
      pickup_assignments AS (
        SELECT 
          toa_pickup.order_id,
          u.full_name as driver_name,
          t.start_date as pickup_date
        FROM truckload_order_assignments toa_pickup
        JOIN truckloads t ON toa_pickup.truckload_id = t.id
        LEFT JOIN users u ON t.driver_id = u.id
        WHERE toa_pickup.assignment_type = 'pickup'
      ),
      delivery_assignments AS (
        SELECT 
          toa_delivery.order_id,
          u.full_name as driver_name,
          t.start_date as delivery_date
        FROM truckload_order_assignments toa_delivery
        JOIN truckloads t ON toa_delivery.truckload_id = t.id
        LEFT JOIN users u ON t.driver_id = u.id
        WHERE toa_delivery.assignment_type = 'delivery'
      )
      SELECT 
        o.id, 
        toa.assignment_type,
        toa.sequence_number,
        toa.is_completed as stop_completed,
        toa.assignment_quote,
        o.status,
        -- Pickup customer details
        json_build_object(
          'id', pc.id,
          'name', pc.customer_name,
          'address', CONCAT_WS(', ', 
            NULLIF(pl.address, ''), 
            NULLIF(pl.city, ''), 
            NULLIF(pl.state, '')
          ),
          'phone_number_1', pc.phone_number_1,
          'phone_number_2', pc.phone_number_2,
          'notes', pc.notes
        ) as pickup_customer,
        -- Delivery customer details
        json_build_object(
          'id', dc.id,
          'name', dc.customer_name,
          'address', CONCAT_WS(', ', 
            NULLIF(dl.address, ''), 
            NULLIF(dl.city, ''), 
            NULLIF(dl.state, '')
          ),
          'phone_number_1', dc.phone_number_1,
          'phone_number_2', dc.phone_number_2,
          'notes', dc.notes
        ) as delivery_customer,
        -- Freight totals and details
        COALESCE(ss.skids_count, 0) as skids,
        COALESCE(vs.vinyl_count, 0) as vinyl,
        (
          COALESCE(
            (SELECT SUM(s.width * s.length * s.quantity) FROM skids s WHERE s.order_id = o.id),
            0
          ) + COALESCE(
            (SELECT SUM(v.width * v.length * v.quantity) FROM vinyl v WHERE v.order_id = o.id),
            0
          )
        ) as footage,
        COALESCE(hbs.hand_bundles_count, 0) as hand_bundles,
        COALESCE(ss.skids_data, '[]'::json) as skids_data,
        COALESCE(vs.vinyl_data, '[]'::json) as vinyl_data,
        COALESCE(hbs.hand_bundles_data, '[]'::json) as hand_bundles_data,
        -- Other fields
        o.pickup_date,
        COALESCE(o.is_rush, false) as is_rush,
        COALESCE(o.needs_attention, false) as needs_attention,
        o.comments,
        o.freight_quote,
        toa.assignment_quote,
        COALESCE(o.middlefield, false) as middlefield,
        COALESCE(o.backhaul, false) as backhaul,
        COALESCE(o.is_transfer_order, false) as is_transfer_order,
        -- Pickup assignment info for delivery assignments
        pa.driver_name as pickup_driver_name,
        pa.pickup_date as pickup_assignment_date,
        -- Delivery assignment info for pickup assignments
        da.driver_name as delivery_driver_name,
        da.delivery_date as delivery_assignment_date
      FROM 
        truckload_order_assignments toa
      JOIN 
        orders o ON toa.order_id = o.id
      -- Join with customers and locations for pickup
      LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
      LEFT JOIN locations pl ON pc.location_id = pl.id
      -- Join with customers and locations for delivery
      LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
      LEFT JOIN locations dl ON dc.location_id = dl.id
      -- Join with freight data
      LEFT JOIN skids_summary ss ON o.id = ss.order_id
      LEFT JOIN vinyl_summary vs ON o.id = vs.order_id
      LEFT JOIN hand_bundles_summary hbs ON o.id = hbs.order_id
      -- Join with pickup assignments to get pickup driver info for deliveries
      LEFT JOIN pickup_assignments pa ON o.id = pa.order_id
      -- Join with delivery assignments to get delivery driver info for pickups
      LEFT JOIN delivery_assignments da ON o.id = da.order_id
      WHERE 
        toa.truckload_id = $1
      ORDER BY 
        toa.sequence_number ASC
    `, [truckloadId])

    return NextResponse.json({
      success: true,
      orders: result.rows
    })
  } catch (error) {
    console.error('Error fetching truckload orders:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch truckload orders'
    }, { status: 500 })
  }
} 