import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/operators - Get all operators
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT * FROM lumber_operators 
       ORDER BY display_order ASC, name ASC`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching operators:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/operators - Create a new operator
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, is_active, display_order } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO lumber_operators (name, is_active, display_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, is_active ?? true, display_order ?? 0]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    console.error('Error creating operator:', error)
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'An operator with this name already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
