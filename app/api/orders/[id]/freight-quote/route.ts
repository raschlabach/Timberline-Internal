import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/orders/[id]/freight-quote
//
// Updates only the freight_quote on a single order. Used by the payroll
// page when editing the inline quote. Other order fields are not affected.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const orderId = parseInt(params.id, 10)
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { freightQuote } = body
  if (
    freightQuote !== null &&
    (typeof freightQuote !== 'number' || !Number.isFinite(freightQuote) || freightQuote < 0)
  ) {
    return NextResponse.json(
      { success: false, error: 'freightQuote must be null or a non-negative number' },
      { status: 400 }
    )
  }

  const result = await query(
    `UPDATE orders
     SET freight_quote = $1,
         updated_at = NOW(),
         last_edited_by = $2,
         last_edited_at = NOW()
     WHERE id = $3
     RETURNING id, freight_quote`,
    [freightQuote, session.user.id, orderId]
  )

  if (result.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Order not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    freightQuote:
      result.rows[0].freight_quote !== null
        ? parseFloat(String(result.rows[0].freight_quote))
        : null,
  })
}
