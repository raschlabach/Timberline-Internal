import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/species - Get all active species
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT * FROM lumber_species WHERE is_active = TRUE ORDER BY display_order, name`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching species:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/species - Create a new species
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
      `INSERT INTO lumber_species (name, color, display_order, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [body.name, body.color || '#6B7280', body.display_order || 0, body.is_active !== false]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') { // Unique constraint violation
      return NextResponse.json({ error: 'Species already exists' }, { status: 400 })
    }
    console.error('Error creating species:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
