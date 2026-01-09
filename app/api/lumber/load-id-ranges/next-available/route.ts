import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/load-id-ranges/next-available?count=1
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const count = parseInt(searchParams.get('count') || '1')

    if (count < 1 || count > 100) {
      return NextResponse.json({ error: 'Count must be between 1 and 100' }, { status: 400 })
    }

    // Get the active range
    const rangeResult = await query(`
      SELECT * FROM lumber_load_id_ranges 
      WHERE is_active = TRUE 
      ORDER BY id DESC 
      LIMIT 1
    `)

    if (rangeResult.rows.length === 0) {
      return NextResponse.json({ error: 'No active load ID range configured' }, { status: 404 })
    }

    const activeRange = rangeResult.rows[0]

    // Find available IDs in the range
    let availableResult
    try {
      availableResult = await query(`
        SELECT n 
        FROM generate_series($1, $2) n
        WHERE NOT EXISTS (
          SELECT 1 FROM lumber_loads WHERE load_id = n::TEXT
        )
        ORDER BY n
        LIMIT $3
      `, [activeRange.start_range, activeRange.end_range, count])
    } catch (dbError) {
      console.error('Database query error:', dbError)
      return NextResponse.json({ 
        error: 'Database query failed',
        details: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, { status: 500 })
    }

    const availableIds = availableResult.rows.map(row => row.n.toString())

    if (availableIds.length < count) {
      return NextResponse.json({ 
        error: `Only ${availableIds.length} IDs available in range ${activeRange.start_range}-${activeRange.end_range}`,
        availableIds 
      }, { status: 409 })
    }

    return NextResponse.json({ 
      loadIds: availableIds,
      range: {
        name: activeRange.range_name,
        start: activeRange.start_range,
        end: activeRange.end_range
      }
    })
  } catch (error) {
    console.error('Error getting next available load ID:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
