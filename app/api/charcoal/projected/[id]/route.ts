import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const body = await request.json()
    const { count, ready_date, notes } = body

    const sets: string[] = []
    const values: any[] = []
    let idx = 1

    if (count !== undefined) { sets.push(`count = $${idx++}`); values.push(count) }
    if (ready_date !== undefined) { sets.push(`ready_date = $${idx++}`); values.push(ready_date) }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(notes || null) }
    sets.push(`updated_at = NOW()`)

    if (sets.length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(params.id)
    const result = await query(
      `UPDATE charcoal_projected_skids SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Projection not found' }, { status: 404 })
    }

    return NextResponse.json({ projection: result.rows[0] })
  } catch (error) {
    console.error('Error updating charcoal projection:', error)
    return NextResponse.json({ error: 'Failed to update projection' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const result = await query(`DELETE FROM charcoal_projected_skids WHERE id = $1 RETURNING id`, [params.id])
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Projection not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting charcoal projection:', error)
    return NextResponse.json({ error: 'Failed to delete projection' }, { status: 500 })
  }
}
