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

    const client = await getClient()
    try {
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

      // Delete existing items for this truckload
      await client.query(
        'DELETE FROM cross_driver_freight_deductions WHERE truckload_id = $1',
        [truckloadId]
      )

      // Insert new items
      for (const item of items) {
        await client.query(`
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
        `, [
          truckloadId,
          item.driverName || null,
          item.date || null,
          item.action || null,
          item.footage || 0,
          item.dimensions || null,
          item.deduction || 0,
          item.isManual || false,
          item.comment || null
        ])
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Cross-driver freight saved successfully'
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

