import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office' && role !== 'shipping_station') return forbidden()

    const body = await request.json()
    const { is_walnut_creek, notes, wrapped_at } = body

    const sets: string[] = []
    const values: any[] = []
    let idx = 1

    if (is_walnut_creek !== undefined) { sets.push(`is_walnut_creek = $${idx++}`); values.push(is_walnut_creek) }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(notes || null) }
    if (wrapped_at !== undefined) { sets.push(`wrapped_at = $${idx++}`); values.push(wrapped_at) }
    sets.push(`updated_at = NOW()`)

    if (sets.length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(params.id)
    const result = await query(
      `UPDATE charcoal_skids SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Skid not found' }, { status: 404 })
    }

    return NextResponse.json({ skid: result.rows[0] })
  } catch (error) {
    console.error('Error updating charcoal skid:', error)
    return NextResponse.json({ error: 'Failed to update skid' }, { status: 500 })
  }
}

// Deleting a skid does NOT restore a projection — office can manually re-add if mis-entered
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office' && role !== 'shipping_station') return forbidden()

    const result = await query(`DELETE FROM charcoal_skids WHERE id = $1 RETURNING id`, [params.id])
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Skid not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting charcoal skid:', error)
    return NextResponse.json({ error: 'Failed to delete skid' }, { status: 500 })
  }
}
