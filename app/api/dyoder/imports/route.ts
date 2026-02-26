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
    } else if (status === 'hidden') {
      whereClause = "WHERE i.status = 'hidden'"
    } else {
      whereClause = "WHERE i.status IN ('active', 'completed', 'hidden')"
    }

    const result = await query(`
      SELECT
        i.id,
        i.file_name,
        i.batch_number,
        i.ship_from,
        i.ship_to_state,
        i.total_items,
        i.total_weight,
        i.status,
        i.notes,
        i.created_at,
        u.full_name as created_by_name,
        COUNT(CASE WHEN items.status = 'pending' THEN 1 END) as pending_items,
        COUNT(CASE WHEN items.status = 'converted' THEN 1 END) as converted_items,
        COUNT(CASE WHEN items.customer_matched = false THEN 1 END) as unmatched_items
      FROM dyoder_imports i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN dyoder_import_items items ON items.import_id = i.id
      ${whereClause}
      GROUP BY i.id, u.full_name
      ORDER BY i.created_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching D Yoder imports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch imports' },
      { status: 500 }
    )
  }
}
