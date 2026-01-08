import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/inventory/monthly - Get monthly ripped footage
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || '0')
    const year = parseInt(searchParams.get('year') || '0')

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 })
    }

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = month === 12 
      ? `${year + 1}-01-01`
      : `${year}-${(month + 1).toString().padStart(2, '0')}-01`

    const totalResult = await query(
      `SELECT SUM(actual_board_feet) as total_ripped
       FROM lumber_packs
       WHERE is_finished = TRUE
         AND finished_at >= $1
         AND finished_at < $2`,
      [startDate, endDate]
    )

    const bySpeciesResult = await query(
      `SELECT 
         li.species,
         li.thickness,
         SUM(p.actual_board_feet) as total
       FROM lumber_packs p
       JOIN lumber_load_items li ON p.load_item_id = li.id
       WHERE p.is_finished = TRUE
         AND p.finished_at >= $1
         AND p.finished_at < $2
       GROUP BY li.species, li.thickness
       ORDER BY li.species, li.thickness`,
      [startDate, endDate]
    )

    return NextResponse.json({
      total_ripped: totalResult.rows[0].total_ripped || 0,
      by_species: bySpeciesResult.rows
    })
  } catch (error) {
    console.error('Error fetching monthly inventory:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
