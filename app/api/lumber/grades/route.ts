import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/grades - Get all active grades
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT * FROM lumber_grades WHERE is_active = TRUE ORDER BY display_order, name`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching grades:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/grades - Create a new grade
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO lumber_grades (name, display_order, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [body.name, body.display_order || 0, body.is_active !== false]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') { // Unique constraint violation
      return NextResponse.json({ error: 'Grade already exists' }, { status: 400 })
    }
    console.error('Error creating grade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
