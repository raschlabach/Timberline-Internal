import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/orders - List all orders
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('Unauthorized request to /api/orders');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("Fetching orders from database...");
    
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
        COALESCE(u.full_name, 'System') as creator,
        o.created_at as "createdDate",
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
      WHERE 
        -- Only show unassigned orders for the load board
        o.status = 'unassigned'
      ORDER BY 
        -- Show rush orders first, then by pickup date
        o.is_rush DESC,
        o.pickup_date ASC,
        o.created_at DESC
    `;

    console.log("Executing SQL query:", sqlQuery);
    
    // First, let's check if we have any orders at all
    const orderCountResult = await query('SELECT COUNT(*) as count FROM orders');
    console.log("Total orders in database:", orderCountResult.rows[0].count);
    
    // Check unassigned orders
    const unassignedOrderCountResult = await query("SELECT COUNT(*) as count FROM orders WHERE status = 'unassigned'");
    console.log("Unassigned orders:", unassignedOrderCountResult.rows[0].count);

    // Execute the main query
    const ordersResult = await query(sqlQuery);
    console.log("Query returned rows:", ordersResult.rows.length);
    
    if (ordersResult.rows.length === 0) {
      console.log("No orders found. Checking individual tables...");
      
      // Check total orders
      const totalOrdersCount = await query('SELECT COUNT(*) as count FROM orders');
      console.log("Total orders in database:", totalOrdersCount.rows[0].count);
      
      // Check unassigned orders specifically
      const unassignedCount = await query("SELECT COUNT(*) as count FROM orders WHERE status = 'unassigned'");
      console.log("Unassigned orders count:", unassignedCount.rows[0].count);
      
      // Check order statuses
      const statusBreakdown = await query("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
      console.log("Order status breakdown:", statusBreakdown.rows);
      
      // Check customers
      const customerCount = await query('SELECT COUNT(*) as count FROM customers');
      console.log("Total customers:", customerCount.rows[0].count);
      
      // Check freight tables
      const skidsCount = await query('SELECT COUNT(*) as count FROM skids');
      const vinylCount = await query('SELECT COUNT(*) as count FROM vinyl');
      const footageCount = await query('SELECT COUNT(*) as count FROM footage');
      console.log("Freight counts - Skids:", skidsCount.rows[0].count, 
                  "Vinyl:", vinylCount.rows[0].count, 
                  "Footage:", footageCount.rows[0].count);
    } else {
      console.log("Orders found, sample order IDs:", ordersResult.rows.slice(0, 3).map((r: any) => r.id));
    }

    // Transform the data to match the Order interface
    const orders = ordersResult.rows.map((row: any) => {
      // Parse dates
      const createdDate = row.createdDate ? new Date(row.createdDate) : new Date();
      const pickupDate = row.pickupDate ? new Date(row.pickupDate) : new Date();
      const lastEditedAt = row.lastEditedAt ? new Date(row.lastEditedAt) : undefined;

      return {
        id: row.id.toString(),
        creator: row.creator || 'System',
        createdDate,
        status: row.status || 'unassigned',
        isRushOrder: row.isRushOrder || false,
        needsAttention: row.needsAttention || false,
        comments: row.comments || '',
        pickupCustomer: row.pickupCustomer || {
          id: 0,
          name: '',
          address: ''
        },
        deliveryCustomer: row.deliveryCustomer || {
          id: 0,
          name: '',
          address: ''
        },
        skids: Number(row.skids || 0),
        vinyl: Number(row.vinyl || 0),
        footage: Number(row.footage || 0),
        pickupDate,
        filters: row.filters || {
          ohioToIndiana: false,
          backhaul: false,
          localFlatbed: false,
          rrOrder: false,
          localSemi: false,
          middlefield: false,
          paNy: false
        },
        freightQuote: row.freightQuote?.toString() || undefined,
        links: row.links || [],
        lastEditedBy: row.lastEditedBy || undefined,
        lastEditedAt
      };
    });

    console.log("Returning transformed orders:", orders.length);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const client = await getClient();
  
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      client.release();
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    console.log('Order creation request:', { 
      hasPickupCustomer: !!data.pickupCustomer?.id,
      hasDeliveryCustomer: !!data.deliveryCustomer?.id,
      hasPickupDate: !!data.pickupDate,
      freightType: data.freightType,
      userId: session.user.id
    });
    
    // Validate required fields
    if (!data.pickupCustomer?.id) {
      client.release();
      return NextResponse.json({ error: 'Pickup customer is required' }, { status: 400 });
    }
    if (!data.deliveryCustomer?.id) {
      client.release();
      return NextResponse.json({ error: 'Delivery customer is required' }, { status: 400 });
    }
    if (!data.pickupDate) {
      client.release();
      return NextResponse.json({ error: 'Pickup date is required' }, { status: 400 });
    }

    // Start a transaction
    try {
      await client.query('BEGIN');
      console.log('Transaction started');

      // Insert the order
      const orderResult = await client.query(
        `INSERT INTO orders (
          pickup_customer_id,
          delivery_customer_id,
          paying_customer_id,
          pickup_date,
          freight_quote,
          comments,
          is_rush,
          needs_attention,
          oh_to_in,
          backhaul,
          local_semi,
          local_flatbed,
          rr_order,
          middlefield,
          pa_ny,
          created_by,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id`,
        [
          data.pickupCustomer.id,
          data.deliveryCustomer.id,
          data.payingCustomer?.id || null,
          // Ensure pickupDate is a date string (YYYY-MM-DD) or null
          // PostgreSQL DATE type handles this correctly without timezone conversion
          data.pickupDate && typeof data.pickupDate === 'string' 
            ? data.pickupDate 
            : (data.pickupDate ? new Date(data.pickupDate).toISOString().split('T')[0] : null),
          data.freightQuote || null,
          data.comments || null,
          data.statusFlags?.rushOrder || false,
          data.statusFlags?.needsAttention || false,
          data.filters?.ohioToIndiana || false,
          data.filters?.backhaul || false,
          data.filters?.localSemi || false,
          data.filters?.localFlatbed || false,
          data.filters?.rrOrder || false,
          data.filters?.middlefield || false,
          data.filters?.paNy || false,
          session.user.id,
          'unassigned'
        ]
      );

      const orderId = orderResult.rows[0].id;
      console.log('Order inserted with ID:', orderId);

      // Insert skids/vinyl if present
      if (data.freightType === 'skidsVinyl' && data.skidsVinyl?.length > 0) {
        for (const item of data.skidsVinyl) {
          await client.query(
            `INSERT INTO ${item.type === 'skid' ? 'skids' : 'vinyl'} (
              order_id,
              width,
              length,
              square_footage,
              quantity
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              orderId,
              item.width,
              item.length,
              item.footage,
              1 // Default quantity
            ]
          );
        }
      }

      // Insert footage if present
      if (data.freightType === 'footage' && data.footage > 0) {
        await client.query(
          `INSERT INTO footage (
            order_id,
            square_footage
          ) VALUES ($1, $2)`,
          [orderId, data.footage]
        );
      }

      // Insert hand bundles if present
      if (data.handBundles?.length > 0) {
        for (const handBundle of data.handBundles) {
          await client.query(
            `INSERT INTO freight_items (
              order_id,
              type,
              quantity,
              description,
              created_by
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              orderId,
              'hand_bundle',
              handBundle.quantity,
              handBundle.description,
              session.user.id
            ]
          );
        }
      }

      // Insert order links if present
      if (data.links?.length > 0) {
        for (const link of data.links) {
          await client.query(
            `INSERT INTO order_links (
              order_id,
              url,
              description
            ) VALUES ($1, $2, $3)`,
            [orderId, link.url, link.description || null]
          );

          await client.query(
            `INSERT INTO notifications (
              type,
              title,
              message,
              order_id
            ) VALUES ($1, $2, $3, $4)`,
            [
              'order_link',
              'Order Link Added',
              `A new link (${link.description || link.url}) was added to order #${orderId}`,
              orderId,
            ]
          );
        }
      }

      // Commit the transaction
      await client.query('COMMIT');
      console.log('Transaction committed successfully');

      return NextResponse.json({ 
        success: true, 
        message: 'Order created successfully',
        orderId 
      });

    } catch (error) {
      // Rollback on error
      console.error('Error in transaction, rolling back:', error);
      try {
        await client.query('ROLLBACK');
        console.log('Rollback successful');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating order:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : { error: String(error) };
    console.error('Error details:', errorDetails);
    return NextResponse.json(
      { 
        error: errorMessage || 'Failed to create order',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
} 