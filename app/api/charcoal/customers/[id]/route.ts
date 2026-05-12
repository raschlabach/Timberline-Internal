import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const body = await request.json()
    const { name, contact_name, phone, email, notes, is_walnut_creek } = body

    const sets: string[] = []
    const values: any[] = []
    let idx = 1

    if (name !== undefined) { sets.push(`name = $${idx++}`); values.push(name) }
    if (contact_name !== undefined) { sets.push(`contact_name = $${idx++}`); values.push(contact_name || null) }
    if (phone !== undefined) { sets.push(`phone = $${idx++}`); values.push(phone || null) }
    if (email !== undefined) { sets.push(`email = $${idx++}`); values.push(email || null) }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(notes || null) }
    if (is_walnut_creek !== undefined) { sets.push(`is_walnut_creek = $${idx++}`); values.push(is_walnut_creek) }
    sets.push(`updated_at = NOW()`)

    if (sets.length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(params.id)
    const result = await query(
      `UPDATE charcoal_customers SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ customer: result.rows[0] })
  } catch (error) {
    console.error('Error updating charcoal customer:', error)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const orderCheck = await query(
      `SELECT COUNT(*)::int AS count FROM charcoal_orders WHERE customer_id = $1`,
      [params.id]
    )
    if (orderCheck.rows[0].count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete customer with existing orders. Delete orders first.' },
        { status: 400 }
      )
    }

    const result = await query(`DELETE FROM charcoal_customers WHERE id = $1 RETURNING id`, [params.id])
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting charcoal customer:', error)
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
