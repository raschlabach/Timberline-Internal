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

    // Get inventory with load-level details
    // Excludes loads marked as all_packs_finished to prevent showing completed loads
    const result = await query(`
      SELECT 
        li.species,
        li.grade,
        li.thickness,
        l.load_id,
        l.id as load_db_id,
        li.actual_footage,
        li.price,
        l.invoice_total,
        s.name as supplier_name,
        COALESCE(finished_packs.finished_footage, 0) as finished_footage,
        li.actual_footage - COALESCE(finished_packs.finished_footage, 0) as load_inventory,
        COALESCE(pack_counts.total_packs, 0) as pack_count,
        COALESCE(pack_counts.finished_pack_count, 0) as finished_pack_count
      FROM lumber_load_items li
      JOIN lumber_loads l ON li.load_id = l.id
      LEFT JOIN suppliers s ON l.supplier_id = s.id
      LEFT JOIN (
        SELECT 
          load_item_id,
          SUM(COALESCE(tally_board_feet, actual_board_feet)) as finished_footage
        FROM lumber_packs
        WHERE is_finished = TRUE
        GROUP BY load_item_id
      ) finished_packs ON li.id = finished_packs.load_item_id
      LEFT JOIN (
        SELECT 
          load_item_id,
          COUNT(*) as total_packs,
          COUNT(CASE WHEN is_finished = TRUE THEN 1 END) as finished_pack_count
        FROM lumber_packs
        GROUP BY load_item_id
      ) pack_counts ON li.id = pack_counts.load_item_id
      WHERE li.actual_footage IS NOT NULL
        AND COALESCE(l.all_packs_finished, FALSE) = FALSE
      ORDER BY li.species, li.grade, li.thickness, l.load_id
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
