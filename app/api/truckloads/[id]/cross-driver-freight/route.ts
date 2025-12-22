import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// GET /api/truckloads/[id]/cross-driver-freight - Get cross-driver freight deductions for a truckload
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

    // Check if table exists first
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      // Table doesn't exist yet - return empty array instead of error
      return NextResponse.json({
        success: true,
        items: []
      })
    }

      // Check if is_addition column exists, if not, apply migration automatically
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'is_addition'
      `)
      
      if (columnCheck.rows.length === 0) {
        console.log('is_addition column not found, applying migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-is-addition-to-cross-driver-freight.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('is_addition column migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying is_addition migration:', migrationError)
          // Continue anyway - the column might already exist or migration might fail
        } finally {
          client.release()
        }
      }

      // Check if applies_to column exists, if not, apply migration automatically
      const appliesToCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'applies_to'
      `)
      
      if (appliesToCheck.rows.length === 0) {
        console.log('applies_to column not found, applying migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-applies-to-cross-driver-freight.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('applies_to column migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying applies_to migration:', migrationError)
          // Continue anyway - the column might already exist or migration might fail
        } finally {
          client.release()
        }
      }

    // Check if applies_to column exists (reuse the check from above)
    const hasAppliesTo = appliesToCheck.rows.length > 0
    
    // Check if customer_name column exists
    const customerNameCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cross_driver_freight_deductions'
      AND column_name = 'customer_name'
    `)
    let hasCustomerName = customerNameCheck.rows.length > 0
    
    // If customer_name column doesn't exist, apply migration automatically
    if (!hasCustomerName) {
      console.log('customer_name column not found, applying migration...')
      const client = await getClient()
      try {
        await client.query('BEGIN')
        const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
        const migrationSql = fs.readFileSync(
          path.join(migrationsDir, 'add-customer-name-to-cross-driver-freight.sql'),
          'utf8'
        )
        await client.query(migrationSql)
        await client.query('COMMIT')
        console.log('customer_name column migration applied successfully')
        hasCustomerName = true
      } catch (migrationError) {
        await client.query('ROLLBACK')
        console.error('Error applying customer_name migration:', migrationError)
        // Continue anyway - the column might already exist or migration might fail
      } finally {
        client.release()
      }
    }

    const result = await query(`
      SELECT 
        id,
        driver_name as "driverName",
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        action,
        footage,
        dimensions,
        deduction,
        is_manual as "isManual",
        comment,
        is_addition as "isAddition"${hasAppliesTo ? ', applies_to as "appliesTo"' : ''}${hasCustomerName ? ', customer_name as "customerName"' : ''}
      FROM cross_driver_freight_deductions
      WHERE truckload_id = $1
      ORDER BY created_at ASC
    `, [truckloadId])
    
    // Add default appliesTo for items that don't have it (for backward compatibility)
    const items = result.rows.map((row: any) => ({
      ...row,
      appliesTo: row.appliesTo || 'driver_pay'
    }))

    return NextResponse.json({
      success: true,
      items: items
    })
  } catch (error) {
    console.error('Error fetching cross-driver freight:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch cross-driver freight'
    }, { status: 500 })
  }
}

// POST /api/truckloads/[id]/cross-driver-freight - Save cross-driver freight deductions for a truckload
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

    const { items } = await request.json()

    if (!Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'Items must be an array' }, { status: 400 })
    }

    console.log(`[Cross-Driver Freight] Received ${items.length} items to save for truckload ${truckloadId}:`, JSON.stringify(items, null, 2))

    const client = await getClient()
    try {
      // Log which database we're connecting to (for debugging)
      const dbInfo = await client.query('SELECT current_database() as db_name, current_user as db_user, version() as db_version')
      const dbName = dbInfo.rows[0]?.db_name
      const dbUser = dbInfo.rows[0]?.db_user
      console.log(`[Cross-Driver Freight] Connected to database: ${dbName}, user: ${dbUser}`)
      
      // Check connection string to verify we're using preview
      const previewUrl = process.env.DB_CONNECTION_STRING_PREVIEW || ''
      const mainUrl = process.env.DB_CONNECTION_STRING_MAIN || ''
      const isPreview = previewUrl && (previewUrl.includes('ep-proud-glitter') || previewUrl.includes('preview'))
      const isMain = mainUrl && (mainUrl.includes('ep-calm-frog') || mainUrl.includes('main'))
      console.log(`[Cross-Driver Freight] Environment check - NODE_ENV: ${process.env.NODE_ENV}, Has PREVIEW_URL: ${!!previewUrl}, Has MAIN_URL: ${!!mainUrl}`)
      console.log(`[Cross-Driver Freight] Database should be PREVIEW (development): ${process.env.NODE_ENV !== 'production'}`)
      
      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'cross_driver_freight_deductions'
        )
      `)
      
      if (!tableCheck.rows[0].exists) {
        throw new Error('Table cross_driver_freight_deductions does not exist. Please run the migration: database/migrations/add-cross-driver-freight-table.sql')
      }

      // Check if is_addition column exists, if not, apply migration automatically
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'is_addition'
      `)
      
      if (columnCheck.rows.length === 0) {
        console.log('is_addition column not found, applying migration...')
        try {
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-is-addition-to-cross-driver-freight.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          console.log('is_addition column migration applied successfully')
        } catch (migrationError) {
          console.error('Error applying is_addition migration:', migrationError)
          // Continue anyway - the column might already exist or migration might fail
        }
      }

      await client.query('BEGIN')

      console.log(`[Cross-Driver Freight] Saving ${items.length} items for truckload ${truckloadId}`)

      // Delete existing items for this truckload
      const deleteResult = await client.query(
        'DELETE FROM cross_driver_freight_deductions WHERE truckload_id = $1',
        [truckloadId]
      )
      console.log(`[Cross-Driver Freight] Deleted ${deleteResult.rowCount} existing items`)

      // Check if applies_to column exists for INSERT
      const appliesToCheckForInsert = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'applies_to'
      `)
      const hasAppliesTo = appliesToCheckForInsert.rows.length > 0

      // Check if customer_name column exists for INSERT
      const customerNameCheckForInsert = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cross_driver_freight_deductions'
        AND column_name = 'customer_name'
      `)
      const hasCustomerNameForInsert = customerNameCheckForInsert.rows.length > 0

      // Insert new items
      for (const item of items) {
        const footage = typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0
        const deduction = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
        
        const insertResult = await client.query(`
          INSERT INTO cross_driver_freight_deductions (
            truckload_id,
            driver_name,
            date,
            action,
            footage,
            dimensions,
            deduction,
            is_manual,
            comment,
            is_addition${hasAppliesTo ? ', applies_to' : ''}${hasCustomerNameForInsert ? ', customer_name' : ''}
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10${hasAppliesTo ? ', $11' : ''}${hasCustomerNameForInsert ? (hasAppliesTo ? ', $12' : ', $11') : ''})
          RETURNING id
        `, [
          truckloadId,
          item.driverName || null,
          item.date || null,
          item.action || null,
          footage,
          item.dimensions || null,
          deduction,
          item.isManual || false,
          item.comment || null,
          item.isAddition || false,
          ...(hasAppliesTo ? [item.appliesTo || 'driver_pay'] : []),
          ...(hasCustomerNameForInsert ? [item.customerName || null] : [])
        ])
        console.log(`[Cross-Driver Freight] Inserted item: id=${insertResult.rows[0]?.id}, driver=${item.driverName}, deduction=${deduction}`)
      }

      await client.query('COMMIT')
      console.log(`[Cross-Driver Freight] Successfully saved ${items.length} items for truckload ${truckloadId}`)

      // Verify the data was saved by querying it back
      const verifyResult = await client.query(`
        SELECT id, driver_name, deduction, is_manual
        FROM cross_driver_freight_deductions
        WHERE truckload_id = $1
        ORDER BY created_at ASC
      `, [truckloadId])
      console.log(`[Cross-Driver Freight] Verification: Found ${verifyResult.rows.length} items in database for truckload ${truckloadId}`)
      verifyResult.rows.forEach((row, idx) => {
        console.log(`[Cross-Driver Freight] Verified item ${idx + 1}: id=${row.id}, driver=${row.driver_name}, deduction=${row.deduction}, manual=${row.is_manual}`)
      })

      return NextResponse.json({
        success: true,
        message: 'Cross-driver freight saved successfully',
        savedCount: items.length,
        verifiedCount: verifyResult.rows.length
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error saving cross-driver freight:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: `Failed to save cross-driver freight: ${errorMessage}`
    }, { status: 500 })
  }
}

