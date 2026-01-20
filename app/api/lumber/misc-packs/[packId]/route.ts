import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/misc-packs/[packId] - Update a misc pack
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
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.pack_id !== undefined) {
      updates.push(`pack_id = $${paramIndex++}`)
      values.push(body.pack_id)
    }
    if (body.actual_board_feet !== undefined) {
      updates.push(`actual_board_feet = $${paramIndex++}`)
      values.push(body.actual_board_feet)
    }
    if (body.rip_yield !== undefined) {
      updates.push(`rip_yield = $${paramIndex++}`)
      values.push(body.rip_yield)
    }
    if (body.operator_id !== undefined) {
      updates.push(`operator_id = $${paramIndex++}`)
      values.push(body.operator_id)
    }
    if (body.stacker_1_id !== undefined) {
      updates.push(`stacker_1_id = $${paramIndex++}`)
      values.push(body.stacker_1_id)
    }
    if (body.stacker_2_id !== undefined) {
      updates.push(`stacker_2_id = $${paramIndex++}`)
      values.push(body.stacker_2_id)
    }
    if (body.stacker_3_id !== undefined) {
      updates.push(`stacker_3_id = $${paramIndex++}`)
      values.push(body.stacker_3_id)
    }
    if (body.stacker_4_id !== undefined) {
      updates.push(`stacker_4_id = $${paramIndex++}`)
      values.push(body.stacker_4_id)
    }
    if (body.rip_comments !== undefined) {
      updates.push(`rip_comments = $${paramIndex++}`)
      values.push(body.rip_comments)
    }
    if (body.is_finished !== undefined) {
      updates.push(`is_finished = $${paramIndex++}`)
      values.push(body.is_finished)
    }
    if (body.finished_at !== undefined) {
      updates.push(`finished_at = $${paramIndex++}`)
      const finishedAtValue = body.finished_at && body.finished_at !== '' ? body.finished_at : null
      values.push(finishedAtValue)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(params.packId)

    const result = await query(
      `UPDATE misc_rip_packs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating misc pack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/misc-packs/[packId] - Delete a misc pack
export async function DELETE(
  request: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `DELETE FROM misc_rip_packs WHERE id = $1 RETURNING id`,
      [params.packId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting misc pack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
