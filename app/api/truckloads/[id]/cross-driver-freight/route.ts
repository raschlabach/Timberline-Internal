import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
        comment
      FROM cross_driver_freight_deductions
      WHERE truckload_id = $1
      ORDER BY created_at ASC
    `, [truckloadId])

    return NextResponse.json({
      success: true,
      items: result.rows
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
      const dbInfo = await client.query('SELECT current_database() as db_name, current_user as db_user')
      console.log(`[Cross-Driver Freight] Connected to database: ${dbInfo.rows[0]?.db_name}, user: ${dbInfo.rows[0]?.db_user}`)
      
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

      await client.query('BEGIN')

      console.log(`[Cross-Driver Freight] Saving ${items.length} items for truckload ${truckloadId}`)

      // Delete existing items for this truckload
      const deleteResult = await client.query(
        'DELETE FROM cross_driver_freight_deductions WHERE truckload_id = $1',
        [truckloadId]
      )
      console.log(`[Cross-Driver Freight] Deleted ${deleteResult.rowCount} existing items`)

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
            comment
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
          item.comment || null
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

