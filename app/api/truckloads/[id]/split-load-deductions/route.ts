import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, query } from '@/lib/db'

// GET /api/truckloads/[id]/split-load-deductions - Get all split load deductions for a truckload
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
      // Check if split_load_id column exists (new simplified system)
      const splitLoadIdCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'split_load_id'
      `)
      const hasSplitLoadId = splitLoadIdCheck.rows.length > 0

      let result
      if (hasSplitLoadId) {
        // Use new simplified system - get deductions via split_load_id
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
              applies_to,
              comment,
              is_addition
            FROM cross_driver_freight_deductions
            WHERE truckload_id = $1
              AND is_manual = true
              AND split_load_id IS NOT NULL
              AND order_id IS NOT NULL
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
              applies_to,
              comment,
              is_addition
            FROM cross_driver_freight_deductions
            WHERE truckload_id = $1
              AND is_manual = true
              AND split_load_id IS NOT NULL
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
              'driver_pay' as applies_to,
              comment,
              is_addition
            FROM cross_driver_freight_deductions
            WHERE truckload_id = $1
              AND is_manual = true
              AND split_load_id IS NOT NULL
            ORDER BY created_at DESC
          `, [truckloadId])
        }
      } else {
        // Fallback to old system (comment-based)
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
              applies_to,
              comment,
              is_addition
            FROM cross_driver_freight_deductions
            WHERE truckload_id = $1
              AND is_manual = true
              AND comment LIKE '%split load%'
              AND order_id IS NOT NULL
            ORDER BY created_at DESC
          `, [truckloadId])
        } else {
          result = { rows: [] }
        }
      }

      const deductions = result.rows
        .map(row => ({
          id: `db-${row.id}`,
          orderId: hasOrderId ? (row.order_id ? String(row.order_id) : null) : null,
          driverName: row.driver_name || '',
          date: row.date || '',
          action: row.action || 'Picked up',
          customerName: row.customer_name || '',
          amount: typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount || 0)) || 0,
          appliesTo: row.applies_to || 'driver_pay',
          comment: row.comment || '',
          isAddition: row.is_addition || false
        }))
        .filter(deduction => deduction.orderId !== null) // Additional safety filter

      return NextResponse.json({
        success: true,
        deductions
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching split load deductions:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch split load deductions'
    }, { status: 500 })
  }
}

