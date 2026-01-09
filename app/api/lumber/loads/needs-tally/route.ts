import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/needs-tally - Get loads needing tally entry
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT 
        l.*,
        s.name as supplier_name
      FROM lumber_loads l
      JOIN lumber_suppliers s ON l.supplier_id = s.id
      WHERE l.actual_arrival_date IS NOT NULL 
        AND l.all_packs_tallied = FALSE
        AND COALESCE(l.all_packs_finished, FALSE) = FALSE
      ORDER BY l.actual_arrival_date
    `)

    // Fetch items for each load
    for (const load of result.rows) {
      const items = await query(
        'SELECT * FROM lumber_load_items WHERE load_id = $1 ORDER BY id',
        [load.id]
      )
      load.items = items.rows
      load.documents = []
    }

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching loads needing tally:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
