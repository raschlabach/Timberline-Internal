import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/suppliers/locations - Get all supplier locations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT 
        sl.*,
        s.name as supplier_name
      FROM lumber_supplier_locations sl
      JOIN lumber_suppliers s ON sl.supplier_id = s.id
      WHERE s.is_active = TRUE
      ORDER BY s.name, sl.location_name
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/suppliers/locations - Create a new location
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.supplier_id || !body.location_name) {
      return NextResponse.json({ error: 'Supplier ID and location name are required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO lumber_supplier_locations (
        supplier_id, location_name, address, city, state, zip_code,
        phone_number_1, phone_number_2, notes, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        body.supplier_id,
        body.location_name,
        body.address || null,
        body.city || null,
        body.state || null,
        body.zip_code || null,
        body.phone_number_1 || null,
        body.phone_number_2 || null,
        body.notes || null,
        body.is_primary || false
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
