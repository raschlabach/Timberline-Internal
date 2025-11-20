import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET endpoint to serve uploaded files
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = params

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 })
    }

    // Find the file by URL pattern
    const result = await query(
      `SELECT file_data, file_type, file_name, file_size
       FROM order_links
       WHERE url = $1 AND file_data IS NOT NULL
       LIMIT 1`,
      [`/api/uploads/order-links/${fileId}`]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
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
    console.error('Error serving file:', error)
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    )
  }
}

