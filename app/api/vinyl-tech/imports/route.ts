import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'

    let whereClause = ''
    if (status === 'active') {
      whereClause = "WHERE i.status = 'active'"
    } else if (status === 'past') {
      whereClause = "WHERE i.status = 'completed'"
    }

    const result = await query(`
      SELECT
        i.id,
        i.file_name,
        i.week_label,
        TO_CHAR(i.week_date, 'YYYY-MM-DD') as week_date,
        i.sheet_status,
        i.total_items,
        i.items_with_freight,
        i.total_weight,
        i.status,
        i.notes,
        i.created_at,
        u.full_name as created_by_name,
        COUNT(CASE WHEN items.status = 'pending' AND items.has_freight THEN 1 END) as pending_items,
        COUNT(CASE WHEN items.status = 'converted' THEN 1 END) as converted_items,
        COUNT(CASE WHEN items.customer_matched = false AND items.has_freight THEN 1 END) as unmatched_items
      FROM vinyl_tech_imports i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN vinyl_tech_import_items items ON items.import_id = i.id
      ${whereClause}
      GROUP BY i.id, u.full_name
      ORDER BY i.created_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching vinyl tech imports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch imports' },
      { status: 500 }
    )
  }
}
