import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/check-finished - Check status of loads
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get loads with their pack status
    const result = await query(`
      SELECT 
        l.id,
        l.load_id,
        l.actual_arrival_date,
        l.all_packs_finished,
        COUNT(p.id) as total_packs,
        COUNT(CASE WHEN p.is_finished = TRUE THEN 1 END) as finished_packs,
        SUM(li.actual_footage) as total_actual_footage,
        SUM(COALESCE(p.tally_board_feet, p.actual_board_feet)) FILTER (WHERE p.is_finished = TRUE) as finished_footage
      FROM lumber_loads l
      JOIN lumber_load_items li ON li.load_id = l.id
      LEFT JOIN lumber_packs p ON p.load_item_id = li.id
      WHERE l.actual_arrival_date IS NOT NULL
      GROUP BY l.id, l.load_id, l.actual_arrival_date, l.all_packs_finished
      ORDER BY l.actual_arrival_date DESC
    `)

    const loads = result.rows.map(row => ({
      ...row,
      should_be_finished: row.total_packs > 0 && row.total_packs === row.finished_packs,
      needs_update: row.total_packs > 0 && 
                    row.total_packs === row.finished_packs && 
                    !row.all_packs_finished
    }))

    return NextResponse.json(loads)
  } catch (error) {
    console.error('Error checking finished loads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/loads/check-finished - Auto-update loads that should be marked as finished
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update loads where all packs are finished
    const result = await query(`
      UPDATE lumber_loads l
      SET all_packs_finished = TRUE
      WHERE l.id IN (
        SELECT l.id
        FROM lumber_loads l
        JOIN lumber_load_items li ON li.load_id = l.id
        LEFT JOIN lumber_packs p ON p.load_item_id = li.id
        WHERE l.actual_arrival_date IS NOT NULL
          AND COALESCE(l.all_packs_finished, FALSE) = FALSE
        GROUP BY l.id
        HAVING COUNT(p.id) > 0 
           AND COUNT(p.id) = COUNT(CASE WHEN p.is_finished = TRUE THEN 1 END)
      )
      RETURNING load_id
    `)

    return NextResponse.json({ 
      updated: result.rows.length,
      load_ids: result.rows.map(r => r.load_id)
    })
  } catch (error) {
    console.error('Error updating finished loads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
