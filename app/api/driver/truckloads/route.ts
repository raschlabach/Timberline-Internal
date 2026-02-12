import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/driver/truckloads - Get the current driver's truckloads with orders and documents
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(session.user.id)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 })
    }

    // Fetch driver's truckloads (recent first, last 90 days + all non-completed)
    const truckloadsResult = await query(`
      SELECT 
        t.id,
        TO_CHAR(t.start_date, 'YYYY-MM-DD') as "startDate",
        TO_CHAR(t.end_date, 'YYYY-MM-DD') as "endDate",
        t.trailer_number as "trailerNumber",
        t.bill_of_lading_number as "billOfLadingNumber",
        t.description,
        t.is_completed as "isCompleted",
        COALESCE(t.status, 'active') as "status",
        t.total_mileage as "totalMileage"
      FROM truckloads t
      WHERE t.driver_id = $1
        AND COALESCE(t.status, 'active') != 'draft'
        AND t.is_completed = false
        AND COALESCE(t.status, 'active') != 'completed'
      ORDER BY t.start_date DESC
      LIMIT 50
    `, [driverId])

    // For each truckload, fetch its orders and documents
    const truckloads = []
    for (const truckload of truckloadsResult.rows) {
      // Fetch orders for this truckload with full customer + freight detail
      const ordersResult = await query(`
        WITH skids_summary AS (
          SELECT 
            order_id,
            COUNT(*) as skids_count,
            SUM(width * length * quantity) as total_skid_footage,
            json_agg(
              json_build_object(
                'id', id, 'type', 'skid',
                'width', width, 'length', length,
                'footage', square_footage,
                'quantity', quantity
              )
            ) as skids_data
          FROM skids GROUP BY order_id
        ),
        vinyl_summary AS (
          SELECT 
            order_id,
            COUNT(*) as vinyl_count,
            SUM(width * length * quantity) as total_vinyl_footage,
            json_agg(
              json_build_object(
                'id', id, 'type', 'vinyl',
                'width', width, 'length', length,
                'footage', square_footage,
                'quantity', quantity
              )
            ) as vinyl_data
          FROM vinyl GROUP BY order_id
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
        )
        SELECT 
          o.id,
          toa.assignment_type as "assignmentType",
          toa.sequence_number as "sequenceNumber",
          -- Pickup customer full info
          json_build_object(
            'id', pc.id,
            'name', pc.customer_name,
            'address', CONCAT_WS(', ', NULLIF(pl.address, ''), NULLIF(pl.city, ''), NULLIF(pl.state, '')),
            'phone', pc.phone_number_1,
            'phone2', pc.phone_number_2,
            'notes', pc.notes
          ) as "pickupCustomer",
          -- Delivery customer full info
          json_build_object(
            'id', dc.id,
            'name', dc.customer_name,
            'address', CONCAT_WS(', ', NULLIF(dl.address, ''), NULLIF(dl.city, ''), NULLIF(dl.state, '')),
            'phone', dc.phone_number_1,
            'phone2', dc.phone_number_2,
            'notes', dc.notes
          ) as "deliveryCustomer",
          -- Freight totals
          (
            COALESCE(ss.total_skid_footage, 0) + COALESCE(vs.total_vinyl_footage, 0)
          ) as footage,
          COALESCE(ss.skids_count, 0) as skids,
          COALESCE(vs.vinyl_count, 0) as vinyl,
          COALESCE(hbs.hand_bundles_count, 0) as "handBundles",
          -- Freight detail arrays
          COALESCE(ss.skids_data, '[]'::json) as "skidsData",
          COALESCE(vs.vinyl_data, '[]'::json) as "vinylData",
          COALESCE(hbs.hand_bundles_data, '[]'::json) as "handBundlesData",
          -- Order metadata
          o.comments,
          COALESCE(o.is_rush, false) as "isRush",
          COALESCE(o.needs_attention, false) as "needsAttention",
          COALESCE(o.is_transfer_order, false) as "isTransferOrder"
        FROM truckload_order_assignments toa
        JOIN orders o ON toa.order_id = o.id
        LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
        LEFT JOIN locations pl ON pc.location_id = pl.id
        LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
        LEFT JOIN locations dl ON dc.location_id = dl.id
        LEFT JOIN skids_summary ss ON o.id = ss.order_id
        LEFT JOIN vinyl_summary vs ON o.id = vs.order_id
        LEFT JOIN hand_bundles_summary hbs ON o.id = hbs.order_id
        WHERE toa.truckload_id = $1
        ORDER BY toa.sequence_number DESC
      `, [truckload.id])

      // Fetch documents for each order
      const ordersWithDocs = []
      for (const order of ordersResult.rows) {
        let documents: any[] = []
        try {
          const docsResult = await query(`
            SELECT 
              da.id::text as id,
              da.file_name as "fileName",
              da.file_path as "filePath",
              da.file_type as "fileType",
              da.file_size as "fileSize",
              COALESCE(u.username, 'System') as "uploadedBy",
              da.created_at as "createdAt",
              'document_attachment' as source
            FROM document_attachments da
            LEFT JOIN users u ON da.uploaded_by = u.id
            WHERE da.order_id = $1

            UNION ALL

            SELECT 
              ol.id::text as id,
              COALESCE(ol.file_name, ol.description, 'Uploaded File') as "fileName",
              CONCAT('/api/orders/', $1::text, '/documents/order-links/', ol.id::text) as "filePath",
              ol.file_type as "fileType",
              ol.file_size as "fileSize",
              'Order Entry' as "uploadedBy",
              ol.created_at as "createdAt",
              'order_link' as source
            FROM order_links ol
            WHERE ol.order_id = $1 
              AND ol.file_data IS NOT NULL

            ORDER BY "createdAt" DESC
          `, [order.id])
          documents = docsResult.rows
        } catch {
          // Documents tables might not exist or have issues
          documents = []
        }

        ordersWithDocs.push({
          ...order,
          footage: Number(order.footage) || 0,
          skids: Number(order.skids) || 0,
          vinyl: Number(order.vinyl) || 0,
          handBundles: Number(order.handBundles) || 0,
          documents,
        })
      }

      truckloads.push({
        ...truckload,
        orders: ordersWithDocs,
      })
    }

    return NextResponse.json({
      success: true,
      truckloads,
    })
  } catch (error) {
    console.error('Error fetching driver truckloads:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch truckloads',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
