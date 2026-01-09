import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/packs/[packId]/rip-data - Update pack rip data
export async function PATCH(
  request: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Build dynamic update query based on provided fields
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.pack_id !== undefined) {
      updates.push(`pack_id = $${paramIndex++}`)
      values.push(body.pack_id)
    }
    if (body.length !== undefined) {
      updates.push(`length = $${paramIndex++}`)
      values.push(body.length)
    }
    if (body.tally_board_feet !== undefined) {
      updates.push(`tally_board_feet = $${paramIndex++}`)
      values.push(body.tally_board_feet)
    }
    if (body.actual_board_feet !== undefined) {
      updates.push(`actual_board_feet = $${paramIndex++}`)
      values.push(body.actual_board_feet)
    }
    if (body.rip_yield !== undefined) {
      updates.push(`rip_yield = $${paramIndex++}`)
      values.push(body.rip_yield)
    }
    if (body.rip_comments !== undefined) {
      updates.push(`rip_comments = $${paramIndex++}`)
      values.push(body.rip_comments)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(params.packId)

    const result = await query(
      `UPDATE lumber_packs
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating pack rip data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
