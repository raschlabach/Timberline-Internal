import { NextResponse } from 'next/server'
import { query, withTransaction } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function POST(request: Request) {
  try {
    const { role, userId } = await getCharcoalSession()
    if (!userId) return unauthorized()
    if (!role) return forbidden()
    if (role !== 'office' && role !== 'shipping_station') return forbidden()

    const body = await request.json()
    const { is_walnut_creek, notes, wrapped_at } = body

    const skid = await withTransaction(async (client) => {
      const skidResult = await client.query(
        `INSERT INTO charcoal_skids (wrapped_by_id, is_walnut_creek, notes, wrapped_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, is_walnut_creek ?? false, notes || null, wrapped_at || new Date().toISOString()]
      )
      const newSkid = skidResult.rows[0]

      // Auto-decrement oldest projection (projections are type-agnostic, raw charcoal)
      const projResult = await client.query(
        `SELECT id, count FROM charcoal_projected_skids
         WHERE count > 0
         ORDER BY ready_date ASC, created_at ASC
         LIMIT 1`
      )

      if (projResult.rows.length > 0) {
        const proj = projResult.rows[0]
        if (proj.count > 1) {
          await client.query(
            `UPDATE charcoal_projected_skids SET count = count - 1, updated_at = NOW() WHERE id = $1`,
            [proj.id]
          )
        } else {
          await client.query(`DELETE FROM charcoal_projected_skids WHERE id = $1`, [proj.id])
        }
      }
      // No matching projection → no-op; skid still created

      return newSkid
    })

    return NextResponse.json({ skid }, { status: 201 })
  } catch (error) {
    console.error('Error creating charcoal skid:', error)
    return NextResponse.json({ error: 'Failed to create skid' }, { status: 500 })
  }
}
