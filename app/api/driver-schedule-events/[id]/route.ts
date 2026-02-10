import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH /api/driver-schedule-events/[id] - Update a driver schedule event
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = parseInt(params.id)
    if (isNaN(eventId)) {
      return NextResponse.json({ success: false, error: 'Invalid event ID' }, { status: 400 })
    }

    const data = await request.json()
    const { driverId, eventType, startDate, endDate, description } = data

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (driverId !== undefined) {
      updates.push(`driver_id = $${paramIndex++}`)
      values.push(driverId)
    }
    if (eventType !== undefined) {
      updates.push(`event_type = $${paramIndex++}`)
      values.push(eventType)
    }
    if (startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`)
      values.push(startDate)
    }
    if (endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`)
      values.push(endDate)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    values.push(eventId)

    const result = await query(
      `UPDATE driver_schedule_events 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING 
         id,
         driver_id as "driverId",
         event_type as "eventType",
         TO_CHAR(start_date, 'YYYY-MM-DD') as "startDate",
         TO_CHAR(end_date, 'YYYY-MM-DD') as "endDate",
         description`,
      values
    )

    if (!result.rows.length) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      event: result.rows[0]
    })
  } catch (error) {
    console.error('Error updating driver schedule event:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update driver schedule event'
    }, { status: 500 })
  }
}

// DELETE /api/driver-schedule-events/[id] - Delete a driver schedule event
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = parseInt(params.id)
    if (isNaN(eventId)) {
      return NextResponse.json({ success: false, error: 'Invalid event ID' }, { status: 400 })
    }

    const result = await query(
      `DELETE FROM driver_schedule_events WHERE id = $1 RETURNING id`,
      [eventId]
    )

    if (!result.rows.length) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting driver schedule event:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete driver schedule event'
    }, { status: 500 })
  }
}
