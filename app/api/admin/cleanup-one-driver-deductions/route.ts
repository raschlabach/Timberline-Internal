import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, query } from '@/lib/db'

// DELETE /api/admin/cleanup-one-driver-deductions - Delete all manual deductions (except split loads)
// This is the ultra-simple version that deletes ALL manual deductions to start fresh
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')

      // First, count what will be deleted
      const countResult = await client.query(`
        SELECT COUNT(*) as total
        FROM cross_driver_freight_deductions
        WHERE is_manual = true
          AND (comment IS NULL OR comment NOT LIKE '%split load%')
      `)
      
      const countToDelete = parseInt(countResult.rows[0]?.total || '0')

      if (countToDelete === 0) {
        await client.query('COMMIT')
        return NextResponse.json({
          success: true,
          message: 'No manual deductions found to delete',
          deletedCount: 0
        })
      }

      // Delete all manual deductions except split loads
      const deleteResult = await client.query(`
        DELETE FROM cross_driver_freight_deductions
        WHERE is_manual = true
          AND (comment IS NULL OR comment NOT LIKE '%split load%')
      `)

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${deleteResult.rowCount} manual deductions. Split load deductions were preserved.`,
        deletedCount: deleteResult.rowCount
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error cleaning up deductions:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup deductions'
    }, { status: 500 })
  }
}

