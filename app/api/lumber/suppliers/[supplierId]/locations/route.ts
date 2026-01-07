import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// POST /api/lumber/suppliers/[supplierId]/locations - Add a location to a supplier
export async function POST(
  request: NextRequest,
  { params }: { params: { supplierId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.location_name) {
      return NextResponse.json({ error: 'Location name is required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO lumber_supplier_locations (
        supplier_id, location_name, address, city, state, zip_code,
        phone_number_1, phone_number_2, notes, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        params.supplierId,
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
    console.error('Error adding location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
