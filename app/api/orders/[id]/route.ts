import { NextRequest, NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/orders/[id] - Get a specific order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = params.id;
    
    // Fetch the order with all its details
    const orderResult = await query(
      `WITH skids_summary AS (
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
        WHERE order_id = $1
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
        WHERE order_id = $1
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
        WHERE type = 'hand_bundle' AND order_id = $1
        GROUP BY order_id
      ),
      pickup_assignments AS (
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
        WHERE toa.assignment_type = 'pickup' AND toa.order_id = $1
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
        WHERE toa.assignment_type = 'delivery' AND toa.order_id = $1
      )
      SELECT 
        o.id, 
        COALESCE(u.full_name, 'System') as creator,
        o.created_at,
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
        ) as "pickupCustomer",
        -- Delivery customer details
        json_build_object(
          'id', dc.id,
          'name', dc.customer_name,
          'address', CONCAT_WS(', ', 
            NULLIF(dl.address, ''), 
            NULLIF(dl.city, ''), 
            NULLIF(dl.state, '')
          )
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
            'endDate', pa.end_date
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
        COALESCE(o.unload_en_route, false) as "unloadEnRoute",
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
        -- Creator and editor info
        COALESCE(u.full_name, 'System') as "lastEditedBy",
        o.updated_at as "lastEditedAt"
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
      WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(orderResult.rows[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

async function fetchRecentOrders() {
  const result = await query(
    `SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`
  );
  return result.rows;
}

// PATCH /api/orders/[id] - Update a specific order
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = params.id;
    const data = await request.json();

    // Start a transaction
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Update the order's main fields
      await client.query(
        `UPDATE orders SET
          pickup_customer_id = COALESCE($1, pickup_customer_id),
          delivery_customer_id = COALESCE($2, delivery_customer_id),
          paying_customer_id = $3,
          pickup_date = COALESCE($4, pickup_date),
          freight_quote = $5,
          comments = $6,
          is_rush = COALESCE($7, is_rush),
          needs_attention = COALESCE($8, needs_attention),
          unload_en_route = COALESCE($9, unload_en_route),
          oh_to_in = COALESCE($10, oh_to_in),
          backhaul = COALESCE($11, backhaul),
          local_semi = COALESCE($12, local_semi),
          local_flatbed = COALESCE($13, local_flatbed),
          rr_order = COALESCE($14, rr_order),
          middlefield = COALESCE($15, middlefield),
          pa_ny = COALESCE($16, pa_ny),
          updated_at = NOW(),
          last_edited_by = $17,
          last_edited_at = NOW()
        WHERE id = $18
        RETURNING *`,
        [
          data.pickupCustomer?.id,
          data.deliveryCustomer?.id,
          data.payingCustomer?.id || null,
          // Ensure pickupDate is a date string (YYYY-MM-DD) or null
          // PostgreSQL DATE type handles this correctly without timezone conversion
          data.pickupDate && typeof data.pickupDate === 'string' 
            ? data.pickupDate 
            : (data.pickupDate ? new Date(data.pickupDate).toISOString().split('T')[0] : null),
          // Convert empty string to null for numeric field
          (data.freightQuote && data.freightQuote.toString().trim() !== '') 
            ? parseFloat(data.freightQuote.toString()) 
            : null,
          data.comments || '',
          data.isRushOrder,
          data.needsAttention,
          data.unloadEnRoute,
          data.filters?.ohioToIndiana,
          data.filters?.backhaul,
          data.filters?.localSemi,
          data.filters?.localFlatbed,
          data.filters?.rrOrder,
          data.filters?.middlefield,
          data.filters?.paNy,
          session.user.id,
          orderId
        ]
      );

      // Update skids if provided
      if (Array.isArray(data.skidsData)) {
        // Delete existing skids
        await client.query('DELETE FROM skids WHERE order_id = $1', [orderId]);
        
        // Insert new skids
        for (const skid of data.skidsData) {
          await client.query(
            `INSERT INTO skids (
              order_id, width, length, square_footage, quantity
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              orderId, 
              Number(skid.width) || 0, 
              Number(skid.length) || 0, 
              Number(skid.footage) || 0, 
              Number(skid.quantity) || 1
            ]
          );
        }
      }

      // Update vinyl if provided
      if (Array.isArray(data.vinylData)) {
        // Delete existing vinyl
        await client.query('DELETE FROM vinyl WHERE order_id = $1', [orderId]);
        
        // Insert new vinyl
        for (const vinyl of data.vinylData) {
          await client.query(
            `INSERT INTO vinyl (
              order_id, width, length, square_footage, quantity
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              orderId, 
              Number(vinyl.width) || 0, 
              Number(vinyl.length) || 0, 
              Number(vinyl.footage) || 0, 
              Number(vinyl.quantity) || 1
            ]
          );
        }
      }

      // Commit the transaction
      await client.query('COMMIT');

      // Fetch the updated order with all its details
      const updatedOrder = await query(
        `SELECT * FROM orders WHERE id = $1`,
        [orderId]
      );

      // After successful update, emit WebSocket event through the Socket.IO instance
      const io = (global as any).io;
      if (io) {
        const latestOrders = await fetchRecentOrders();
        io.emit('orderUpdate', latestOrders);
      }

      return NextResponse.json(updatedOrder.rows[0]);
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Always release the client
      client.release();
    }
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id] - Delete a specific order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = params.id;
    
    // Start a transaction
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Delete related records first
      await client.query('DELETE FROM skids WHERE order_id = $1', [orderId]);
      await client.query('DELETE FROM vinyl WHERE order_id = $1', [orderId]);
      await client.query('DELETE FROM footage WHERE order_id = $1', [orderId]);
      await client.query('DELETE FROM order_links WHERE order_id = $1', [orderId]);
      await client.query('DELETE FROM truckload_order_assignments WHERE order_id = $1', [orderId]);
      
      // Finally delete the order
      await client.query('DELETE FROM orders WHERE id = $1', [orderId]);
      
      // Commit the transaction
      await client.query('COMMIT');
      
      return NextResponse.json({ success: true });
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Always release the client
      client.release();
    }
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
} 