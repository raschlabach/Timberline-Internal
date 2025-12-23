import { NextRequest, NextResponse } from 'next/server'
import { runMigrations } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/migrations/run - Run pending database migrations
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admins to run migrations
    // You can add role checking here if needed
    // if (session.user.role !== 'admin') {
    //   return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    // }

    console.log('Running database migrations...')
    await runMigrations()
    console.log('Database migrations completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Migrations completed successfully'
    })
  } catch (error) {
    console.error('Error running migrations:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to run migrations',
      details: errorMessage
    }, { status: 500 })
  }
}

// GET /api/migrations/run - Check migration status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { query } = await import('@/lib/db')
    const result = await query(`
      SELECT name, status, applied_at, error_message
      FROM migrations
      ORDER BY applied_at DESC
      LIMIT 50
    `)

    return NextResponse.json({
      success: true,
      migrations: result.rows
    })
  } catch (error) {
    console.error('Error checking migrations:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check migrations'
    }, { status: 500 })
  }
}

