import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/load-id-ranges/[rangeId] - Update a load ID range
export async function PATCH(
  request: NextRequest,
  { params }: { params: { rangeId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const rangeId = params.rangeId

    // If setting this as active, deactivate all other ranges first
    if (body.is_active === true) {
      await query('UPDATE lumber_load_id_ranges SET is_active = FALSE WHERE id != $1', [rangeId])
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.range_name !== undefined) {
      updates.push(`range_name = $${paramIndex++}`)
      values.push(body.range_name)
    }
    if (body.start_range !== undefined) {
      updates.push(`start_range = $${paramIndex++}`)
      values.push(body.start_range)
    }
    if (body.end_range !== undefined) {
      updates.push(`end_range = $${paramIndex++}`)
      values.push(body.end_range)
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(body.is_active)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(rangeId)
    const result = await query(
      `UPDATE lumber_load_id_ranges 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Range not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating load ID range:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/load-id-ranges/[rangeId] - Delete a load ID range
export async function DELETE(
  request: NextRequest,
  { params }: { params: { rangeId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      'DELETE FROM lumber_load_id_ranges WHERE id = $1 RETURNING *',
      [params.rangeId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Range not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Range deleted successfully' })
  } catch (error) {
    console.error('Error deleting load ID range:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
