import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/planner-notes - Get planner notes for a date range
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const noteType = searchParams.get('noteType')

    let whereClause = 'WHERE 1=1'
    const values: any[] = []
    let paramIndex = 1

    if (startDate && endDate) {
      whereClause += ` AND pn.note_date >= $${paramIndex}::date AND pn.note_date <= $${paramIndex + 1}::date`
      values.push(startDate, endDate)
      paramIndex += 2
    }

    if (noteType) {
      whereClause += ` AND pn.note_type = $${paramIndex}`
      values.push(noteType)
      paramIndex++
    }

    const result = await query(`
      SELECT 
        pn.id,
        pn.note_type as "noteType",
        TO_CHAR(pn.note_date, 'YYYY-MM-DD') as "noteDate",
        pn.content,
        pn.created_by as "createdBy",
        u.full_name as "createdByName",
        pn.created_at as "createdAt",
        pn.updated_at as "updatedAt"
      FROM planner_notes pn
      LEFT JOIN users u ON pn.created_by = u.id
      ${whereClause}
      ORDER BY pn.note_date ASC
    `, values)

    return NextResponse.json({
      success: true,
      notes: result.rows
    })
  } catch (error) {
    console.error('Error fetching planner notes:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch planner notes'
    }, { status: 500 })
  }
}

// POST /api/planner-notes - Create or update a planner note
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { noteType, noteDate, content } = await request.json()

    if (!noteType || !noteDate || !content) {
      return NextResponse.json({
        success: false,
        error: 'noteType, noteDate, and content are required'
      }, { status: 400 })
    }

    // Upsert: if a note already exists for this date+type, update it; otherwise create
    const existing = await query(
      `SELECT id FROM planner_notes WHERE note_type = $1 AND note_date = $2`,
      [noteType, noteDate]
    )

    let result
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE planner_notes 
         SET content = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING 
           id,
           note_type as "noteType",
           TO_CHAR(note_date, 'YYYY-MM-DD') as "noteDate",
           content`,
        [content, existing.rows[0].id]
      )
    } else {
      result = await query(
        `INSERT INTO planner_notes (note_type, note_date, content, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING 
           id,
           note_type as "noteType",
           TO_CHAR(note_date, 'YYYY-MM-DD') as "noteDate",
           content`,
        [noteType, noteDate, content, session.user.id]
      )
    }

    return NextResponse.json({
      success: true,
      note: result.rows[0]
    })
  } catch (error) {
    console.error('Error creating/updating planner note:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to save planner note'
    }, { status: 500 })
  }
}
