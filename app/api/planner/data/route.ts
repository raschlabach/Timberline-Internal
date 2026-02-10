import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/planner/data - Get all data needed for the truckload planner
// Returns: drivers, truckloads (all statuses), driver schedule events, and planner notes for date range
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 })
    }

    // Fetch drivers
    const driversResult = await query(`
      SELECT DISTINCT
        u.id,
        u.full_name,
        d.color
      FROM users u
      JOIN drivers d ON u.id = d.user_id
      WHERE u.role = 'driver'
      ORDER BY u.full_name ASC
    `)

    const driversMap = new Map()
    driversResult.rows.forEach((row: any) => {
      if (!driversMap.has(row.id)) {
        driversMap.set(row.id, {
          id: row.id,
          full_name: row.full_name,
          color: row.color
        })
      }
    })
    const drivers = Array.from(driversMap.values())

    // Fetch truckloads (ALL statuses including drafts) within the date range
    const truckloadsResult = await query(`
      SELECT 
        t.id,
        t.driver_id as "driverId",
        TO_CHAR(t.start_date, 'YYYY-MM-DD') as "startDate",
        TO_CHAR(t.end_date, 'YYYY-MM-DD') as "endDate",
        t.trailer_number as "trailerNumber",
        t.bill_of_lading_number as "billOfLadingNumber",
        t.description,
        t.is_completed as "isCompleted",
        COALESCE(t.status, 'active') as "status",
        t.start_time as "startTime",
        t.end_time as "endTime",
        u.full_name as "driverName",
        d.color as "driverColor"
      FROM truckloads t
      LEFT JOIN users u ON t.driver_id = u.id
      LEFT JOIN drivers d ON u.id = d.user_id
      WHERE (
        (t.start_date >= $1::date AND t.start_date <= $2::date)
        OR (t.end_date >= $1::date AND t.end_date <= $2::date)
        OR (t.start_date <= $1::date AND t.end_date >= $2::date)
      )
      ORDER BY t.start_date ASC
    `, [startDate, endDate])

    // Fetch driver schedule events within the date range
    let driverEvents: any[] = []
    try {
      const eventsResult = await query(`
        SELECT 
          dse.id,
          dse.driver_id as "driverId",
          dse.event_type as "eventType",
          TO_CHAR(dse.start_date, 'YYYY-MM-DD') as "startDate",
          TO_CHAR(dse.end_date, 'YYYY-MM-DD') as "endDate",
          dse.description,
          u.full_name as "driverName"
        FROM driver_schedule_events dse
        LEFT JOIN users u ON dse.driver_id = u.id
        WHERE (
          (dse.start_date >= $1::date AND dse.start_date <= $2::date)
          OR (dse.end_date >= $1::date AND dse.end_date <= $2::date)
          OR (dse.start_date <= $1::date AND dse.end_date >= $2::date)
        )
        ORDER BY dse.start_date ASC
      `, [startDate, endDate])
      driverEvents = eventsResult.rows
    } catch {
      // Table might not exist yet if migration hasn't run
      console.log('driver_schedule_events table not found, skipping')
    }

    // Fetch planner notes within the date range
    let plannerNotes: any[] = []
    try {
      const notesResult = await query(`
        SELECT 
          pn.id,
          pn.note_type as "noteType",
          TO_CHAR(pn.note_date, 'YYYY-MM-DD') as "noteDate",
          pn.content,
          u.full_name as "createdByName"
        FROM planner_notes pn
        LEFT JOIN users u ON pn.created_by = u.id
        WHERE pn.note_date >= $1::date AND pn.note_date <= $2::date
        ORDER BY pn.note_date ASC
      `, [startDate, endDate])
      plannerNotes = notesResult.rows
    } catch {
      // Table might not exist yet if migration hasn't run
      console.log('planner_notes table not found, skipping')
    }

    return NextResponse.json({
      success: true,
      drivers,
      truckloads: truckloadsResult.rows,
      driverEvents,
      plannerNotes
    })
  } catch (error) {
    console.error('Error fetching planner data:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch planner data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
