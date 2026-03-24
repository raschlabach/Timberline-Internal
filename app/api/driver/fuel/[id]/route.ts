import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fillup_date, truck_id, mileage, gallons } = body

    if (!fillup_date || !truck_id || !mileage || !gallons || gallons <= 0) {
      return NextResponse.json({ error: 'Date, truck, mileage, and gallons are required' }, { status: 400 })
    }

    const result = await query(
      `UPDATE fuel_truck_fillups
       SET fillup_date = $1, truck_id = $2, mileage = $3, gallons = $4
       WHERE id = $5 AND driver_id = $6
       RETURNING id`,
      [fillup_date, truck_id, mileage, gallons, params.id, session.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Fill-up not found or not yours' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating driver fillup:', error)
    return NextResponse.json({ error: 'Failed to update fill-up' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `DELETE FROM fuel_truck_fillups WHERE id = $1 AND driver_id = $2 RETURNING id`,
      [params.id, session.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Fill-up not found or not yours' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting driver fillup:', error)
    return NextResponse.json({ error: 'Failed to delete fill-up' }, { status: 500 })
  }
}
