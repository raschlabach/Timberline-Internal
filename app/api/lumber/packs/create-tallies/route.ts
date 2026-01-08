import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { PackTallyInput } from '@/types/lumber'

// POST /api/lumber/packs/create-tallies - Create pack tallies for a load item
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: {
      load_item_id: number
      tallies: PackTallyInput[]
    } = await request.json()

    if (!body.load_item_id || !body.tallies || body.tallies.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await query('BEGIN')

    try {
      // Insert all packs
      for (const tally of body.tallies) {
        await query(
          `INSERT INTO lumber_packs (
            pack_id, load_id, load_item_id, length, tally_board_feet
          )
          SELECT $1, li.load_id, $2, $3, $4
          FROM lumber_load_items li
          WHERE li.id = $2`,
          [tally.pack_id, body.load_item_id, tally.length, tally.tally_board_feet]
        )
      }

      // Check if all items in the load have tallies
      const loadIdResult = await query(
        'SELECT load_id FROM lumber_load_items WHERE id = $1',
        [body.load_item_id]
      )
      const loadId = loadIdResult.rows[0].load_id

      const itemsResult = await query(
        'SELECT COUNT(*) as total FROM lumber_load_items WHERE load_id = $1',
        [loadId]
      )
      const itemsWithPacksResult = await query(
        `SELECT COUNT(DISTINCT load_item_id) as with_packs
         FROM lumber_packs
         WHERE load_id = $1`,
        [loadId]
      )

      if (itemsResult.rows[0].total === itemsWithPacksResult.rows[0].with_packs) {
        await query(
          'UPDATE lumber_loads SET all_packs_tallied = TRUE WHERE id = $1',
          [loadId]
        )
      }

      await query('COMMIT')

      return NextResponse.json({ success: true, packs_created: body.tallies.length })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error creating pack tallies:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
