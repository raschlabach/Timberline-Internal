import { NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(params.id)
    if (isNaN(driverId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid driver ID' 
      }, { status: 400 })
    }

  const client = await getClient()
  
  try {
      // Check if the driver is assigned to any truckloads (active or completed)
      const assignmentCheck = await client.query(
        `SELECT COUNT(*) as count FROM truckloads WHERE driver_id = $1`,
        [driverId]
      )

      const truckloadCount = parseInt(assignmentCheck.rows[0].count)
      
      // Check for active truckloads specifically
      const activeCheck = await client.query(
        `SELECT COUNT(*) as count FROM truckloads WHERE driver_id = $1 AND is_completed = FALSE`,
        [driverId]
      )
      const activeCount = parseInt(activeCheck.rows[0].count)

      if (activeCount > 0) {
        client.release()
        return NextResponse.json({ 
          success: false, 
          error: 'Cannot delete driver: assigned to active truckloads' 
        }, { status: 400 })
      }

    // Start a transaction
    await client.query('BEGIN')

    try {
        // If there are completed truckloads, set driver_id to NULL to preserve historical data
        if (truckloadCount > 0) {
          await client.query(
            `UPDATE truckloads SET driver_id = NULL WHERE driver_id = $1`,
            [driverId]
          )
        }

      // Delete from drivers table first (due to foreign key constraint)
        const driverDeleteResult = await client.query(
          'DELETE FROM drivers WHERE user_id = $1 RETURNING user_id', 
          [driverId]
        )
        
        if (driverDeleteResult.rows.length === 0) {
          await client.query('ROLLBACK')
          client.release()
          return NextResponse.json({ 
            success: false, 
            error: 'Driver not found' 
          }, { status: 404 })
        }
      
      // Then delete from users table
        await client.query('DELETE FROM users WHERE id = $1 AND role = \'driver\'', [driverId])

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Driver deleted successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting driver:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return NextResponse.json({
        success: false,
        error: errorMessage || 'Failed to delete driver'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in driver delete handler:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      success: false,
      error: errorMessage || 'Failed to delete driver'
    }, { status: 500 })
  }
} 