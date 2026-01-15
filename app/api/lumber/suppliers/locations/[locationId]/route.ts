import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/suppliers/locations/[locationId] - Get a single location
export async function GET(
  request: NextRequest,
  { params }: { params: { locationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT sl.*, s.name as supplier_name 
       FROM lumber_supplier_locations sl
       JOIN lumber_suppliers s ON sl.supplier_id = s.id
       WHERE sl.id = $1`,
      [params.locationId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/lumber/suppliers/locations/[locationId] - Update a location
export async function PATCH(
  request: NextRequest,
  { params }: { params: { locationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const result = await query(
      `UPDATE lumber_supplier_locations
       SET location_name = COALESCE($1, location_name),
           address = COALESCE($2, address),
           city = COALESCE($3, city),
           state = COALESCE($4, state),
           zip_code = COALESCE($5, zip_code),
           phone_number_1 = COALESCE($6, phone_number_1),
           phone_number_2 = COALESCE($7, phone_number_2),
           notes = COALESCE($8, notes),
           is_primary = COALESCE($9, is_primary),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        body.location_name,
        body.address,
        body.city,
        body.state,
        body.zip_code,
        body.phone_number_1,
        body.phone_number_2,
        body.notes,
        body.is_primary,
        params.locationId
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/suppliers/locations/[locationId] - Delete a location
export async function DELETE(
  request: NextRequest,
  { params }: { params: { locationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `DELETE FROM lumber_supplier_locations WHERE id = $1 RETURNING *`,
      [params.locationId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
