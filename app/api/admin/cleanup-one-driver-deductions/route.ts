import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, query } from '@/lib/db'

// DELETE /api/admin/cleanup-one-driver-deductions - Delete all deductions from one-driver loads
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      // Find all truckloads where all orders have the same driver
      const oneDriverTruckloads = await client.query(`
        SELECT DISTINCT t.id as truckload_id
        FROM truckloads t
        WHERE NOT EXISTS (
          -- Check if there are orders with different drivers
          SELECT 1
          FROM truckload_order_assignments toa1
          JOIN truckload_order_assignments toa2 
            ON toa1.order_id = toa2.order_id 
            AND toa1.assignment_type != toa2.assignment_type
          JOIN truckloads t1 ON toa1.truckload_id = t1.id
          JOIN truckloads t2 ON toa2.truckload_id = t2.id
          WHERE (t1.id = t.id OR t2.id = t.id)
            AND t1.driver_id != t2.driver_id
        )
        AND EXISTS (
          -- Make sure truckload has at least one order
          SELECT 1
          FROM truckload_order_assignments toa
          WHERE toa.truckload_id = t.id
        )
      `)

      const truckloadIds = oneDriverTruckloads.rows.map(row => row.truckload_id)
      
      if (truckloadIds.length === 0) {
        await client.query('COMMIT')
        return NextResponse.json({
          success: true,
          message: 'No one-driver truckloads found',
          deletedCount: 0
        })
      }

      // Delete all deductions from these truckloads
      // Only delete manual deductions (not split load deductions)
      const deleteResult = await client.query(`
        DELETE FROM cross_driver_freight_deductions
        WHERE truckload_id = ANY($1)
          AND is_manual = true
          AND (comment IS NULL OR comment NOT LIKE '%split load%')
      `, [truckloadIds])

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Cleaned up deductions from ${truckloadIds.length} one-driver truckloads`,
        deletedCount: deleteResult.rowCount,
        truckloadIds: truckloadIds
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error cleaning up one-driver deductions:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup deductions'
    }, { status: 500 })
  }
}

