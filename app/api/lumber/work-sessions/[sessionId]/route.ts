import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/work-sessions/[sessionId] - Update a work session
export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = params
    const body = await request.json()
    const { start_time, end_time, notes } = body

    if (!start_time || !end_time) {
      return NextResponse.json({ error: 'Start time and end time are required' }, { status: 400 })
    }

    const result = await query(
      `UPDATE lumber_work_sessions
       SET start_time = $1, end_time = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [start_time, end_time, notes || null, sessionId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Work session not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating work session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/work-sessions/[sessionId] - Delete a work session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = params

    const result = await query(
      'DELETE FROM lumber_work_sessions WHERE id = $1 RETURNING id',
      [sessionId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Work session not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting work session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
