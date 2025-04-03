import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
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

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    const body = await request.json()
    const { orders } = body

    if (!Array.isArray(orders)) {
      return NextResponse.json({ success: false, error: 'Invalid orders data' }, { status: 400 })
    }

    // Update each order's sequence number
    for (const order of orders) {
      await query(
        `UPDATE truckload_order_assignments 
         SET sequence_number = $1 
         WHERE truckload_id = $2 AND order_id = $3`,
        [order.sequence_number, truckloadId, order.id]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering truckload stops:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to reorder stops'
    }, { status: 500 })
  }
} 