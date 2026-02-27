import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/paid - Get paid loads with search and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    const conditions: string[] = [
      'l.is_paid = TRUE',
      'l.actual_arrival_date IS NOT NULL',
    ]
    const values: (string | number)[] = []
    let paramIndex = 1

    if (search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`
      conditions.push(`(
        LOWER(l.load_id) LIKE $${paramIndex}
        OR LOWER(s.name) LIKE $${paramIndex}
        OR LOWER(l.invoice_number) LIKE $${paramIndex}
        OR CAST(l.invoice_total AS TEXT) LIKE $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM lumber_load_items li
          WHERE li.load_id = l.id
          AND LOWER(li.species) LIKE $${paramIndex}
        )
      )`)
      values.push(searchTerm)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM lumber_loads l
       JOIN lumber_suppliers s ON l.supplier_id = s.id
       WHERE ${whereClause}`,
      values
    )
    const total = parseInt(countResult.rows[0].total)

    const loadsResult = await query(
      `SELECT 
        l.*,
        s.name as supplier_name
       FROM lumber_loads l
       JOIN lumber_suppliers s ON l.supplier_id = s.id
       WHERE ${whereClause}
       ORDER BY l.updated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    )

    const loadIds = loadsResult.rows.map((r: any) => r.id)

    if (loadIds.length > 0) {
      const placeholders = loadIds.map((_: any, i: number) => `$${i + 1}`).join(',')

      const [itemsResult, docsResult] = await Promise.all([
        query(
          `SELECT * FROM lumber_load_items WHERE load_id IN (${placeholders}) ORDER BY id`,
          loadIds
        ),
        query(
          `SELECT * FROM lumber_load_documents WHERE load_id IN (${placeholders}) ORDER BY created_at DESC`,
          loadIds
        ),
      ])

      const itemsByLoad = new Map<number, any[]>()
      const docsByLoad = new Map<number, any[]>()

      for (const item of itemsResult.rows) {
        const arr = itemsByLoad.get(item.load_id) || []
        arr.push(item)
        itemsByLoad.set(item.load_id, arr)
      }
      for (const doc of docsResult.rows) {
        const arr = docsByLoad.get(doc.load_id) || []
        arr.push(doc)
        docsByLoad.set(doc.load_id, arr)
      }

      for (const load of loadsResult.rows) {
        load.items = itemsByLoad.get(load.id) || []
        load.documents = docsByLoad.get(load.id) || []
      }
    } else {
      for (const load of loadsResult.rows) {
        load.items = []
        load.documents = []
      }
    }

    return NextResponse.json({
      loads: loadsResult.rows,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching paid loads:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
