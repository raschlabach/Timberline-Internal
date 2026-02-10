import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/driver-schedule-events - Get driver schedule events
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const driverId = searchParams.get('driverId')

    let whereClause = 'WHERE 1=1'
    const values: any[] = []
    let paramIndex = 1

    if (startDate && endDate) {
      whereClause += ` AND (
        (dse.start_date >= $${paramIndex}::date AND dse.start_date <= $${paramIndex + 1}::date)
        OR (dse.end_date >= $${paramIndex}::date AND dse.end_date <= $${paramIndex + 1}::date)
        OR (dse.start_date <= $${paramIndex}::date AND dse.end_date >= $${paramIndex + 1}::date)
      )`
      values.push(startDate, endDate)
      paramIndex += 2
    }

    if (driverId) {
      whereClause += ` AND dse.driver_id = $${paramIndex}`
      values.push(parseInt(driverId))
      paramIndex++
    }

    const result = await query(`
      SELECT 
        dse.id,
        dse.driver_id as "driverId",
        dse.event_type as "eventType",
        TO_CHAR(dse.start_date, 'YYYY-MM-DD') as "startDate",
        TO_CHAR(dse.end_date, 'YYYY-MM-DD') as "endDate",
        dse.description,
        u.full_name as "driverName",
        d.color as "driverColor"
      FROM driver_schedule_events dse
      LEFT JOIN users u ON dse.driver_id = u.id
      LEFT JOIN drivers d ON dse.driver_id = d.user_id
      ${whereClause}
      ORDER BY dse.start_date ASC
    `, values)

    return NextResponse.json({
      success: true,
      events: result.rows
    })
  } catch (error) {
    console.error('Error fetching driver schedule events:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch driver schedule events'
    }, { status: 500 })
  }
}

// POST /api/driver-schedule-events - Create a new driver schedule event
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { driverId, eventType, startDate, endDate, description } = await request.json()

    if (!driverId || !eventType || !startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'driverId, eventType, startDate, and endDate are required'
      }, { status: 400 })
    }

    const result = await query(`
      INSERT INTO driver_schedule_events (driver_id, event_type, start_date, end_date, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id,
        driver_id as "driverId",
        event_type as "eventType",
        TO_CHAR(start_date, 'YYYY-MM-DD') as "startDate",
        TO_CHAR(end_date, 'YYYY-MM-DD') as "endDate",
        description
    `, [driverId, eventType, startDate, endDate, description || null, session.user.id])

    return NextResponse.json({
      success: true,
      event: result.rows[0]
    })
  } catch (error) {
    console.error('Error creating driver schedule event:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create driver schedule event'
    }, { status: 500 })
  }
}
