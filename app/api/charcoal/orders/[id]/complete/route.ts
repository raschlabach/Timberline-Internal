import { NextResponse } from 'next/server'
import { withTransaction } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const result = await withTransaction(async (client) => {
      const orderResult = await client.query(
        `SELECT o.id, o.quantity, o.status, c.is_walnut_creek
         FROM charcoal_orders o
         JOIN charcoal_customers c ON c.id = o.customer_id
         WHERE o.id = $1`,
        [params.id]
      )

      if (orderResult.rows.length === 0) {
        throw new Error('NOT_FOUND')
      }

      const order = orderResult.rows[0]

      if (order.status === 'completed') {
        throw new Error('ALREADY_COMPLETED')
      }

      // Delete the oldest N skids of the matching type (FIFO)
      const skidsResult = await client.query(
        `DELETE FROM charcoal_skids
         WHERE id IN (
           SELECT id FROM charcoal_skids
           WHERE is_walnut_creek = $1
           ORDER BY wrapped_at ASC
           LIMIT $2
         )
         RETURNING id`,
        [order.is_walnut_creek, order.quantity]
      )

      await client.query(
        `UPDATE charcoal_orders SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [params.id]
      )

      return {
        orderId: params.id,
        skidsRemoved: skidsResult.rowCount ?? 0,
        quantityOrdered: order.quantity,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (error.message === 'ALREADY_COMPLETED') {
      return NextResponse.json({ error: 'Order is already completed' }, { status: 400 })
    }
    console.error('Error completing charcoal order:', error)
    return NextResponse.json({ error: 'Failed to complete order' }, { status: 500 })
  }
}
