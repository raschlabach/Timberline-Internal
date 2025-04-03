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
          SUM(square_footage * quantity) as total_skid_footage,
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
          SUM(square_footage * quantity) as total_vinyl_footage,
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
      )
      SELECT 
        o.id, 
        toa.assignment_type,
        toa.sequence_number,
        toa.is_completed as stop_completed,
        o.status,
        -- Pickup customer details
        json_build_object(
          'id', pc.id,
          'name', pc.customer_name,
          'address', CONCAT_WS(', ', 
            NULLIF(pl.address, ''), 
            NULLIF(pl.city, ''), 
            NULLIF(pl.state, '')
          )
        ) as pickup_customer,
        -- Delivery customer details
        json_build_object(
          'id', dc.id,
          'name', dc.customer_name,
          'address', CONCAT_WS(', ', 
            NULLIF(dl.address, ''), 
            NULLIF(dl.city, ''), 
            NULLIF(dl.state, '')
          )
        ) as delivery_customer,
        -- Freight totals and details
        COALESCE(ss.skids_count, 0) as skids,
        COALESCE(vs.vinyl_count, 0) as vinyl,
        CASE 
          WHEN f.square_footage > 0 THEN f.square_footage
          ELSE COALESCE(ss.total_skid_footage, 0) + COALESCE(vs.total_vinyl_footage, 0)
        END as footage,
        COALESCE(ss.skids_data, '[]'::json) as skids_data,
        COALESCE(vs.vinyl_data, '[]'::json) as vinyl_data,
        -- Other fields
        o.pickup_date,
        COALESCE(o.is_rush, false) as is_rush,
        COALESCE(o.needs_attention, false) as needs_attention,
        o.comments,
        o.freight_quote,
        COALESCE(o.is_transfer_order, false) as is_transfer_order
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
      LEFT JOIN footage f ON o.id = f.order_id
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