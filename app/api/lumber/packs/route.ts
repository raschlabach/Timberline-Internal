import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST /api/lumber/packs - Create a new pack
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { load_id, load_item_id, pack_id, length, tally_board_feet } = body

    if (!load_id || !load_item_id) {
      return NextResponse.json(
        { error: 'load_id and load_item_id are required' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO lumber_packs (
        load_id,
        load_item_id,
        pack_id,
        length,
        tally_board_feet,
        is_finished,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [load_id, load_item_id, pack_id || 0, length || 0, tally_board_feet || 0]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating pack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
