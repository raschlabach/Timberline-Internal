import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function POST(request: Request) {
  try {
    const { role, userId } = await getCharcoalSession()
    if (!userId) return unauthorized()
    if (role !== 'office') return forbidden()

    const body = await request.json()
    const { count, ready_date, notes } = body

    if (!count || count < 1 || !ready_date) {
      return NextResponse.json({ error: 'count (min 1) and ready_date are required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO charcoal_projected_skids (count, ready_date, notes, created_by_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [count, ready_date, notes || null, userId]
    )

    return NextResponse.json({ projection: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating charcoal projection:', error)
    return NextResponse.json({ error: 'Failed to create projection' }, { status: 500 })
  }
}
