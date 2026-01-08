import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/load-id-ranges - Get all load ID ranges
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT * FROM lumber_load_id_ranges
      ORDER BY is_active DESC, id DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching load ID ranges:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/load-id-ranges - Create a new load ID range
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.range_name || !body.start_range || !body.end_range) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (body.end_range <= body.start_range) {
      return NextResponse.json({ error: 'End range must be greater than start range' }, { status: 400 })
    }

    // If setting this as active, deactivate all other ranges
    if (body.is_active) {
      await query('UPDATE lumber_load_id_ranges SET is_active = FALSE')
    }

    const result = await query(
      `INSERT INTO lumber_load_id_ranges (range_name, start_range, end_range, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [body.range_name, body.start_range, body.end_range, body.is_active !== false]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating load ID range:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
