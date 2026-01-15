import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/for-invoice - Get loads needing invoice processing
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query directly instead of using view for reliability
    const result = await query(`
      SELECT 
        l.*,
        s.name as supplier_name
      FROM lumber_loads l
      JOIN lumber_suppliers s ON l.supplier_id = s.id
      WHERE l.actual_arrival_date IS NOT NULL 
        AND COALESCE(l.is_paid, FALSE) = FALSE
      ORDER BY l.actual_arrival_date DESC
    `)

    // Fetch items and documents for each load
    for (const load of result.rows) {
      const items = await query(
        'SELECT * FROM lumber_load_items WHERE load_id = $1 ORDER BY id',
        [load.id]
      )
      const docs = await query(
        'SELECT * FROM lumber_load_documents WHERE load_id = $1 ORDER BY created_at DESC',
        [load.id]
      )
      load.items = items.rows || []
      load.documents = docs.rows || []
    }

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching invoice loads:', error)
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}
