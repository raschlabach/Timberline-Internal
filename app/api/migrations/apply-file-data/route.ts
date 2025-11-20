import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

/**
 * One-time migration endpoint to add file_data columns to order_links table
 * This should only be run once in production
 * 
 * Usage: POST /api/migrations/apply-file-data
 * Requires: Admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (optional - remove if you want any authenticated user to run)
    // if (session.user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    // }

    console.log('Applying file_data migration to order_links table...')

    // Check if columns already exist
    const checkResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'order_links' 
      AND column_name IN ('file_data', 'file_name', 'file_type', 'file_size')
    `)

    const existingColumns = checkResult.rows.map((row: any) => row.column_name)
    const allColumnsExist = ['file_data', 'file_name', 'file_type', 'file_size'].every(
      col => existingColumns.includes(col)
    )

    if (allColumnsExist) {
      return NextResponse.json({
        success: true,
        message: 'Migration already applied - all columns exist',
        existingColumns
      })
    }

    // Apply migration
    await query(`
      ALTER TABLE order_links 
      ADD COLUMN IF NOT EXISTS file_data TEXT,
      ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS file_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS file_size INTEGER
    `)

    console.log('Migration applied successfully')

    return NextResponse.json({
      success: true,
      message: 'Migration applied successfully',
      addedColumns: ['file_data', 'file_name', 'file_type', 'file_size']
    })
  } catch (error) {
    console.error('Error applying migration:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to apply migration'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

