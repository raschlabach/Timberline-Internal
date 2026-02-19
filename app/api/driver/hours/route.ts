import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function ensureColumns() {
  try {
    const colCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'driver_hours'
        AND column_name IN ('is_driver_submitted', 'truckload_id', 'started_at')
    `)
    const existing = colCheck.rows.map((r: any) => r.column_name)
    const missing: string[] = []
    if (!existing.includes('is_driver_submitted')) missing.push('ADD COLUMN IF NOT EXISTS is_driver_submitted BOOLEAN DEFAULT false NOT NULL')
    if (!existing.includes('truckload_id')) missing.push('ADD COLUMN IF NOT EXISTS truckload_id INTEGER REFERENCES truckloads(id) ON DELETE SET NULL')
    if (!existing.includes('started_at')) missing.push('ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE')

    if (missing.length > 0) {
      const client = await getClient()
      try {
        await client.query('BEGIN')
        await client.query(`ALTER TABLE driver_hours ${missing.join(', ')}`)
        await client.query(`CREATE INDEX IF NOT EXISTS idx_driver_hours_truckload_id ON driver_hours(truckload_id)`)
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {})
        console.error('Error applying driver_hours migration:', e)
      } finally {
        client.release()
      }
    }
  } catch (e) {
    console.error('Error checking driver_hours columns:', e)
  }
}

// GET /api/driver/hours - Get the current driver's hours + active timer + active truckloads
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

    await ensureColumns()

    // Fetch completed hours (last 30 days)
    const hoursResult = await query(`
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
        AND dh.started_at IS NULL
        AND dh.date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY dh.date DESC, dh.id DESC
    `, [driverId])

    // Fetch active timer (started but not stopped)
    const activeTimerResult = await query(`
      SELECT 
        dh.id,
        dh.started_at as "startedAt",
        dh.type,
        dh.description,
        dh.truckload_id as "truckloadId",
        t.description as "truckloadDescription"
      FROM driver_hours dh
      LEFT JOIN truckloads t ON dh.truckload_id = t.id
      WHERE dh.driver_id = $1
        AND dh.started_at IS NOT NULL
      ORDER BY dh.started_at DESC
      LIMIT 1
    `, [driverId])

    // Fetch active truckloads for the load-specific option
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
      hours: hoursResult.rows,
      activeTimer: activeTimerResult.rows[0] || null,
      truckloads: truckloadsResult.rows,
    })
  } catch (error: any) {
    if (error?.message?.includes('does not exist') || error?.code === '42P01' || error?.message?.includes('column')) {
      return NextResponse.json({ success: true, hours: [], activeTimer: null, truckloads: [] })
    }
    console.error('Error fetching driver hours:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch hours' }, { status: 500 })
  }
}

// POST /api/driver/hours - Start timer or stop timer
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

    await ensureColumns()

    const body = await request.json()
    const { action } = body

    if (action === 'start') {
      const { type, description, truckloadId } = body

      if (!type || (type !== 'misc_driving' && type !== 'maintenance')) {
        return NextResponse.json({ success: false, error: 'type must be "misc_driving" or "maintenance"' }, { status: 400 })
      }

      // Check no timer is already running
      const existingTimer = await query(
        `SELECT id FROM driver_hours WHERE driver_id = $1 AND started_at IS NOT NULL`,
        [driverId]
      )
      if (existingTimer.rows.length > 0) {
        return NextResponse.json({ success: false, error: 'A timer is already running' }, { status: 409 })
      }

      // If load-specific, verify ownership
      if (truckloadId) {
        const check = await query(
          `SELECT id FROM truckloads WHERE id = $1 AND driver_id = $2`,
          [truckloadId, driverId]
        )
        if (check.rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Truckload not found or not assigned to you' }, { status: 403 })
        }
      }

      // Insert a timer row
      const result = await query(`
        INSERT INTO driver_hours (driver_id, date, description, hours, type, is_driver_submitted, truckload_id, started_at)
        VALUES ($1, CURRENT_DATE, $2, 0, $3, true, $4, NOW())
        RETURNING 
          id,
          started_at as "startedAt",
          type,
          description,
          truckload_id as "truckloadId"
      `, [driverId, description || null, type, truckloadId || null])

      return NextResponse.json({ success: true, timer: result.rows[0] })
    }

    if (action === 'stop') {
      const { timerId } = body

      // Find the active timer
      const timerResult = await query(
        `SELECT id, started_at, truckload_id as "truckloadId"
         FROM driver_hours 
         WHERE id = $1 AND driver_id = $2 AND started_at IS NOT NULL`,
        [timerId, driverId]
      )

      if (timerResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No active timer found' }, { status: 404 })
      }

      const timer = timerResult.rows[0]
      const startedAt = new Date(timer.started_at)
      const now = new Date()
      const elapsedMs = now.getTime() - startedAt.getTime()
      const elapsedHours = parseFloat((elapsedMs / (1000 * 60 * 60)).toFixed(2))

      // Update the row: set hours, clear started_at, set date to today
      const result = await query(`
        UPDATE driver_hours
        SET hours = $1,
            started_at = NULL,
            date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND driver_id = $3
        RETURNING 
          id,
          TO_CHAR(date, 'YYYY-MM-DD') as date,
          description,
          hours,
          type,
          truckload_id as "truckloadId"
      `, [Math.max(elapsedHours, 0.01), timerId, driverId])

      // If load-specific, auto-switch truckload to hourly
      if (timer.truckloadId) {
        const totalHoursResult = await query(`
          SELECT COALESCE(SUM(hours), 0) as total_hours
          FROM driver_hours
          WHERE truckload_id = $1 AND driver_id = $2 AND started_at IS NULL
        `, [timer.truckloadId, driverId])

        const totalHours = parseFloat(totalHoursResult.rows[0].total_hours) || 0

        await query(`
          UPDATE truckloads
          SET pay_calculation_method = 'hourly',
              pay_hours = $1
          WHERE id = $2
        `, [totalHours, timer.truckloadId]).catch(() => {})
      }

      return NextResponse.json({ success: true, hour: result.rows[0] })
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Use "start" or "stop"' }, { status: 400 })
  } catch (error: any) {
    if (error?.message?.includes('column') && error?.message?.includes('does not exist')) {
      return NextResponse.json({
        success: false,
        error: 'Database migration needed. Please contact an administrator.',
      }, { status: 500 })
    }
    console.error('Error with driver timer:', error)
    return NextResponse.json({ success: false, error: 'Failed to process timer action' }, { status: 500 })
  }
}

// DELETE /api/driver/hours - Delete a driver's own hour entry or cancel active timer
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(session.user.id)

    await ensureColumns()

    const { searchParams } = new URL(request.url)
    const hourId = searchParams.get('id')

    if (!hourId) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Get the entry before deleting
    const hourEntry = await query(
      `SELECT id, truckload_id as "truckloadId", started_at FROM driver_hours WHERE id = $1 AND driver_id = $2`,
      [hourId, driverId]
    )

    if (hourEntry.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Hour entry not found' }, { status: 404 })
    }

    const truckloadId = hourEntry.rows[0].truckloadId

    await query(`DELETE FROM driver_hours WHERE id = $1 AND driver_id = $2`, [hourId, driverId])

    // If it was load-specific and completed, recalculate
    if (truckloadId && !hourEntry.rows[0].started_at) {
      const totalHoursResult = await query(`
        SELECT COALESCE(SUM(hours), 0) as total_hours
        FROM driver_hours
        WHERE truckload_id = $1 AND driver_id = $2 AND started_at IS NULL
      `, [truckloadId, driverId])

      const totalHours = parseFloat(totalHoursResult.rows[0].total_hours) || 0

      if (totalHours === 0) {
        await query(`
          UPDATE truckloads
          SET pay_calculation_method = 'automatic', pay_hours = NULL
          WHERE id = $1
        `, [truckloadId]).catch(() => {})
      } else {
        await query(`
          UPDATE truckloads SET pay_hours = $1 WHERE id = $2
        `, [totalHours, truckloadId]).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting driver hour:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete hour entry' }, { status: 500 })
  }
}

// PATCH /api/driver/hours - Update description on a driver's own hour entry
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(session.user.id)
    const { id, description } = await request.json()

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const result = await query(`
      UPDATE driver_hours
      SET description = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND driver_id = $3
      RETURNING id, description
    `, [description || null, id, driverId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Hour entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, hour: result.rows[0] })
  } catch (error) {
    console.error('Error updating driver hour:', error)
    return NextResponse.json({ success: false, error: 'Failed to update hour entry' }, { status: 500 })
  }
}
