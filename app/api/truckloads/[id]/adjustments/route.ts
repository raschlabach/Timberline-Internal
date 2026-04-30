import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient } from '@/lib/db'

// POST /api/truckloads/[id]/adjustments
//
// Creates a single payroll-page adjustment (manual addition or deduction).
// Adjustments are stored in cross_driver_freight_deductions.
//
// Body:
//   {
//     orderId: number | null,    // null for load-level
//     isAddition: boolean,       // true = green +, false = red −
//     amount: number,            // positive dollar amount
//     appliesTo: 'load_value' | 'driver_pay',
//     comment: string            // user-entered description
//   }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const truckloadId = parseInt(params.id, 10)
  if (Number.isNaN(truckloadId)) {
    return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { orderId, isAddition, amount, appliesTo, comment, action } = body
  const errors = validateBody({ isAddition, amount, appliesTo, comment, orderId, action })
  if (errors) {
    return NextResponse.json({ success: false, error: errors }, { status: 400 })
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // If an order was specified, look up the customer name (for legacy
    // display purposes) so the row stays consistent with how older entries
    // are stored.
    let customerName: string | null = null
    if (orderId !== null && orderId !== undefined) {
      const customerResult = await client.query(
        `SELECT
            CASE WHEN toa.assignment_type = 'pickup' THEN pc.customer_name ELSE dc.customer_name END as name
          FROM truckload_order_assignments toa
          JOIN orders o ON toa.order_id = o.id
          LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
          LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
          WHERE toa.truckload_id = $1 AND toa.order_id = $2
          LIMIT 1`,
        [truckloadId, orderId]
      )
      customerName = customerResult.rows[0]?.name || null
    }

    const insert = await client.query(
      `INSERT INTO cross_driver_freight_deductions (
        truckload_id, order_id, deduction, is_manual, comment,
        is_addition, applies_to, customer_name, action, date
      ) VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, CURRENT_DATE)
      RETURNING id, order_id, deduction, comment, is_addition, applies_to, customer_name, action, COALESCE(excluded_from_qb, false) as excluded_from_qb, TO_CHAR(date, 'YYYY-MM-DD') as date`,
      [
        truckloadId,
        orderId ?? null,
        amount,
        comment,
        isAddition,
        appliesTo,
        customerName,
        action ?? null,
      ]
    )

    await client.query('COMMIT')

    const row = insert.rows[0]
    return NextResponse.json({
      success: true,
      adjustment: {
        id: row.id,
        orderId: row.order_id,
        amount: parseFloat(String(row.deduction)),
        comment: row.comment,
        isAddition: row.is_addition,
        appliesTo: row.applies_to,
        customerName: row.customer_name,
        action: row.action,
        excludedFromQb: row.excluded_from_qb,
        date: row.date,
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating adjustment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create adjustment' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}

function validateBody(input: {
  isAddition: unknown
  amount: unknown
  appliesTo: unknown
  comment: unknown
  orderId: unknown
  action: unknown
}): string | null {
  if (typeof input.isAddition !== 'boolean') {
    return 'isAddition must be a boolean'
  }
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount < 0) {
    return 'amount must be a non-negative number'
  }
  if (input.appliesTo !== 'load_value' && input.appliesTo !== 'driver_pay') {
    return "appliesTo must be 'load_value' or 'driver_pay'"
  }
  if (typeof input.comment !== 'string' || input.comment.trim() === '') {
    return 'comment is required'
  }
  if (
    input.orderId !== null &&
    input.orderId !== undefined &&
    (typeof input.orderId !== 'number' || !Number.isFinite(input.orderId))
  ) {
    return 'orderId must be a number or null'
  }
  if (
    input.action !== null &&
    input.action !== undefined &&
    typeof input.action !== 'string'
  ) {
    return 'action must be a string or null'
  }
  return null
}
