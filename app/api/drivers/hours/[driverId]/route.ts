import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/drivers/[driverId]/hours - Get driver hours for date range
export async function GET(
  request: NextRequest,
  { params }: { params: { driverId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(params.driverId)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid driver ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 })
    }

    const result = await query(`
      SELECT 
        id,
        driver_id as "driverId",
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        description,
        hours,
        type,
        COALESCE(is_driver_submitted, false) as "isDriverSubmitted",
        truckload_id as "truckloadId"
      FROM driver_hours
      WHERE driver_id = $1
        AND date >= $2
        AND date <= $3
      ORDER BY date ASC, id ASC
    `, [driverId, startDate, endDate])

    return NextResponse.json({
      success: true,
      hours: result.rows
    })
  } catch (error) {
    console.error('Error fetching driver hours:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch driver hours'
    }, { status: 500 })
  }
}

// POST /api/drivers/[driverId]/hours - Create new driver hour entry
export async function POST(
  request: NextRequest,
  { params }: { params: { driverId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(params.driverId)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid driver ID' }, { status: 400 })
    }

    const { date, description, hours, type } = await request.json()

    if (!date || hours === undefined || !type) {
      return NextResponse.json({ success: false, error: 'date, hours, and type are required' }, { status: 400 })
    }

    if (type !== 'misc_driving' && type !== 'maintenance') {
      return NextResponse.json({ success: false, error: 'type must be either "misc_driving" or "maintenance"' }, { status: 400 })
    }

    // Parse date as local date to avoid timezone issues
    // Date should be in YYYY-MM-DD format from the client
    // Extract just the date part if it's an ISO string
    let dateToSave = date
    if (typeof date === 'string') {
      // If it's already in YYYY-MM-DD format, use it directly
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        dateToSave = date
      } else {
        // If it's an ISO string, extract just the date part
        dateToSave = date.split('T')[0]
      }
    }

    const result = await query(`
      INSERT INTO driver_hours (driver_id, date, description, hours, type)
      VALUES ($1, $2::date, $3, $4, $5)
      RETURNING 
        id,
        driver_id as "driverId",
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        description,
        hours,
        type
    `, [driverId, dateToSave, description || null, parseFloat(String(hours)), type])

    return NextResponse.json({
      success: true,
      hour: result.rows[0]
    })
  } catch (error) {
    console.error('Error creating driver hour:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create driver hour'
    }, { status: 500 })
  }
}

// DELETE /api/drivers/[driverId]/hours - Delete driver hour entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { driverId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(params.driverId)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid driver ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const hourId = searchParams.get('id')

    if (!hourId) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const result = await query(`
      DELETE FROM driver_hours
      WHERE id = $1 AND driver_id = $2
      RETURNING id
    `, [hourId, driverId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Hour entry not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Driver hour deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting driver hour:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete driver hour'
    }, { status: 500 })
  }
}

// PATCH /api/drivers/[driverId]/hours - Update driver hour entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: { driverId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(params.driverId)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid driver ID' }, { status: 400 })
    }

    const { id, date, description, hours, type } = await request.json()

    if (!id || !date || hours === undefined || !type) {
      return NextResponse.json({ success: false, error: 'id, date, hours, and type are required' }, { status: 400 })
    }

    if (type !== 'misc_driving' && type !== 'maintenance') {
      return NextResponse.json({ success: false, error: 'type must be either "misc_driving" or "maintenance"' }, { status: 400 })
    }

    // Parse date as local date to avoid timezone issues
    let dateToSave = date
    if (typeof date === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        dateToSave = date
      } else {
        dateToSave = date.split('T')[0]
      }
    }

    const result = await query(`
      UPDATE driver_hours
      SET date = $1::date,
          description = $2,
          hours = $3,
          type = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND driver_id = $6
      RETURNING 
        id,
        driver_id as "driverId",
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        description,
        hours,
        type
    `, [dateToSave, description || null, parseFloat(String(hours)), type, id, driverId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Hour entry not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      hour: result.rows[0]
    })
  } catch (error) {
    console.error('Error updating driver hour:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update driver hour'
    }, { status: 500 })
  }
}

