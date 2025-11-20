import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = parseInt(params.id)
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file type - check extension if MIME type is empty
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp']
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const isValidMimeType = allowedTypes.includes(file.type)
    const isValidExtension = allowedExtensions.includes(fileExtension)

    if (!isValidMimeType && !isValidExtension) {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid file type. Only PDF and image files are allowed. Received: ${file.type || fileExtension}` 
      }, { status: 400 })
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        success: false, 
        error: 'File too large. Maximum size is 10MB.' 
      }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Check if order exists
      const orderResult = await client.query('SELECT id FROM orders WHERE id = $1', [orderId])
      if (orderResult.rows.length === 0) {
        throw new Error('Order not found')
      }

      // Convert file to base64 for database storage (works in serverless environments)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64Data = buffer.toString('base64')

      // Save document attachment to database with file data
      // We'll update the file_path after we get the ID
      const attachmentResult = await client.query(
        `INSERT INTO document_attachments 
         (order_id, file_name, file_path, file_size, file_type, uploaded_by, file_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [orderId, fileName || file.name, '', file.size, file.type, session.user.id, base64Data]
      )

      const attachmentId = attachmentResult.rows[0].id
      
      // Update file_path to point to the API endpoint
      const filePath = `/api/orders/${orderId}/documents/${attachmentId}`
      await client.query(
        `UPDATE document_attachments SET file_path = $1 WHERE id = $2`,
        [filePath, attachmentId]
      )

      // Create notification
      const notificationResult = await client.query(
        `INSERT INTO notifications 
         (type, title, message, order_id, document_attachment_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['document_attachment', 'Paperwork Attached', `Special paperwork has been attached to order #${orderId}`, orderId, attachmentId]
      )
      console.log('Notification created:', notificationResult.rows[0].id)

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        attachment: {
          id: attachmentId,
          fileName: fileName || file.name,
          filePath: filePath,
          fileSize: file.size,
          fileType: file.type
        }
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to upload document'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = parseInt(params.id)
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
    }

    const client = await getClient()
    try {
      // Fetch documents from both document_attachments and order_links (for files uploaded during order creation)
      const result = await client.query(
        `SELECT 
          da.id::text as id,
          da.file_name,
          da.file_path,
          da.file_size,
          da.file_type,
          da.created_at,
          COALESCE(u.username, 'System') as uploaded_by,
          'document_attachment' as source
         FROM document_attachments da
         LEFT JOIN users u ON da.uploaded_by = u.id
         WHERE da.order_id = $1
         
         UNION ALL
         
         SELECT 
          ol.id::text as id,
          COALESCE(ol.file_name, ol.description, 'Uploaded File') as file_name,
          ol.url as file_path,
          ol.file_size,
          ol.file_type,
          ol.created_at,
          'Order Entry' as uploaded_by,
          'order_link' as source
         FROM order_links ol
         WHERE ol.order_id = $1 
           AND ol.file_data IS NOT NULL
         
         ORDER BY created_at DESC`,
        [orderId]
      )

      // Transform the results to match the expected format
      const documents = result.rows.map((row: any) => {
        // For order_links, construct the file path to the API endpoint
        const filePath = row.source === 'order_link' 
          ? `/api/orders/${orderId}/documents/order-links/${row.id}`
          : row.file_path
        
        return {
          id: row.id,
          file_name: row.file_name,
          file_path: filePath,
          file_size: row.file_size,
          file_type: row.file_type,
          created_at: row.created_at,
          uploaded_by: row.uploaded_by || 'Order Entry',
          source: row.source
        }
      })

      return NextResponse.json({
        success: true,
        documents: documents
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch documents'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = parseInt(params.id)
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    const source = searchParams.get('source') // 'document_attachment' or 'order_link'

    if (!documentId) {
      return NextResponse.json({ success: false, error: 'Document ID required' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Determine which table to delete from based on source
      if (source === 'order_link') {
        // Delete from order_links
        const linkResult = await client.query(
          'SELECT id FROM order_links WHERE id = $1 AND order_id = $2',
          [documentId, orderId]
        )

        if (linkResult.rows.length === 0) {
          throw new Error('Link not found')
        }

        // Delete the link (this will also remove the file_data)
        await client.query(
          'DELETE FROM order_links WHERE id = $1 AND order_id = $2',
          [documentId, orderId]
        )

        // Delete related notifications (order_link type)
        // Note: order_link notifications don't have a direct link_id reference,
        // so we delete all order_link notifications for this order
        // This is acceptable since deleting a link should remove its notification
        await client.query(
          `DELETE FROM notifications 
           WHERE order_id = $1 
           AND type = 'order_link'`,
          [orderId]
        )
      } else {
        // Delete from document_attachments (default)
        const docResult = await client.query(
          'SELECT file_path FROM document_attachments WHERE id = $1 AND order_id = $2',
          [documentId, orderId]
        )

        if (docResult.rows.length === 0) {
          throw new Error('Document not found')
        }

        // Delete from database
        await client.query(
          'DELETE FROM document_attachments WHERE id = $1 AND order_id = $2',
          [documentId, orderId]
        )

        // Delete related notifications
        await client.query(
          'DELETE FROM notifications WHERE document_attachment_id = $1',
          [documentId]
        )
      }

      await client.query('COMMIT')

      return NextResponse.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete document'
    }, { status: 500 })
  }
}
