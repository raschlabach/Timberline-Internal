import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/po-needed - Get loads needing PO generation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT * FROM lumber_loads_needing_pos
    `)

    // Fetch items for each load
    for (const load of result.rows) {
      const items = await query(
        'SELECT * FROM lumber_load_items WHERE load_id = $1 ORDER BY id',
        [load.id]
      )
      load.items = items.rows
      load.documents = []
    }

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching loads needing POs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
