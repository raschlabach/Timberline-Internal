import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const loadId = formData.get('loadId') as string

    if (!file || !loadId) {
      return NextResponse.json(
        { error: 'File and loadId are required' },
        { status: 400 }
      )
    }

    // Create unique filename
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${Date.now()}-${file.name}`
    const filepath = join(process.cwd(), 'public', 'uploads', filename)

    // Save file
    await writeFile(filepath, buffer)

    // Save document reference to database
    const result = await query(
      `INSERT INTO lumber_load_documents 
        (load_id, filename, filepath, file_type, uploaded_by, uploaded_at)
       VALUES 
        ((SELECT id FROM lumber_loads WHERE load_id = $1), $2, $3, $4, $5, NOW())
       RETURNING *`,
      [loadId, file.name, `/uploads/${filename}`, file.type, session.user.email]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const loadId = searchParams.get('loadId')

    if (!loadId) {
      return NextResponse.json({ error: 'loadId required' }, { status: 400 })
    }

    const result = await query(
      `SELECT d.*, l.load_id as load_load_id
       FROM lumber_load_documents d
       JOIN lumber_loads l ON l.id = d.load_id
       WHERE l.load_id = $1
       ORDER BY d.uploaded_at DESC`,
      [loadId]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}
