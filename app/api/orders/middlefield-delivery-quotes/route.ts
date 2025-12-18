import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/orders/middlefield-delivery-quotes - Bulk update delivery quotes and create deductions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { updates } = data // Array of { orderId, deliveryQuote, pickupTruckloadId }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Updates array is required' }, { status: 400 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      for (const update of updates) {
        const { orderId, deliveryQuote, pickupTruckloadId } = update

        if (!orderId || !pickupTruckloadId) {
          throw new Error('orderId and pickupTruckloadId are required')
        }

        // Get order details to calculate deduction
        const orderResult = await client.query(`
          SELECT 
            o.freight_quote,
            o.middlefield_delivery_quote,
            dc.customer_name as delivery_customer_name
          FROM orders o
          LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
          WHERE o.id = $1
        `, [orderId])

        if (orderResult.rows.length === 0) {
          throw new Error(`Order ${orderId} not found`)
        }

        const order = orderResult.rows[0]
        const fullQuote = parseFloat(order.freight_quote) || 0
        const newDeliveryQuote = deliveryQuote ? parseFloat(deliveryQuote) : null
        const deliveryCustomerName = order.delivery_customer_name || 'Unknown Customer'
        const deductionAmount = newDeliveryQuote !== null ? fullQuote - newDeliveryQuote : null

        // Update the order's delivery quote
        await client.query(`
          UPDATE orders
          SET middlefield_delivery_quote = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newDeliveryQuote, orderId])

        // Handle deduction: delete existing if delivery quote is cleared, or update/create if set
        if (newDeliveryQuote === null) {
          // Delete existing deduction if delivery quote is cleared
          await client.query(`
            DELETE FROM cross_driver_freight_deductions
            WHERE truckload_id = $1
              AND comment LIKE '%' || $2 || '%middlefield drop%'
              AND is_manual = true
              AND applies_to = 'load_value'
          `, [pickupTruckloadId, deliveryCustomerName])
        } else if (deductionAmount !== null && deductionAmount > 0) {
          // Check if deduction already exists
          const existingDeduction = await client.query(`
            SELECT id
            FROM cross_driver_freight_deductions
            WHERE truckload_id = $1
              AND comment LIKE '%' || $2 || '%middlefield drop%'
              AND is_manual = true
              AND applies_to = 'load_value'
            LIMIT 1
          `, [pickupTruckloadId, deliveryCustomerName])

          const comment = `${deliveryCustomerName} middlefield drop`

          if (existingDeduction.rows.length > 0) {
            // Update existing deduction
            await client.query(`
              UPDATE cross_driver_freight_deductions
              SET deduction = $1,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [deductionAmount, existingDeduction.rows[0].id])
          } else {
            // Create new deduction
            // Check if applies_to column exists
            const columnCheck = await client.query(`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'cross_driver_freight_deductions'
              AND column_name = 'applies_to'
            `)

            const hasAppliesTo = columnCheck.rows.length > 0

            if (hasAppliesTo) {
              await client.query(`
                INSERT INTO cross_driver_freight_deductions (
                  truckload_id,
                  deduction,
                  is_manual,
                  comment,
                  is_addition,
                  applies_to
                ) VALUES ($1, $2, true, $3, false, 'load_value')
              `, [pickupTruckloadId, deductionAmount, comment])
            } else {
              await client.query(`
                INSERT INTO cross_driver_freight_deductions (
                  truckload_id,
                  deduction,
                  is_manual,
                  comment,
                  is_addition
                ) VALUES ($1, $2, true, $3, false)
              `, [pickupTruckloadId, deductionAmount, comment])
            }
          }
        }
      }

      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true,
        message: `Updated ${updates.length} delivery quote(s)`
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating middlefield delivery quotes:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to update delivery quotes',
      details: errorMessage
    }, { status: 500 })
  }
}

