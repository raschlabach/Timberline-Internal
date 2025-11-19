import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/truckloads/[id] - Get a specific truckload
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    console.log(`Fetching truckload ${truckloadId}...`)

    const result = await query(`
      WITH truckload_assignments AS (
        -- Get all assignments with their order data
        SELECT 
          toa.truckload_id,
          toa.order_id,
          toa.assignment_type,
          -- Calculate footage from skids and vinyl
          COALESCE(
              (
                SELECT SUM(s.width * s.length * s.quantity)
                FROM skids s
                WHERE s.order_id = o.id
              ) + (
                SELECT SUM(v.width * v.length * v.quantity)
                FROM vinyl v
                WHERE v.order_id = o.id
              ),
              0
          ) as square_footage
        FROM truckload_order_assignments toa
        JOIN orders o ON toa.order_id = o.id
        WHERE toa.truckload_id = $1
      ),
      transfer_orders AS (
        -- Identify orders that have both pickup and delivery assignments
        SELECT DISTINCT
          ta1.truckload_id,
          ta1.order_id,
          ta1.square_footage
        FROM truckload_assignments ta1
        JOIN truckload_assignments ta2 ON 
          ta1.truckload_id = ta2.truckload_id 
          AND ta1.order_id = ta2.order_id
          AND ta1.assignment_type = 'pickup'
          AND ta2.assignment_type = 'delivery'
      ),
      footage_calculations AS (
        SELECT 
          t.id as truckload_id,
          -- Sum pickup footage (excluding orders that are also deliveries)
          COALESCE(SUM(CASE 
            WHEN ta.assignment_type = 'pickup' 
            AND NOT EXISTS (
              SELECT 1 FROM transfer_orders tr 
              WHERE tr.truckload_id = t.id 
              AND tr.order_id = ta.order_id
            )
            THEN ta.square_footage
            ELSE 0 
          END), 0) as pickup_footage,
          -- Sum delivery footage (excluding orders that are also pickups)
          COALESCE(SUM(CASE 
            WHEN ta.assignment_type = 'delivery' 
            AND NOT EXISTS (
              SELECT 1 FROM transfer_orders tr 
              WHERE tr.truckload_id = t.id 
              AND tr.order_id = ta.order_id
            )
            THEN ta.square_footage
            ELSE 0 
          END), 0) as delivery_footage,
          -- Sum transfer footage (count each order once)
          COALESCE(SUM(DISTINCT CASE 
            WHEN tr.order_id IS NOT NULL 
            THEN tr.square_footage
            ELSE 0 
          END), 0) as transfer_footage
        FROM truckloads t
        LEFT JOIN truckload_assignments ta ON t.id = ta.truckload_id
        LEFT JOIN transfer_orders tr ON t.id = tr.truckload_id AND ta.order_id = tr.order_id
        WHERE t.id = $1
        GROUP BY t.id
      )
      SELECT 
        t.id,
        t.driver_id as "driverId",
        -- Format dates as YYYY-MM-DD strings to avoid timezone issues
        TO_CHAR(t.start_date, 'YYYY-MM-DD') as "startDate",
        TO_CHAR(t.end_date, 'YYYY-MM-DD') as "endDate",
        t.trailer_number as "trailerNumber",
        t.bill_of_lading_number as "billOfLadingNumber",
        t.description,
        t.is_completed as "isCompleted",
        t.total_mileage as "totalMileage",
        t.estimated_duration as "estimatedDuration",
        u.full_name as "driverName",
        d.color as "driverColor",
        COALESCE(fc.pickup_footage, 0) as "pickupFootage",
        COALESCE(fc.delivery_footage, 0) as "deliveryFootage",
        COALESCE(fc.transfer_footage, 0) as "transferFootage"
      FROM truckloads t
      LEFT JOIN users u ON t.driver_id = u.id
      LEFT JOIN drivers d ON u.id = d.user_id
      LEFT JOIN footage_calculations fc ON t.id = fc.truckload_id
      WHERE t.id = $1
    `, [truckloadId])

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Truckload not found' 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      truckload: result.rows[0]
    })
  } catch (error) {
    console.error('Error fetching truckload:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch truckload',
      details: errorMessage
    }, { status: 500 })
  }
}

// PATCH /api/truckloads/[id] - Update a specific truckload
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    const data = await request.json()
    const { driverId, startDate, endDate, trailerNumber, description, bill_of_lading_number } = data

    // Build dynamic update query based on what fields are provided
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (driverId !== undefined) {
      updates.push(`driver_id = $${paramIndex++}`)
      values.push(driverId)
    }

    if (startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`)
      // Ensure date is in YYYY-MM-DD format (extract date part if ISO string)
      values.push(
        startDate && typeof startDate === 'string' 
          ? (startDate.includes('T') ? startDate.split('T')[0] : startDate)
          : (startDate ? new Date(startDate).toISOString().split('T')[0] : null)
      )
    }

    if (endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`)
      // Ensure date is in YYYY-MM-DD format (extract date part if ISO string)
      values.push(
        endDate && typeof endDate === 'string' 
          ? (endDate.includes('T') ? endDate.split('T')[0] : endDate)
          : (endDate ? new Date(endDate).toISOString().split('T')[0] : null)
      )
    }

    if (trailerNumber !== undefined) {
      updates.push(`trailer_number = $${paramIndex++}`)
      values.push(trailerNumber || null)
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description || null)
    }

    if (bill_of_lading_number !== undefined) {
      updates.push(`bill_of_lading_number = $${paramIndex++}`)
      values.push(bill_of_lading_number || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No fields to update' 
      }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(truckloadId)

    const result = await query(
      `UPDATE truckloads 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING 
         id,
         driver_id as "driverId",
         TO_CHAR(start_date, 'YYYY-MM-DD') as "startDate",
         TO_CHAR(end_date, 'YYYY-MM-DD') as "endDate",
         trailer_number as "trailerNumber",
         bill_of_lading_number as "billOfLadingNumber",
         description,
         is_completed as "isCompleted",
         total_mileage as "totalMileage",
         estimated_duration as "estimatedDuration"`,
      values
    )

    if (!result.rows.length) {
      return NextResponse.json({ 
        success: false, 
        error: 'Truckload not found' 
      }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      truckload: result.rows[0] 
    })
  } catch (error) {
    console.error('Error updating truckload:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update truckload' 
    }, { status: 500 })
  }
} 
