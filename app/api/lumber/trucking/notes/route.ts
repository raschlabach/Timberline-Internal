import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// GET /api/lumber/trucking/notes - Get all trucking notes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT * FROM lumber_trucking_notes ORDER BY created_at DESC LIMIT 50`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching trucking notes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/trucking/notes - Create a trucking note
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.note_text) {
      return NextResponse.json({ error: 'Note text is required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO lumber_trucking_notes (note_text, created_by)
       VALUES ($1, $2)
       RETURNING *`,
      [body.note_text, session.user.id]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating trucking note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
