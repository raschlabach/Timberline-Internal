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
        AND (
          t.is_completed = false
          OR t.status != 'completed'
          OR t.start_date >= CURRENT_DATE - INTERVAL '90 days'
        )
      ORDER BY 
        CASE WHEN t.is_completed = false AND COALESCE(t.status, 'active') != 'completed' THEN 0 ELSE 1 END,
        t.start_date DESC
      LIMIT 50
    `, [driverId])

    // For each truckload, fetch its orders and documents
    const truckloads = []
    for (const truckload of truckloadsResult.rows) {
      // Fetch orders for this truckload
      const ordersResult = await query(`
        SELECT 
          o.id,
          toa.assignment_type as "assignmentType",
          toa.sequence_number as "sequenceNumber",
          pc.customer_name as "pickupCustomerName",
          dc.customer_name as "deliveryCustomerName",
          (
            COALESCE(
              (SELECT SUM(s.width * s.length * s.quantity) FROM skids s WHERE s.order_id = o.id),
              0
            ) + COALESCE(
              (SELECT SUM(v.width * v.length * v.quantity) FROM vinyl v WHERE v.order_id = o.id),
              0
            )
          ) as footage,
          COALESCE((SELECT COUNT(*) FROM skids s WHERE s.order_id = o.id), 0) as skids,
          COALESCE((SELECT COUNT(*) FROM vinyl v WHERE v.order_id = o.id), 0) as vinyl,
          o.comments,
          COALESCE(o.is_rush, false) as "isRush"
        FROM truckload_order_assignments toa
        JOIN orders o ON toa.order_id = o.id
        LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
        LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
        WHERE toa.truckload_id = $1
        ORDER BY toa.sequence_number ASC
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
