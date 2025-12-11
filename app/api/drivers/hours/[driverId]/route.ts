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
        hours
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

    const { date, description, hours } = await request.json()

    if (!date || hours === undefined) {
      return NextResponse.json({ success: false, error: 'date and hours are required' }, { status: 400 })
    }

    const result = await query(`
      INSERT INTO driver_hours (driver_id, date, description, hours)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        driver_id as "driverId",
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        description,
        hours
    `, [driverId, date, description || null, hours])

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

