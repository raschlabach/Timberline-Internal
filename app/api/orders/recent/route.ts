import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // View toggles: comma-separated list of active views (e.g., "unassigned,pickup")
    // If not provided, defaults to all non-completed views
    const viewParam = searchParams.get('view') || '';
    const activeViews = viewParam ? viewParam.split(',').map(v => v.trim()) : [];
    const hasViewFilter = activeViews.length > 0;
    
    // Search: customer name filter (server-side ILIKE)
    const search = searchParams.get('search') || '';
    
    // Build dynamic WHERE conditions based on active view toggles
    // These filter by assignment state using the LEFT JOINed pickup/delivery CTEs
    const viewConditions: string[] = [];
    
    if (!hasViewFilter) {
      // No view specified — return all non-completed orders (backward compatible)
      viewConditions.push('true');
    } else {
      if (activeViews.includes('unassigned')) {
        viewConditions.push('(pa.truckload_id IS NULL AND da.truckload_id IS NULL)');
      }
      if (activeViews.includes('pickup')) {
        viewConditions.push('(pa.truckload_id IS NOT NULL AND da.truckload_id IS NULL)');
      }
      if (activeViews.includes('delivery')) {
        viewConditions.push('(da.truckload_id IS NOT NULL)');
      }
      if (activeViews.includes('assigned')) {
        viewConditions.push('(pa.truckload_id IS NOT NULL AND da.truckload_id IS NOT NULL AND COALESCE(transfer_orders.is_transfer_order, false) = false)');
      }
    }
    
    // If user toggled all views off (no conditions matched), return nothing
    if (hasViewFilter && viewConditions.length === 0) {
      return NextResponse.json({ orders: [], totalCount: 0 });
    }
    
    const viewWhereClause = viewConditions.length > 0
      ? `AND (${viewConditions.join(' OR ')})`
      : '';
    
    // Build search condition
    const queryParams: (string | number)[] = [];
    let searchCondition = '';
    if (search) {
      queryParams.push(`%${search}%`);
      searchCondition = `AND (pc.customer_name ILIKE $${queryParams.length} OR dc.customer_name ILIKE $${queryParams.length})`;
    }

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
      ),
      transfer_orders AS (
        SELECT DISTINCT
          toa_pickup.order_id,
          CASE 
            WHEN toa_pickup.truckload_id = toa_delivery.truckload_id THEN true
            ELSE false
          END as is_transfer_order
        FROM truckload_order_assignments toa_pickup
        JOIN truckload_order_assignments toa_delivery 
          ON toa_pickup.order_id = toa_delivery.order_id
        WHERE toa_pickup.assignment_type = 'pickup'
          AND toa_delivery.assignment_type = 'delivery'
      )
      SELECT 
        o.id, 
        COALESCE(u.full_name, 'System') as creator,
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
          'phone2', COALESCE(pc.phone_number_2, ''),
          'notes', COALESCE(pc.notes, ''),
          'lat', pl.latitude,
          'lng', pl.longitude
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
          'phone2', COALESCE(dc.phone_number_2, ''),
          'notes', COALESCE(dc.notes, ''),
          'lat', dl.latitude,
          'lng', dl.longitude
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
        COALESCE(hbs.hand_bundles_count, 0) as "handBundles",
        COALESCE(ss.skids_data, '[]'::json) as "skidsData",
        COALESCE(vs.vinyl_data, '[]'::json) as "vinylData",
        COALESCE(hbs.hand_bundles_data, '[]'::json) as "handBundlesData",
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
        -- Format pickup_date as YYYY-MM-DD string to avoid timezone issues
        TO_CHAR(o.pickup_date, 'YYYY-MM-DD') as "pickupDate",
        COALESCE(o.is_rush, false) as "isRushOrder",
        COALESCE(o.needs_attention, false) as "needsAttention",
        o.comments,
        o.freight_quote as "freightQuote",
        o.status,
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
        o.created_at,
        COALESCE(transfer_orders.is_transfer_order, false) as "isTransferOrder"
      FROM 
        orders o
      -- Join with users for creator
      LEFT JOIN users u ON o.created_by = u.id
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
      LEFT JOIN hand_bundles_summary hbs ON o.id = hbs.order_id
      LEFT JOIN footage f ON o.id = f.order_id
      -- Join with assignments
      LEFT JOIN pickup_assignments pa ON o.id = pa.order_id
      LEFT JOIN delivery_assignments da ON o.id = da.order_id
      -- Join with transfer orders
      LEFT JOIN transfer_orders ON o.id = transfer_orders.order_id
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
      WHERE o.status != 'completed'
      ${viewWhereClause}
      ${searchCondition}
      ORDER BY 
        o.created_at DESC
    `;

    const result = await query(sqlQuery, queryParams);
    
    return NextResponse.json({
      orders: result.rows,
      totalCount: result.rows.length
    });
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
