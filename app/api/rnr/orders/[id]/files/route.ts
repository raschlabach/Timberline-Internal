import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'
import { query } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const setAsOriginal = formData.get('setAsOriginal') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const uniqueFilename = `rnr-orders/${params.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    const blob = await put(uniqueFilename, file, { access: 'public' })

    const result = await query(
      `INSERT INTO rnr_order_files (order_id, file_name, file_url, file_type, file_size)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [params.id, file.name, blob.url, file.type, file.size]
    )

    if (setAsOriginal) {
      await query(
        `UPDATE rnr_orders SET original_file_url = $1, original_file_name = $2, updated_at = NOW() WHERE id = $3`,
        [blob.url, file.name, params.id]
      )
    }

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT * FROM rnr_order_files WHERE order_id = $1 ORDER BY uploaded_at DESC`,
      [params.id]
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error fetching files:', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}
