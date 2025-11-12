import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid file type. Only PDF and image files are allowed.' 
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

      // Create uploads directory if it doesn't exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'documents')
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // Generate unique filename
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop()
      const uniqueFileName = `order_${orderId}_${timestamp}.${fileExtension}`
      const filePath = join(uploadsDir, uniqueFileName)

      // Save file
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Save document attachment to database
      const attachmentResult = await client.query(
        `INSERT INTO document_attachments 
         (order_id, file_name, file_path, file_size, file_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [orderId, fileName || file.name, `/uploads/documents/${uniqueFileName}`, file.size, file.type, session.user.id]
      )

      const attachmentId = attachmentResult.rows[0].id

      // Create notification
      await client.query(
        `INSERT INTO notifications 
         (type, title, message, order_id, document_attachment_id)
         VALUES ($1, $2, $3, $4, $5)`,
        ['document_attachment', 'Paperwork Attached', `Special paperwork has been attached to order #${orderId}`, orderId, attachmentId]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        attachment: {
          id: attachmentId,
          fileName: fileName || file.name,
          filePath: `/uploads/documents/${uniqueFileName}`,
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
      const result = await client.query(
        `SELECT 
          da.id,
          da.file_name,
          da.file_path,
          da.file_size,
          da.file_type,
          da.created_at,
          u.username as uploaded_by
         FROM document_attachments da
         LEFT JOIN users u ON da.uploaded_by = u.id
         WHERE da.order_id = $1
         ORDER BY da.created_at DESC`,
        [orderId]
      )

      return NextResponse.json({
        success: true,
        documents: result.rows
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

    if (!documentId) {
      return NextResponse.json({ success: false, error: 'Document ID required' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Get document info before deleting
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
