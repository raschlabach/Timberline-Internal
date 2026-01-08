import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// GET /api/lumber/suppliers - Get all suppliers with their locations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT 
        s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sl.id,
              'supplier_id', sl.supplier_id,
              'location_name', sl.location_name,
              'address', sl.address,
              'city', sl.city,
              'state', sl.state,
              'zip_code', sl.zip_code,
              'phone_number_1', sl.phone_number_1,
              'phone_number_2', sl.phone_number_2,
              'notes', sl.notes,
              'is_primary', sl.is_primary
            ) ORDER BY sl.is_primary DESC, sl.location_name
          ) FILTER (WHERE sl.id IS NOT NULL),
          '[]'::json
        ) as locations
      FROM lumber_suppliers s
      LEFT JOIN lumber_supplier_locations sl ON s.id = sl.supplier_id
      WHERE s.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.name
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/suppliers - Create a new supplier
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
      `INSERT INTO lumber_suppliers (name, notes, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [body.name, body.notes || null, body.is_active !== false]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
