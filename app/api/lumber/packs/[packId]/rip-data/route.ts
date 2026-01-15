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
    console.log('Updating pack', params.packId, 'with body:', JSON.stringify(body))

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
    // Note: load_quality is stored at the load level, not pack level
    if (body.is_finished !== undefined) {
      updates.push(`is_finished = $${paramIndex++}`)
      values.push(body.is_finished)
    }
    if (body.finished_at !== undefined) {
      updates.push(`finished_at = $${paramIndex++}`)
      // Convert empty string to null, and ensure proper date format
      const finishedAtValue = body.finished_at && body.finished_at !== '' ? body.finished_at : null
      values.push(finishedAtValue)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(params.packId)

    const sqlQuery = `UPDATE lumber_packs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`
    console.log('SQL Query:', sqlQuery)
    console.log('Values:', values)

    const result = await query(sqlQuery, values)

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('Error updating pack rip data:', error)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}
