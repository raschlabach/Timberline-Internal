import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/inventory - Get current inventory levels with load IDs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get inventory grouped by species and grade with load details
    // Excludes loads marked as all_packs_finished to prevent showing completed loads
    const result = await query(`
      SELECT 
        li.species,
        li.grade,
        li.thickness,
        SUM(li.actual_footage) as total_actual_footage,
        SUM(COALESCE(finished_packs.finished_footage, 0)) as total_finished_footage,
        SUM(li.actual_footage) - SUM(COALESCE(finished_packs.finished_footage, 0)) as current_inventory,
        ARRAY_AGG(DISTINCT l.load_id ORDER BY l.load_id) as load_ids,
        COUNT(DISTINCT l.id) as load_count
      FROM lumber_load_items li
      JOIN lumber_loads l ON li.load_id = l.id
      LEFT JOIN (
        SELECT 
          load_item_id,
          SUM(tally_board_feet) as finished_footage
        FROM lumber_packs
        WHERE is_finished = TRUE
        GROUP BY load_item_id
      ) finished_packs ON li.id = finished_packs.load_item_id
      WHERE li.actual_footage IS NOT NULL
        AND COALESCE(l.all_packs_finished, FALSE) = FALSE
      GROUP BY li.species, li.grade, li.thickness
      ORDER BY li.species, li.grade, li.thickness
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
