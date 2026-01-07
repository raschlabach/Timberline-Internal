import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/grades/[gradeId] - Update a grade
export async function PATCH(
  request: NextRequest,
  { params }: { params: { gradeId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const result = await query(
      `UPDATE lumber_grades
       SET name = COALESCE($1, name),
           display_order = COALESCE($2, display_order),
           is_active = COALESCE($3, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [body.name, body.display_order, body.is_active, params.gradeId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating grade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/grades/[gradeId] - Deactivate a grade
export async function DELETE(
  request: NextRequest,
  { params }: { params: { gradeId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `UPDATE lumber_grades SET is_active = FALSE WHERE id = $1 RETURNING *`,
      [params.gradeId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating grade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
