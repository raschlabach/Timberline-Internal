import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { loadId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { loadId } = params

    const result = await query(
      `SELECT 
        l.id,
        l.load_id,
        l.supplier_id,
        s.name as supplier_name,
        sl.location_name,
        l.estimated_delivery_date,
        l.actual_arrival_date,
        l.pickup_number,
        l.plant,
        l.all_packs_finished,
        l.load_quality
      FROM lumber_loads l
      LEFT JOIN lumber_suppliers s ON l.supplier_id = s.id
      LEFT JOIN lumber_supplier_locations sl ON l.supplier_location_id = sl.id
      WHERE l.load_id = $1`,
      [loadId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching load by load_id:', error)
    return NextResponse.json({ error: 'Failed to fetch load' }, { status: 500 })
  }
}
