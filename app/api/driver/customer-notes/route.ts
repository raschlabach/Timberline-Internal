import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/driver/customer-notes?customerId=123 - Get driver notes for a customer
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 })
    }

    // Check if the table exists first
    try {
      const result = await query(`
        SELECT 
          dcn.id,
          dcn.note,
          dcn.created_at as "createdAt",
          u.full_name as "driverName"
        FROM driver_customer_notes dcn
        LEFT JOIN users u ON dcn.driver_id = u.id
        WHERE dcn.customer_id = $1
        ORDER BY dcn.created_at DESC
      `, [customerId])

      return NextResponse.json({
        success: true,
        notes: result.rows,
      })
    } catch {
      // Table doesn't exist yet - return empty notes
      return NextResponse.json({
        success: true,
        notes: [],
      })
    }
  } catch (error) {
    console.error('Error fetching driver customer notes:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch notes',
    }, { status: 500 })
  }
}

// POST /api/driver/customer-notes - Add a driver note for a customer
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customerId, note } = body

    if (!customerId || !note?.trim()) {
      return NextResponse.json({ success: false, error: 'customerId and note are required' }, { status: 400 })
    }

    const driverId = parseInt(session.user.id)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 })
    }

    try {
      const result = await query(`
        INSERT INTO driver_customer_notes (driver_id, customer_id, note)
        VALUES ($1, $2, $3)
        RETURNING id, note, created_at as "createdAt"
      `, [driverId, customerId, note.trim()])

      return NextResponse.json({
        success: true,
        note: {
          ...result.rows[0],
          driverName: session.user.name || 'Driver',
        },
      })
    } catch (error: any) {
      // If the table doesn't exist, return a helpful error
      if (error?.message?.includes('driver_customer_notes') || error?.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'Driver notes feature requires a database migration. Please run the 20260211_add_driver_customer_notes migration.',
        }, { status: 503 })
      }
      throw error
    }
  } catch (error) {
    console.error('Error saving driver customer note:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to save note',
    }, { status: 500 })
  }
}
