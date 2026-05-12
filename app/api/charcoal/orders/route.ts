import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function POST(request: Request) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const body = await request.json()
    const { customer_id, quantity, due_date, notes } = body

    if (!customer_id || !quantity || quantity < 1) {
      return NextResponse.json({ error: 'customer_id and quantity (min 1) are required' }, { status: 400 })
    }

    const maxResult = await query(
      `SELECT COALESCE(MAX(priority), -1) + 1 AS next_priority FROM charcoal_orders WHERE status = 'open'`
    )
    const nextPriority = maxResult.rows[0].next_priority

    const result = await query(
      `INSERT INTO charcoal_orders (customer_id, quantity, due_date, notes, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [customer_id, quantity, due_date || null, notes || null, nextPriority]
    )

    return NextResponse.json({ order: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating charcoal order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
