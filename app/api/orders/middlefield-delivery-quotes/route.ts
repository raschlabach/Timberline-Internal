import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

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

    // Check if middlefield_delivery_quote column exists, if not, apply migration automatically
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders'
        AND column_name = 'middlefield_delivery_quote'
      `)
      
      if (columnCheck.rows.length === 0) {
        console.log('middlefield_delivery_quote column not found, applying migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-middlefield-delivery-quote.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('middlefield_delivery_quote column migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying middlefield_delivery_quote migration:', migrationError)
          // Continue anyway - the error handling below will catch if column is missing
        } finally {
          client.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking/applying migration:', migrationCheckError)
      // Continue anyway - will try to query and handle gracefully
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
        const newDeliveryQuote = deliveryQuote ? parseFloat(deliveryQuote) : null
        const deliveryCustomerName = order.delivery_customer_name || 'Unknown Customer'
        // Deduction amount is simply the delivery quote value (not the difference)
        const deductionAmount = newDeliveryQuote !== null && newDeliveryQuote > 0 ? newDeliveryQuote : null

        // Update the order's delivery quote
        await client.query(`
          UPDATE orders
          SET middlefield_delivery_quote = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newDeliveryQuote, orderId])

        // Handle deduction: delete existing if delivery quote is cleared, or update/create if set
        if (newDeliveryQuote === null || newDeliveryQuote <= 0) {
          // Delete existing deduction if delivery quote is cleared
          // Check if applies_to column exists first
          const appliesToCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'cross_driver_freight_deductions'
            AND column_name = 'applies_to'
          `)
          
          if (appliesToCheck.rows.length > 0) {
            await client.query(`
              DELETE FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%middlefield drop%'
                AND is_manual = true
                AND applies_to = 'driver_pay'
            `, [pickupTruckloadId, deliveryCustomerName])
          } else {
            await client.query(`
              DELETE FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%middlefield drop%'
                AND is_manual = true
            `, [pickupTruckloadId, deliveryCustomerName])
          }
        } else if (deductionAmount !== null && deductionAmount > 0) {
          // Check if applies_to column exists
          const appliesToCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'cross_driver_freight_deductions'
            AND column_name = 'applies_to'
          `)
          const hasAppliesTo = appliesToCheck.rows.length > 0
          
          // Check if deduction already exists
          let existingDeduction
          if (hasAppliesTo) {
            existingDeduction = await client.query(`
              SELECT id
              FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%middlefield drop%'
                AND is_manual = true
                AND applies_to = 'driver_pay'
              LIMIT 1
            `, [pickupTruckloadId, deliveryCustomerName])
          } else {
            existingDeduction = await client.query(`
              SELECT id
              FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%middlefield drop%'
                AND is_manual = true
              LIMIT 1
            `, [pickupTruckloadId, deliveryCustomerName])
          }

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
            if (hasAppliesTo) {
              await client.query(`
                INSERT INTO cross_driver_freight_deductions (
                  truckload_id,
                  deduction,
                  is_manual,
                  comment,
                  is_addition,
                  applies_to
                ) VALUES ($1, $2, true, $3, false, 'driver_pay')
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

