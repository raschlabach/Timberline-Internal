import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { itemId, customerId } = body as {
      itemId: number
      customerId: number
    }

    if (!itemId || !customerId) {
      return NextResponse.json(
        { error: 'Item ID and customer ID are required' },
        { status: 400 }
      )
    }

    await query(
      `UPDATE vinyl_tech_import_items
       SET matched_customer_id = $1,
           customer_matched = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [customerId, itemId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error matching customer:', error)
    return NextResponse.json(
      { error: 'Failed to match customer' },
      { status: 500 }
    )
  }
}
