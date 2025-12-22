import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, query } from '@/lib/db'

// POST /api/truckloads/[id]/cross-driver-deductions - Save a cross-driver deduction
export async function POST(
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

    const body = await request.json()
    const { orderId, driverName, date, action, customerName, amount, appliesTo } = body

    if (!orderId || !driverName || !date || !action || !customerName || amount === undefined || amount === null || !appliesTo) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Validate amount
    const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount))
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be a positive number' }, { status: 400 })
    }

    // Validate appliesTo
    if (!['load_value', 'driver_pay'].includes(appliesTo)) {
      return NextResponse.json({ success: false, error: 'appliesTo must be "load_value" or "driver_pay"' }, { status: 400 })
    }

    // Validate action
    if (!['Picked up', 'Delivered'].includes(action)) {
      return NextResponse.json({ success: false, error: 'action must be "Picked up" or "Delivered"' }, { status: 400 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      // Check if applies_to column exists
      const appliesToCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'applies_to'
      `)
      const hasAppliesTo = appliesToCheck.rows.length > 0

      // Check if order_id column exists
      const orderIdCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'order_id'
      `)
      const hasOrderId = orderIdCheck.rows.length > 0

      // Insert the deduction
      if (hasAppliesTo && hasOrderId) {
        const result = await client.query(`
          INSERT INTO cross_driver_freight_deductions (
            truckload_id,
            order_id,
            driver_name,
            date,
            action,
            customer_name,
            deduction,
            is_manual,
            is_addition,
            applies_to,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `, [truckloadId, parseInt(orderId), driverName, date, action, customerName, amountNum, appliesTo])
        
        await client.query('COMMIT')
        
        return NextResponse.json({
          success: true,
          deductionId: `db-${result.rows[0].id}`
        })
      } else if (hasAppliesTo) {
        const result = await client.query(`
          INSERT INTO cross_driver_freight_deductions (
            truckload_id,
            driver_name,
            date,
            action,
            customer_name,
            deduction,
            is_manual,
            is_addition,
            applies_to,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `, [truckloadId, driverName, date, action, customerName, amountNum, appliesTo])
        
        await client.query('COMMIT')
        
        return NextResponse.json({
          success: true,
          deductionId: `db-${result.rows[0].id}`
        })
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error saving cross-driver deduction:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to save cross-driver deduction'
    }, { status: 500 })
  }
}

// GET /api/truckloads/[id]/cross-driver-deductions - Get all cross-driver deductions for a truckload
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

    // Check if applies_to column exists
    const appliesToCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cross_driver_freight_deductions'
      AND column_name = 'applies_to'
    `)
    const hasAppliesTo = appliesToCheck.rows.length > 0

    // Check if order_id column exists
    const orderIdCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cross_driver_freight_deductions'
      AND column_name = 'order_id'
    `)
    const hasOrderId = orderIdCheck.rows.length > 0

    const client = await getClient()
    
    try {
      let result
      if (hasAppliesTo && hasOrderId) {
        result = await client.query(`
          SELECT 
            id,
            order_id,
            driver_name,
            date,
            action,
            customer_name,
            deduction as amount,
            applies_to
          FROM cross_driver_freight_deductions
          WHERE truckload_id = $1
            AND is_manual = true
            AND is_addition = false
            AND comment NOT LIKE '%split load%'
          ORDER BY created_at DESC
        `, [truckloadId])
      } else if (hasAppliesTo) {
        result = await client.query(`
          SELECT 
            id,
            driver_name,
            date,
            action,
            customer_name,
            deduction as amount,
            applies_to
          FROM cross_driver_freight_deductions
          WHERE truckload_id = $1
            AND is_manual = true
            AND is_addition = false
            AND comment NOT LIKE '%split load%'
          ORDER BY created_at DESC
        `, [truckloadId])
      } else {
        result = await client.query(`
          SELECT 
            id,
            driver_name,
            date,
            action,
            customer_name,
            deduction as amount,
            'driver_pay' as applies_to
          FROM cross_driver_freight_deductions
          WHERE truckload_id = $1
            AND is_manual = true
            AND is_addition = false
            AND comment NOT LIKE '%split load%'
          ORDER BY created_at DESC
        `, [truckloadId])
      }

      const deductions = result.rows.map(row => ({
        id: `db-${row.id}`,
        orderId: hasOrderId ? (row.order_id ? String(row.order_id) : null) : null,
        driverName: row.driver_name || '',
        date: row.date || '',
        action: row.action || 'Picked up',
        customerName: row.customer_name || '',
        amount: typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount || 0)) || 0,
        appliesTo: row.applies_to || 'driver_pay'
      }))

      return NextResponse.json({
        success: true,
        deductions
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching cross-driver deductions:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch cross-driver deductions'
    }, { status: 500 })
  }
}

// PATCH /api/truckloads/[id]/cross-driver-deductions - Update a deduction's appliesTo
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

    const body = await request.json()
    const { deductionId, appliesTo } = body

    if (!deductionId || !appliesTo) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Validate appliesTo
    if (!['load_value', 'driver_pay'].includes(appliesTo)) {
      return NextResponse.json({ success: false, error: 'appliesTo must be "load_value" or "driver_pay"' }, { status: 400 })
    }

    // Extract database ID from deductionId (format: "db-123")
    const dbId = deductionId.startsWith('db-') ? parseInt(deductionId.substring(3)) : parseInt(deductionId)
    if (isNaN(dbId)) {
      return NextResponse.json({ success: false, error: 'Invalid deduction ID' }, { status: 400 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      // Check if applies_to column exists
      const appliesToCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'applies_to'
      `)
      const hasAppliesTo = appliesToCheck.rows.length > 0

      if (hasAppliesTo) {
        await client.query(`
          UPDATE cross_driver_freight_deductions
          SET applies_to = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND truckload_id = $3
            AND is_manual = true
            AND comment NOT LIKE '%split load%'
        `, [appliesTo, dbId, truckloadId])
      } else {
        // Column doesn't exist, can't update
        await client.query('ROLLBACK')
        return NextResponse.json({ success: false, error: 'applies_to column does not exist' }, { status: 400 })
      }
      
      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating cross-driver deduction:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update cross-driver deduction'
    }, { status: 500 })
  }
}

// DELETE /api/truckloads/[id]/cross-driver-deductions - Delete a cross-driver deduction
export async function DELETE(
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

    const body = await request.json()
    const { deductionId } = body

    if (!deductionId) {
      return NextResponse.json({ success: false, error: 'Missing deduction ID' }, { status: 400 })
    }

    // Extract database ID from deductionId (format: "db-123")
    const dbId = deductionId.startsWith('db-') ? parseInt(deductionId.substring(3)) : parseInt(deductionId)
    if (isNaN(dbId)) {
      return NextResponse.json({ success: false, error: 'Invalid deduction ID' }, { status: 400 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      // Delete the deduction
      await client.query(`
        DELETE FROM cross_driver_freight_deductions
        WHERE id = $1
          AND truckload_id = $2
          AND is_manual = true
          AND comment NOT LIKE '%split load%'
      `, [dbId, truckloadId])
      
      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting cross-driver deduction:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete cross-driver deduction'
    }, { status: 500 })
  }
}
