import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// POST /api/orders/middlefield-delivery-quotes - Update split quotes and create deductions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { updates } = data // Array of { orderId, splitQuote, otherTruckloadId, assignmentType, customerName }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Updates array is required' }, { status: 400 })
    }

    // Check if split_quote column exists, if not, apply migration
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders'
        AND column_name IN ('split_quote', 'middlefield_delivery_quote')
      `)
      
      const hasSplitQuote = columnCheck.rows.some(r => r.column_name === 'split_quote')
      const hasOldColumn = columnCheck.rows.some(r => r.column_name === 'middlefield_delivery_quote')
      
      if (!hasSplitQuote && hasOldColumn) {
        console.log('Applying split_quote migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'simplify-split-loads.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('split_quote migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying split_quote migration:', migrationError)
        } finally {
          client.release()
        }
      } else if (!hasSplitQuote && !hasOldColumn) {
        // Neither column exists, create split_quote
        const client = await getClient()
        try {
          await client.query('BEGIN')
          await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_quote DECIMAL(10, 2)')
          await client.query('COMMIT')
          console.log('split_quote column created')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error creating split_quote column:', migrationError)
        } finally {
          client.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking/applying migration:', migrationCheckError)
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
      await client.query('BEGIN')

      for (const update of updates) {
        const { orderId, splitQuote, otherTruckloadId, assignmentType, customerName } = update

        if (!orderId) {
          throw new Error('orderId is required')
        }

        if (!otherTruckloadId) {
          throw new Error('otherTruckloadId is required')
        }

        const newSplitQuote = splitQuote ? parseFloat(splitQuote) : null
        const customerNameForDeduction = customerName || 'Unknown Customer'
        const deductionAmount = newSplitQuote !== null && newSplitQuote > 0 ? newSplitQuote : null

        // Update the order's split quote
        await client.query(`
          UPDATE orders
          SET split_quote = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newSplitQuote, orderId])

        // Handle deduction: delete existing if split quote is cleared, or update/create if set
        if (newSplitQuote === null || newSplitQuote <= 0) {
          // Delete existing deduction if split quote is cleared
          if (hasAppliesTo) {
            await client.query(`
              DELETE FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
                AND applies_to = 'driver_pay'
            `, [otherTruckloadId, customerNameForDeduction])
          } else {
            await client.query(`
              DELETE FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
            `, [otherTruckloadId, customerNameForDeduction])
          }
        } else if (deductionAmount !== null && deductionAmount > 0) {
          // Check if deduction already exists
          let existingDeduction
          if (hasAppliesTo) {
            existingDeduction = await client.query(`
              SELECT id
              FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
                AND applies_to = 'driver_pay'
              LIMIT 1
            `, [otherTruckloadId, customerNameForDeduction])
          } else {
            existingDeduction = await client.query(`
              SELECT id
              FROM cross_driver_freight_deductions
              WHERE truckload_id = $1
                AND comment LIKE '%' || $2 || '%split load%'
                AND is_manual = true
              LIMIT 1
            `, [otherTruckloadId, customerNameForDeduction])
          }

          const comment = `${customerNameForDeduction} split load`

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
              `, [otherTruckloadId, deductionAmount, comment])
            } else {
              await client.query(`
                INSERT INTO cross_driver_freight_deductions (
                  truckload_id,
                  deduction,
                  is_manual,
                  comment,
                  is_addition
                ) VALUES ($1, $2, true, $3, false)
              `, [otherTruckloadId, deductionAmount, comment])
            }
          }
        }
      }

      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true,
        message: `Updated ${updates.length} split quote(s)`
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating split quotes:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to update split quotes',
      details: errorMessage
    }, { status: 500 })
  }
}
