import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/bonus-parameters/[paramId] - Update a bonus parameter
export async function PATCH(
  request: NextRequest,
  { params }: { params: { paramId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { paramId } = params
    const body = await request.json()
    const { bf_min, bf_max, bonus_amount } = body

    if (bf_min === undefined || bf_max === undefined || bonus_amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (bf_min >= bf_max) {
      return NextResponse.json({ error: 'BF Min must be less than BF Max' }, { status: 400 })
    }

    const result = await query(
      `UPDATE lumber_bonus_parameters
       SET bf_min = $1, bf_max = $2, bonus_amount = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [bf_min, bf_max, bonus_amount, paramId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Bonus parameter not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating bonus parameter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/bonus-parameters/[paramId] - Delete a bonus parameter
export async function DELETE(
  request: NextRequest,
  { params }: { params: { paramId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { paramId } = params

    // Soft delete by setting is_active to false
    const result = await query(
      `UPDATE lumber_bonus_parameters
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [paramId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Bonus parameter not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bonus parameter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
