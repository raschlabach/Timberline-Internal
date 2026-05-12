import { NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function POST(request: Request) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const body = await request.json()
    const { orderedIds } = body

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      for (let i = 0; i < orderedIds.length; i++) {
        await client.query(
          `UPDATE charcoal_orders SET priority = $1, updated_at = NOW() WHERE id = $2`,
          [i, orderedIds[i]]
        )
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering charcoal orders:', error)
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
  }
}
