import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET endpoint to serve document files from database
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = parseInt(params.id)
    const documentId = parseInt(params.documentId)

    if (isNaN(orderId) || isNaN(documentId)) {
      return NextResponse.json({ error: 'Invalid order or document ID' }, { status: 400 })
    }

    // Find the document with file data
    const result = await query(
      `SELECT file_data, file_type, file_name, file_size
       FROM document_attachments
       WHERE id = $1 AND order_id = $2 AND file_data IS NOT NULL
       LIMIT 1`,
      [documentId, orderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const file = result.rows[0]
    const buffer = Buffer.from(file.file_data, 'base64')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.file_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${file.file_name}"`,
        'Content-Length': file.file_size.toString(),
      },
    })
  } catch (error) {
    console.error('Error serving document:', error)
    return NextResponse.json(
      { error: 'Failed to serve document' },
      { status: 500 }
    )
  }
}

