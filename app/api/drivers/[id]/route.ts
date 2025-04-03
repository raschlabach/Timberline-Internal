import { NextResponse } from 'next/server'
import { getClient } from '@/lib/db'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const client = await getClient()
  
  try {
    const { id } = params
    if (!id) throw new Error('No ID provided')

    // Start a transaction
    await client.query('BEGIN')

    try {
      // Delete from drivers table first (due to foreign key constraint)
      await client.query('DELETE FROM drivers WHERE user_id = $1', [id])
      
      // Then delete from users table
      await client.query('DELETE FROM users WHERE id = $1', [id])

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
    return NextResponse.json({
      success: false,
      error: 'Failed to delete driver'
    }, { status: 500 })
  }
} 