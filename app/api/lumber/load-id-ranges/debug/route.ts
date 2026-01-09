import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/load-id-ranges/debug - Diagnostic endpoint
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const diagnostics: any = {}

    // Check if lumber_load_id_ranges table exists and has data
    try {
      const rangesResult = await query('SELECT * FROM lumber_load_id_ranges')
      diagnostics.ranges = {
        exists: true,
        count: rangesResult.rows.length,
        data: rangesResult.rows
      }
    } catch (error) {
      diagnostics.ranges = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Check if lumber_loads table exists
    try {
      const loadsResult = await query('SELECT COUNT(*) as count FROM lumber_loads')
      diagnostics.loads = {
        exists: true,
        count: loadsResult.rows[0].count
      }
    } catch (error) {
      diagnostics.loads = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Check load_id column type
    try {
      const columnResult = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'lumber_loads' AND column_name = 'load_id'
      `)
      diagnostics.load_id_column = {
        exists: columnResult.rows.length > 0,
        data: columnResult.rows[0] || null
      }
    } catch (error) {
      diagnostics.load_id_column = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Try a simple test query
    try {
      const testResult = await query(`
        SELECT n 
        FROM generate_series(1000, 1005) n
        LIMIT 3
      `)
      diagnostics.generate_series_test = {
        success: true,
        result: testResult.rows
      }
    } catch (error) {
      diagnostics.generate_series_test = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json(diagnostics)
  } catch (error) {
    console.error('Diagnostic error:', error)
    return NextResponse.json({
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
