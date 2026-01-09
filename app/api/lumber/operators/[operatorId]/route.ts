import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/operators/[operatorId] - Update an operator
export async function PATCH(
  request: NextRequest,
  { params }: { params: { operatorId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(body.name)
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(body.is_active)
    }
    if (body.display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`)
      values.push(body.display_order)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(params.operatorId)

    const result = await query(
      `UPDATE lumber_operators
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('Error updating operator:', error)
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'An operator with this name already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/operators/[operatorId] - Delete an operator
export async function DELETE(
  request: NextRequest,
  { params }: { params: { operatorId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if operator is being used in any packs
    const usageCheck = await query(
      `SELECT COUNT(*) as count FROM lumber_packs 
       WHERE operator_id = $1 OR stacker_1_id = $1 OR stacker_2_id = $1 
          OR stacker_3_id = $1 OR stacker_4_id = $1`,
      [params.operatorId]
    )

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete operator that is assigned to packs. Mark as inactive instead.' },
        { status: 400 }
      )
    }

    const result = await query(
      `DELETE FROM lumber_operators WHERE id = $1 RETURNING *`,
      [params.operatorId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting operator:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
