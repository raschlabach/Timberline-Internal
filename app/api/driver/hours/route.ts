import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/driver/hours - Get the current driver's hours
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(session.user.id)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let hoursQuery: string
    let hoursParams: any[]

    if (startDate && endDate) {
      hoursQuery = `
        SELECT 
          dh.id,
          TO_CHAR(dh.date, 'YYYY-MM-DD') as date,
          dh.description,
          dh.hours,
          dh.type,
          dh.truckload_id as "truckloadId",
          t.description as "truckloadDescription"
        FROM driver_hours dh
        LEFT JOIN truckloads t ON dh.truckload_id = t.id
        WHERE dh.driver_id = $1
          AND dh.date >= $2::date
          AND dh.date <= $3::date
        ORDER BY dh.date DESC, dh.id DESC
      `
      hoursParams = [driverId, startDate, endDate]
    } else {
      hoursQuery = `
        SELECT 
          dh.id,
          TO_CHAR(dh.date, 'YYYY-MM-DD') as date,
          dh.description,
          dh.hours,
          dh.type,
          dh.truckload_id as "truckloadId",
          t.description as "truckloadDescription"
        FROM driver_hours dh
        LEFT JOIN truckloads t ON dh.truckload_id = t.id
        WHERE dh.driver_id = $1
          AND dh.date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY dh.date DESC, dh.id DESC
      `
      hoursParams = [driverId]
    }

    const result = await query(hoursQuery, hoursParams)

    // Also fetch active truckloads for the load-specific form
    const truckloadsResult = await query(`
      SELECT 
        t.id,
        t.description,
        TO_CHAR(t.start_date, 'YYYY-MM-DD') as "startDate",
        TO_CHAR(t.end_date, 'YYYY-MM-DD') as "endDate"
      FROM truckloads t
      WHERE t.driver_id = $1
        AND t.is_completed = false
        AND COALESCE(t.status, 'active') NOT IN ('draft', 'completed')
      ORDER BY t.start_date DESC
      LIMIT 20
    `, [driverId])

    return NextResponse.json({
      success: true,
      hours: result.rows,
      truckloads: truckloadsResult.rows,
    })
  } catch (error: any) {
    if (error?.message?.includes('does not exist') || error?.code === '42P01' || error?.message?.includes('column')) {
      return NextResponse.json({ success: true, hours: [], truckloads: [] })
    }
    console.error('Error fetching driver hours:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch hours' }, { status: 500 })
  }
}

// POST /api/driver/hours - Submit hours (general or load-specific)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(session.user.id)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 })
    }

    const { date, description, hours, type, truckloadId } = await request.json()

    if (!date || hours === undefined || !type) {
      return NextResponse.json({ success: false, error: 'date, hours, and type are required' }, { status: 400 })
    }

    if (type !== 'misc_driving' && type !== 'maintenance') {
      return NextResponse.json({ success: false, error: 'type must be "misc_driving" or "maintenance"' }, { status: 400 })
    }

    const parsedHours = parseFloat(String(hours))
    if (isNaN(parsedHours) || parsedHours <= 0) {
      return NextResponse.json({ success: false, error: 'hours must be a positive number' }, { status: 400 })
    }

    let dateToSave = date
    if (typeof date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dateToSave = date.split('T')[0]
    }

    // If load-specific, verify the truckload belongs to this driver
    if (truckloadId) {
      const truckloadCheck = await query(
        `SELECT id FROM truckloads WHERE id = $1 AND driver_id = $2`,
        [truckloadId, driverId]
      )
      if (truckloadCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Truckload not found or not assigned to you' }, { status: 403 })
      }
    }

    // Insert the hour entry
    const result = await query(`
      INSERT INTO driver_hours (driver_id, date, description, hours, type, is_driver_submitted, truckload_id)
      VALUES ($1, $2::date, $3, $4, $5, true, $6)
      RETURNING 
        id,
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        description,
        hours,
        type,
        truckload_id as "truckloadId"
    `, [driverId, dateToSave, description || null, parsedHours, type, truckloadId || null])

    // If load-specific, auto-switch truckload to hourly pay method
    if (truckloadId) {
      // Sum all hours logged against this truckload by this driver
      const totalHoursResult = await query(`
        SELECT COALESCE(SUM(hours), 0) as total_hours
        FROM driver_hours
        WHERE truckload_id = $1 AND driver_id = $2
      `, [truckloadId, driverId])

      const totalHours = parseFloat(totalHoursResult.rows[0].total_hours) || 0

      await query(`
        UPDATE truckloads
        SET pay_calculation_method = 'hourly',
            pay_hours = $1
        WHERE id = $2
      `, [totalHours, truckloadId]).catch(() => {
        // Columns may not exist yet
      })
    }

    return NextResponse.json({ success: true, hour: result.rows[0] })
  } catch (error: any) {
    if (error?.message?.includes('column') && error?.message?.includes('does not exist')) {
      // Try fallback without the new columns
      return NextResponse.json({
        success: false,
        error: 'Database migration needed. Please contact an administrator.',
      }, { status: 500 })
    }
    console.error('Error creating driver hour:', error)
    return NextResponse.json({ success: false, error: 'Failed to create hour entry' }, { status: 500 })
  }
}

// DELETE /api/driver/hours - Delete a driver's own hour entry
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(session.user.id)
    const { searchParams } = new URL(request.url)
    const hourId = searchParams.get('id')

    if (!hourId) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Get the hour entry before deleting to check for truckload link
    const hourEntry = await query(
      `SELECT id, truckload_id as "truckloadId" FROM driver_hours WHERE id = $1 AND driver_id = $2`,
      [hourId, driverId]
    )

    if (hourEntry.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Hour entry not found' }, { status: 404 })
    }

    const truckloadId = hourEntry.rows[0].truckloadId

    // Delete the entry
    await query(`DELETE FROM driver_hours WHERE id = $1 AND driver_id = $2`, [hourId, driverId])

    // If it was load-specific, recalculate the truckload's hours
    if (truckloadId) {
      const totalHoursResult = await query(`
        SELECT COALESCE(SUM(hours), 0) as total_hours
        FROM driver_hours
        WHERE truckload_id = $1 AND driver_id = $2
      `, [truckloadId, driverId])

      const totalHours = parseFloat(totalHoursResult.rows[0].total_hours) || 0

      if (totalHours === 0) {
        // No more hours, switch back to automatic
        await query(`
          UPDATE truckloads
          SET pay_calculation_method = 'automatic',
              pay_hours = NULL
          WHERE id = $1
        `, [truckloadId]).catch(() => {})
      } else {
        await query(`
          UPDATE truckloads
          SET pay_hours = $1
          WHERE id = $2
        `, [totalHours, truckloadId]).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting driver hour:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete hour entry' }, { status: 500 })
  }
}
