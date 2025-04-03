import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // First test basic orders query
    const testQuery = 'SELECT COUNT(*) FROM orders';
    const testResult = await query(testQuery);
    console.log('Total orders in database:', testResult.rows[0].count);

    const sqlQuery = `
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
      ),
      pickup_assignments AS (
        SELECT 
          toa.order_id,
          t.id as truckload_id,
          t.start_date,
          t.end_date,
          t.description,
          u.full_name as driver_name,
          d.color as driver_color
        FROM truckload_order_assignments toa
        JOIN truckloads t ON toa.truckload_id = t.id
        JOIN drivers d ON t.driver_id = d.user_id
        JOIN users u ON d.user_id = u.id
        WHERE toa.assignment_type = 'pickup'
      ),
      delivery_assignments AS (
        SELECT 
          toa.order_id,
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
      )
      SELECT 
        o.id, 
        -- Pickup customer details
        json_build_object(
          'id', pc.id,
          'name', pc.customer_name,
          'address', CONCAT_WS(', ', 
            NULLIF(pl.address, ''), 
            NULLIF(pl.city, ''), 
            NULLIF(pl.state, '')
          ),
          'phone', COALESCE(pc.phone_number_1, ''),
          'phone2', COALESCE(pc.phone_number_2, '')
        ) as "pickupCustomer",
        -- Delivery customer details
        json_build_object(
          'id', dc.id,
          'name', dc.customer_name,
          'address', CONCAT_WS(', ', 
            NULLIF(dl.address, ''), 
            NULLIF(dl.city, ''), 
            NULLIF(dl.state, '')
          ),
          'phone', COALESCE(dc.phone_number_1, ''),
          'phone2', COALESCE(dc.phone_number_2, '')
        ) as "deliveryCustomer",
        -- Paying customer details (if exists)
        CASE WHEN pay.id IS NOT NULL THEN
          json_build_object(
            'id', pay.id,
            'name', pay.customer_name
          )
        ELSE NULL END as "payingCustomer",
        -- Freight totals and details
        COALESCE(ss.skids_count, 0) as skids,
        COALESCE(vs.vinyl_count, 0) as vinyl,
        CASE 
          WHEN f.square_footage > 0 THEN f.square_footage
          ELSE COALESCE(ss.total_skid_footage, 0) + COALESCE(vs.total_vinyl_footage, 0)
        END as footage,
        COALESCE(ss.skids_data, '[]'::json) as "skidsData",
        COALESCE(vs.vinyl_data, '[]'::json) as "vinylData",
        -- Assignment details
        CASE WHEN pa.truckload_id IS NOT NULL THEN
          json_build_object(
            'truckloadId', pa.truckload_id,
            'driverName', pa.driver_name,
            'driverColor', pa.driver_color,
            'startDate', pa.start_date,
            'endDate', pa.end_date,
            'description', pa.description
          )
        ELSE NULL END as "pickupAssignment",
        CASE WHEN da.truckload_id IS NOT NULL THEN
          json_build_object(
            'truckloadId', da.truckload_id,
            'driverName', da.driver_name,
            'driverColor', da.driver_color,
            'startDate', da.start_date,
            'endDate', da.end_date
          )
        ELSE NULL END as "deliveryAssignment",
        -- Other fields
        o.pickup_date as "pickupDate",
        COALESCE(o.is_rush, false) as "isRushOrder",
        COALESCE(o.needs_attention, false) as "needsAttention",
        o.comments,
        o.freight_quote as "freightQuote",
        -- Filters
        json_build_object(
          'ohioToIndiana', COALESCE(o.oh_to_in, false),
          'backhaul', COALESCE(o.backhaul, false),
          'localFlatbed', COALESCE(o.local_flatbed, false),
          'rrOrder', COALESCE(o.rr_order, false),
          'localSemi', COALESCE(o.local_semi, false),
          'middlefield', COALESCE(o.middlefield, false),
          'paNy', COALESCE(o.pa_ny, false)
        ) as filters,
        -- Links
        COALESCE(ol.links, '[]'::json) as links,
        o.created_at
      FROM 
        orders o
      -- Join with customers and locations for pickup
      LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
      LEFT JOIN locations pl ON pc.location_id = pl.id
      -- Join with customers and locations for delivery
      LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
      LEFT JOIN locations dl ON dc.location_id = dl.id
      -- Join with customers for paying customer
      LEFT JOIN customers pay ON o.paying_customer_id = pay.id
      -- Join with freight data
      LEFT JOIN skids_summary ss ON o.id = ss.order_id
      LEFT JOIN vinyl_summary vs ON o.id = vs.order_id
      LEFT JOIN footage f ON o.id = f.order_id
      -- Join with assignments
      LEFT JOIN pickup_assignments pa ON o.id = pa.order_id
      LEFT JOIN delivery_assignments da ON o.id = da.order_id
      -- Join with order links
      LEFT JOIN LATERAL (
        SELECT 
          order_id,
          json_agg(
            json_build_object(
              'id', id,
              'url', url,
              'description', description
            )
          ) as links
        FROM order_links
        WHERE order_id = o.id
        GROUP BY order_id
      ) ol ON true
      ORDER BY 
        o.created_at DESC
      LIMIT 20
    `;

    console.log('Fetching orders with detailed skid and vinyl data...');
    const result = await query(sqlQuery);
    console.log(`Found ${result.rows.length} orders`);
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch recent orders' },
      { status: 500 }
    );
  }
} 