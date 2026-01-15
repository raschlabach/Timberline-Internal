import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/work-sessions - Get work sessions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    let whereClause = '1=1'
    const params: any[] = []
    let paramIndex = 1

    if (month && year) {
      whereClause += ` AND EXTRACT(MONTH FROM work_date) = $${paramIndex} AND EXTRACT(YEAR FROM work_date) = $${paramIndex + 1}`
      params.push(parseInt(month), parseInt(year))
      paramIndex += 2
    }

    const result = await query(
      `SELECT * FROM lumber_work_sessions
       WHERE ${whereClause}
       ORDER BY work_date ASC`,
      params
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching work sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/work-sessions - Create a work session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { work_date, start_time, end_time, notes } = body

    if (!work_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if a session already exists for this date
    const existing = await query(
      'SELECT id FROM lumber_work_sessions WHERE work_date = $1',
      [work_date]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'A work session already exists for this date' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO lumber_work_sessions (work_date, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [work_date, start_time, end_time, notes || null]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error creating work session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
