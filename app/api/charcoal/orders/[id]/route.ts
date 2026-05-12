import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const body = await request.json()
    const { customer_id, quantity, due_date, notes, status } = body

    const sets: string[] = []
    const values: any[] = []
    let idx = 1

    if (customer_id !== undefined) { sets.push(`customer_id = $${idx++}`); values.push(customer_id) }
    if (quantity !== undefined) { sets.push(`quantity = $${idx++}`); values.push(quantity) }
    if (due_date !== undefined) { sets.push(`due_date = $${idx++}`); values.push(due_date || null) }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(notes || null) }
    if (status !== undefined) { sets.push(`status = $${idx++}`); values.push(status) }
    sets.push(`updated_at = NOW()`)

    if (sets.length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(params.id)
    const result = await query(
      `UPDATE charcoal_orders SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ order: result.rows[0] })
  } catch (error) {
    console.error('Error updating charcoal order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const result = await query(`DELETE FROM charcoal_orders WHERE id = $1 RETURNING id`, [params.id])
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting charcoal order:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
