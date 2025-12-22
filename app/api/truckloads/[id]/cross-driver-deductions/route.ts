import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
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

    if (!orderId || !driverName || !date || !action || !customerName || !amount || !appliesTo) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
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

      // Insert the deduction
      if (hasAppliesTo) {
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
        `, [truckloadId, driverName, date, action, customerName, amount, appliesTo])
        
        await client.query('COMMIT')
        
        return NextResponse.json({
          success: true,
          deductionId: `db-${result.rows[0].id}`
        })
      } else {
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
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `, [truckloadId, driverName, date, action, customerName, amount])
        
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

    const client = await getClient()
    
    try {
      let result
      if (hasAppliesTo) {
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
          ORDER BY created_at DESC
        `, [truckloadId])
      }

      const deductions = result.rows.map(row => ({
        id: `db-${row.id}`,
        orderId: null, // We don't store orderId in the current schema, but we can add it later if needed
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

