import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = parseInt(params.id)
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // 1. Mark all skids and vinyl as picked up (if not already) and delivered
      await client.query(
        `UPDATE skids 
         SET is_picked_up = true,
             is_delivered = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [orderId]
      )

      await client.query(
        `UPDATE vinyl 
         SET is_picked_up = true,
             is_delivered = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [orderId]
      )

      // 2. Mark the order as completed (this removes it from the load board)
      await client.query(
        `UPDATE orders 
         SET status = 'completed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Order marked as delivered successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error marking order as delivered:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to mark order as delivered'
    }, { status: 500 })
  }
}

