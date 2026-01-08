import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// Active inventory load IDs (from user's list)
const ACTIVE_INVENTORY_LOADS = [
  'R-25329', 'R-25326', 'R-25324', 'R-25323', 'R-25319', 'R-25315', 'R-25303', 'R-25302',
  'R-25300', 'R-25299', 'R-25294', 'R-25292', 'R-25277', 'R-25271', 'R-25266', 'R-25265',
  'R-25260', 'R-25257', 'R-25255', 'R-25254', 'R-25253', 'R-25247', 'R-25243', 'R-25240',
  'R-25236', 'R-25235', 'R-25230', 'R-25226', 'R-25222', 'R-25219', 'R-25162', 'R-25088',
  'R-25047', 'R-25038', 'R-25036', 'R-25025', 'R-25019', 'R-25015', 'R-24345', 'R-24326',
  'R-24303', 'R-24298', 'R-24243', 'R-24127', 'R-23768', 'R-23759', 'R-23750', 'R-22430',
  'R-22402', 'R-21377', 'R-21072', 'R-4276'
]

// Incoming load IDs (not yet arrived)
const INCOMING_LOADS = [
  'R-25180', 'R-25267', 'R-25268', 'R-25270', 'R-25301', 'R-25305', 'R-25317',
  'R-25325', 'R-25327', 'R-25328', 'R-25331', 'R-25332', 'R-25333', 'R-25334',
  'R-25335', 'R-25336'
]

const KEEP_ACTIVE = [...ACTIVE_INVENTORY_LOADS, ...INCOMING_LOADS]

// GET - Preview what will be updated
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current state
    const beforeResult = await query(`
      SELECT 
        COUNT(*) as total_loads,
        COUNT(CASE WHEN all_packs_finished = TRUE THEN 1 END) as finished_loads,
        COUNT(CASE WHEN COALESCE(all_packs_finished, FALSE) = FALSE THEN 1 END) as active_loads
      FROM lumber_loads
    `)

    // Get loads that will be marked as finished
    const toFinishResult = await query(`
      SELECT load_id, actual_arrival_date
      FROM lumber_loads
      WHERE load_id NOT IN (${KEEP_ACTIVE.map((_, i) => `$${i + 1}`).join(', ')})
        AND COALESCE(all_packs_finished, FALSE) = FALSE
      ORDER BY load_id DESC
      LIMIT 100
    `, KEEP_ACTIVE)

    return NextResponse.json({
      current_state: beforeResult.rows[0],
      will_mark_as_finished: toFinishResult.rows,
      count_to_finish: toFinishResult.rows.length,
      active_loads_count: ACTIVE_INVENTORY_LOADS.length,
      incoming_loads_count: INCOMING_LOADS.length
    })
  } catch (error) {
    console.error('Error previewing cleanup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Execute the cleanup
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mark loads as finished that are NOT in the active/incoming lists
    const finishResult = await query(`
      UPDATE lumber_loads
      SET all_packs_finished = TRUE
      WHERE load_id NOT IN (${KEEP_ACTIVE.map((_, i) => `$${i + 1}`).join(', ')})
        AND COALESCE(all_packs_finished, FALSE) = FALSE
      RETURNING load_id
    `, KEEP_ACTIVE)

    // Ensure active inventory loads are NOT finished
    const activeResult = await query(`
      UPDATE lumber_loads
      SET all_packs_finished = FALSE
      WHERE load_id IN (${ACTIVE_INVENTORY_LOADS.map((_, i) => `$${i + 1}`).join(', ')})
      RETURNING load_id
    `, ACTIVE_INVENTORY_LOADS)

    // Ensure incoming loads are NOT finished
    const incomingResult = await query(`
      UPDATE lumber_loads
      SET all_packs_finished = FALSE
      WHERE load_id IN (${INCOMING_LOADS.map((_, i) => `$${i + 1}`).join(', ')})
      RETURNING load_id
    `, INCOMING_LOADS)

    // Get new state
    const afterResult = await query(`
      SELECT 
        COUNT(*) as total_loads,
        COUNT(CASE WHEN all_packs_finished = TRUE THEN 1 END) as finished_loads,
        COUNT(CASE WHEN all_packs_finished = FALSE THEN 1 END) as active_loads
      FROM lumber_loads
    `)

    return NextResponse.json({
      success: true,
      marked_as_finished: finishResult.rows.length,
      kept_active_inventory: activeResult.rows.length,
      kept_incoming: incomingResult.rows.length,
      new_state: afterResult.rows[0],
      finished_load_ids: finishResult.rows.map(r => r.load_id)
    })
  } catch (error) {
    console.error('Error executing cleanup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
