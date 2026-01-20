import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/misc-orders - Get all misc rip orders
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeComplete = searchParams.get('include_complete') === 'true'

    let sql = `
      SELECT 
        mo.*,
        COUNT(mp.id) as pack_count,
        COUNT(CASE WHEN mp.is_finished THEN 1 END) as finished_pack_count,
        COALESCE(SUM(CASE WHEN mp.is_finished THEN mp.actual_board_feet ELSE 0 END), 0) as total_finished_bf
      FROM misc_rip_orders mo
      LEFT JOIN misc_rip_packs mp ON mo.id = mp.misc_order_id
    `

    if (!includeComplete) {
      sql += ` WHERE mo.is_complete = FALSE`
    }

    sql += ` GROUP BY mo.id ORDER BY mo.created_at DESC`

    const result = await query(sql)
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching misc orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/misc-orders - Create a new misc rip order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customer_name, species, grade, thickness, estimated_footage, notes } = body

    if (!customer_name || !species || !grade) {
      return NextResponse.json({ error: 'Customer, species, and grade are required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO misc_rip_orders (customer_name, species, grade, thickness, estimated_footage, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [customer_name, species, grade, thickness || '4/4', estimated_footage || null, notes || null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating misc order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
