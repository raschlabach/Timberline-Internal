import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/for-trucking - Get loads needing trucking assignment
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT 
        l.*,
        s.name as supplier_name,
        sl.location_name,
        sl.phone_number_1,
        sl.phone_number_2,
        d.name as driver_name,
        json_agg(
          json_build_object(
            'id', li.id,
            'species', li.species,
            'grade', li.grade,
            'thickness', li.thickness,
            'estimated_footage', li.estimated_footage,
            'actual_footage', li.actual_footage,
            'price', li.price
          ) ORDER BY li.id
        ) as items
      FROM lumber_loads l
      JOIN lumber_suppliers s ON l.supplier_id = s.id
      LEFT JOIN lumber_supplier_locations sl ON l.supplier_location_id = sl.id
      LEFT JOIN lumber_drivers d ON l.driver_id = d.id
      LEFT JOIN lumber_load_items li ON l.id = li.load_id
      WHERE COALESCE(l.all_packs_finished, FALSE) = FALSE
        AND li.actual_footage IS NULL
      GROUP BY l.id, s.name, sl.location_name, sl.phone_number_1, sl.phone_number_2, d.name
      ORDER BY l.estimated_delivery_date NULLS LAST, l.created_at
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching trucking loads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
