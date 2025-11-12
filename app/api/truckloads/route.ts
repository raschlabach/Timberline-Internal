import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/truckloads - Get all truckloads
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching truckloads...')

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
        GROUP BY t.id
      )
      SELECT 
        t.id,
        t.driver_id as "driverId",
        t.start_date as "startDate",
        t.end_date as "endDate",
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
      ORDER BY t.start_date DESC
    `)

    // Log detailed information for each truckload
    if (result.rows && result.rows.length > 0) {
      for (const truckload of result.rows) {
        console.log(`\nTruckload ${truckload.id} details:`, {
          driverName: truckload.driverName,
          pickupFootage: truckload.pickupFootage,
          deliveryFootage: truckload.deliveryFootage,
          transferFootage: truckload.transferFootage,
          assignments: await query(`
            SELECT 
              toa.truckload_id,
              toa.order_id,
              toa.assignment_type,
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
              ) as square_footage,
              CASE WHEN EXISTS (
                SELECT 1 
                FROM truckload_order_assignments toa2 
                WHERE toa2.truckload_id = toa.truckload_id 
                AND toa2.order_id = toa.order_id 
                AND toa2.assignment_type != toa.assignment_type
              ) THEN true ELSE false END as is_transfer
            FROM truckload_order_assignments toa
            JOIN orders o ON toa.order_id = o.id
            WHERE toa.truckload_id = $1
          `, [truckload.id])
        })
      }
    }

    if (!result.rows) {
      console.error('No rows returned from query')
      return NextResponse.json({
        success: false,
        error: 'No truckloads found',
        details: 'Query returned no results'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      truckloads: result.rows
    })
  } catch (error) {
    console.error('Error fetching truckloads:', error)
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    }
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch truckloads',
      details: error instanceof Error ? error.message : 'Unknown error'
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
    const { driverId, startDate, endDate, trailerNumber, billOfLadingNumber, description } = await request.json()

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
      // Use provided BOL number or generate auto-incrementing BOL number
      let bolNumber = billOfLadingNumber
      if (!bolNumber) {
        const bolResult = await client.query('SELECT get_next_bol_number() as bol_number')
        bolNumber = bolResult.rows[0].bol_number
      }

      // Insert into truckloads table
      const result = await client.query(
        `INSERT INTO truckloads (
          driver_id,
          start_date,
          end_date,
          trailer_number,
          bill_of_lading_number,
          description,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          driverId,
          startDate,
          endDate,
          trailerNumber || null,
          bolNumber,
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

// PATCH /api/truckloads - Update truckload
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id, driverId, startDate, endDate, trailerNumber, description } = await request.json()

    if (!id || !driverId || !startDate || !endDate) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    const result = await query(
      `UPDATE truckloads 
       SET driver_id = $1,
           start_date = $2,
           end_date = $3,
           trailer_number = $4,
           description = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [driverId, startDate, endDate, trailerNumber || null, description || null, id]
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

// DELETE /api/truckloads - Delete truckload
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Truckload ID is required' 
      }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // 1. Get all affected orders before deleting assignments
      const affectedOrdersResult = await client.query(
        `SELECT DISTINCT order_id FROM truckload_order_assignments WHERE truckload_id = $1`,
        [id]
      )
      
      const affectedOrderIds = affectedOrdersResult.rows.map(row => row.order_id)

      // 2. Delete all assignments for this truckload
      await client.query(
        `DELETE FROM truckload_order_assignments WHERE truckload_id = $1`,
        [id]
      )

      // 3. Update order statuses for all affected orders
      for (const orderId of affectedOrderIds) {
        // Check remaining assignments for this order
        const remainingAssignments = await client.query(
          `WITH assignments AS (
             SELECT 
               assignment_type,
               truckload_id
             FROM truckload_order_assignments
             WHERE order_id = $1
           )
           SELECT 
             COUNT(*) as total_count,
             COUNT(*) FILTER (
               WHERE assignment_type = 'pickup'
             ) as pickup_count,
             COUNT(*) FILTER (
               WHERE assignment_type = 'delivery'
             ) as delivery_count,
             COUNT(DISTINCT truckload_id) as distinct_truckloads
           FROM assignments`,
          [orderId]
        )

        const { 
          total_count, 
          pickup_count,
          delivery_count,
          distinct_truckloads 
        } = remainingAssignments.rows[0]

        // An order is a transfer only if:
        // 1. Both pickup and delivery are assigned (pickup_count = 1 and delivery_count = 1)
        // 2. They are assigned to the same truckload (distinct_truckloads = 1)
        const isTransfer = total_count === 2 && distinct_truckloads === 1

        // Update order status and transfer flag
        await client.query(
          `UPDATE orders
           SET status = $1,
               is_transfer_order = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [
            total_count === 0 ? 'unassigned' : (
              pickup_count > 0 ? 'pickup_assigned' : 'delivery_assigned'
            ),
            isTransfer,
            orderId
          ]
        )
      }

      // 4. Delete the truckload
      const result = await client.query(
        `DELETE FROM truckloads WHERE id = $1 RETURNING *`,
        [id]
      )

      if (!result.rows.length) {
        await client.query('ROLLBACK')
        return NextResponse.json({ 
          success: false, 
          error: 'Truckload not found' 
        }, { status: 404 })
      }

      await client.query('COMMIT')

      return NextResponse.json({ 
        success: true, 
        message: 'Truckload deleted successfully' 
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting truckload:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete truckload' 
    }, { status: 500 })
  }
} 