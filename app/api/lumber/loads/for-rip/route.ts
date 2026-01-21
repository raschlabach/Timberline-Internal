import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/for-rip - Get loads ready for rip entry
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
        ) as items,
        COALESCE(SUM(li.actual_footage), 0) as total_footage,
        COALESCE((
          SELECT SUM(COALESCE(p.tally_board_feet, p.actual_board_feet))
          FROM lumber_packs p
          WHERE p.load_id = l.id AND p.is_finished = TRUE
        ), 0) as finished_footage
      FROM lumber_loads l
      JOIN lumber_suppliers s ON l.supplier_id = s.id
      LEFT JOIN lumber_load_items li ON l.id = li.load_id
      WHERE COALESCE(l.all_packs_finished, FALSE) = FALSE
        AND EXISTS (SELECT 1 FROM lumber_load_items WHERE load_id = l.id AND actual_footage IS NOT NULL)
      GROUP BY l.id, s.name
      ORDER BY l.actual_arrival_date
    `)

    // Calculate remaining footage for each load
    for (const load of result.rows) {
      load.current_footage = load.total_footage - load.finished_footage
    }

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching loads for rip:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
