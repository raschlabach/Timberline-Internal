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
    const operatorId = searchParams.get('operatorId')

    let whereClause = '1=1'
    const params: any[] = []
    let paramIndex = 1

    if (month && year) {
      whereClause += ` AND EXTRACT(MONTH FROM ws.work_date) = $${paramIndex} AND EXTRACT(YEAR FROM ws.work_date) = $${paramIndex + 1}`
      params.push(parseInt(month), parseInt(year))
      paramIndex += 2
    }

    if (operatorId) {
      whereClause += ` AND ws.operator_id = $${paramIndex}`
      params.push(parseInt(operatorId))
      paramIndex++
    }

    const result = await query(
      `SELECT 
        ws.*,
        lo.name as operator_name
       FROM lumber_work_sessions ws
       LEFT JOIN lumber_operators lo ON ws.operator_id = lo.id
       WHERE ${whereClause}
       ORDER BY ws.work_date DESC, lo.name`,
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
    const { operator_id, work_date, start_time, end_time, notes } = body

    if (!operator_id || !work_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if a session already exists for this operator on this date
    const existing = await query(
      'SELECT id FROM lumber_work_sessions WHERE operator_id = $1 AND work_date = $2',
      [operator_id, work_date]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'A work session already exists for this operator on this date' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO lumber_work_sessions (operator_id, work_date, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [operator_id, work_date, start_time, end_time, notes || null]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error creating work session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
