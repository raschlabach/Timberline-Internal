import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT o.id, o.customer, o.po_number, o.is_done,
              o.created_at, o.updated_at,
              COUNT(s.id)::int AS skid_count
       FROM freight_orders o
       LEFT JOIN freight_order_skids s ON s.order_id = o.id
       GROUP BY o.id
       ORDER BY o.is_done ASC, o.updated_at DESC`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching freight orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const result = await query(
      `INSERT INTO freight_orders (customer, po_number, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, customer, po_number, is_done, created_at, updated_at`,
      [body.customer || '', body.po_number || null, (session.user as unknown as { id?: number }).id || null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating freight order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
