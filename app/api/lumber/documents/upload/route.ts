import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { query } from '@/lib/db'
import { existsSync } from 'fs'

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
    const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    const filepath = join(uploadDir, uniqueFilename)

    // Ensure uploads directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Save file
    await writeFile(filepath, buffer)

    // Get user ID for uploaded_by (or null if not found)
    let uploadedByUserId = null
    if (session.user?.email) {
      const userResult = await query(
        'SELECT id FROM users WHERE email = $1',
        [session.user.email]
      )
      if (userResult.rows.length > 0) {
        uploadedByUserId = userResult.rows[0].id
      }
    }

    // Save document reference to database (using correct column names)
    const result = await query(
      `INSERT INTO lumber_load_documents 
        (load_id, file_name, file_path, file_type, uploaded_by, created_at)
       VALUES 
        ((SELECT id FROM lumber_loads WHERE load_id = $1), $2, $3, $4, $5, NOW())
       RETURNING *`,
      [loadId, file.name, `/uploads/${uniqueFilename}`, file.type, uploadedByUserId]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
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
      `SELECT 
        d.id,
        d.load_id,
        d.file_name as filename,
        d.file_path as filepath,
        d.file_type,
        d.document_type,
        d.uploaded_by,
        d.created_at as uploaded_at,
        l.load_id as load_load_id
       FROM lumber_load_documents d
       JOIN lumber_loads l ON l.id = d.load_id
       WHERE l.load_id = $1
       ORDER BY d.created_at DESC`,
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
