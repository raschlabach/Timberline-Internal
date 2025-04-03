import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/truckloads - Get all truckloads
export async function GET() {
  try {
    const result = await query(`
      WITH order_freight AS (
        SELECT 
          o.id as order_id,
          CASE 
            WHEN f.square_footage > 0 THEN f.square_footage
            ELSE COALESCE(
              (SELECT SUM(square_footage * quantity) FROM skids WHERE order_id = o.id), 0
            ) + COALESCE(
              (SELECT SUM(square_footage * quantity) FROM vinyl WHERE order_id = o.id), 0
            )
          END as total_footage
        FROM orders o
        LEFT JOIN footage f ON o.id = f.order_id
        GROUP BY o.id, f.square_footage
      )
      SELECT 
        t.id,
        t.driver_id,
        t.start_date,
        t.end_date,
        t.trailer_number,
        t.bill_of_lading_number,
        t.description,
        t.is_completed,
        t.total_mileage,
        t.estimated_duration,
        u.full_name as driver_name,
        d.color as driver_color,
        COALESCE(SUM(CASE WHEN toa.assignment_type = 'pickup' THEN of.total_footage ELSE 0 END), 0) as pickup_footage,
        COALESCE(SUM(CASE WHEN toa.assignment_type = 'delivery' THEN of.total_footage ELSE 0 END), 0) as delivery_footage,
        COALESCE(SUM(CASE WHEN toa.assignment_type = 'transfer' THEN of.total_footage ELSE 0 END), 0) as transfer_footage
      FROM truckloads t
      LEFT JOIN drivers d ON t.driver_id = d.user_id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN truckload_order_assignments toa ON t.id = toa.truckload_id
      LEFT JOIN order_freight of ON toa.order_id = of.order_id
      GROUP BY t.id, t.driver_id, t.start_date, t.end_date, t.trailer_number, t.bill_of_lading_number, 
               t.description, t.is_completed, t.total_mileage, t.estimated_duration, u.full_name, d.color
      ORDER BY t.start_date DESC
    `)

    return NextResponse.json({
      success: true,
      truckloads: result.rows
    })
  } catch (error) {
    console.error('Error fetching truckloads:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch truckloads'
    }, { status: 500 })
  }
}

// POST /api/truckloads - Create a new truckload
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  const client = await getClient()
  
  try {
    const { driverId, startDate, endDate, trailerNumber, description } = await request.json()

    // Validate required fields
    if (!driverId) {
      return NextResponse.json({
        success: false,
        error: 'Driver is required'
      }, { status: 400 })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'Start date and end date are required'
      }, { status: 400 })
    }

    // Start a transaction
    await client.query('BEGIN')

    try {
      // Insert into truckloads table
      const result = await client.query(
        `INSERT INTO truckloads (
          driver_id,
          start_date,
          end_date,
          trailer_number,
          description,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          driverId,
          startDate,
          endDate,
          trailerNumber || null,
          description || '',
          session.user.id
        ]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        truckloadId: result.rows[0].id,
        message: 'Truckload created successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error creating truckload:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create truckload'
    }, { status: 500 })
  }
} 