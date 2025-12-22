import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, query } from '@/lib/db'

// DELETE /api/admin/delete-automatic-deductions - Delete all automatic deductions
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const client = await getClient()
    
    try {
      await client.query('BEGIN')
      
      // First, count how many automatic deductions exist
      const countResult = await client.query(`
        SELECT COUNT(*) as count
        FROM cross_driver_freight_deductions
        WHERE is_manual = false
      `)
      
      const count = parseInt(countResult.rows[0].count)
      
      if (count === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: true,
          message: 'No automatic deductions found. Nothing to delete.',
          deletedCount: 0
        })
      }
      
      // Delete all automatic deductions
      const deleteResult = await client.query(`
        DELETE FROM cross_driver_freight_deductions
        WHERE is_manual = false
      `)
      
      await client.query('COMMIT')
      
      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${deleteResult.rowCount} automatic deduction(s).`,
        deletedCount: deleteResult.rowCount
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting automatic deductions:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete automatic deductions'
    }, { status: 500 })
  }
}

