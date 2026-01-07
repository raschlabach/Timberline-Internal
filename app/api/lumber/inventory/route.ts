import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// GET /api/lumber/inventory - Get current inventory levels
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT * FROM lumber_inventory_view
      ORDER BY thickness, species, grade
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
