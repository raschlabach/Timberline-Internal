import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, query } from '@/lib/db'

// PATCH /api/truckloads/[id]/adjustments/[adjustmentId]
//
// Updates a manual adjustment. Only manual rows can be edited via this
// endpoint; auto-generated split-load entries are managed elsewhere.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; adjustmentId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const truckloadId = parseInt(params.id, 10)
  const adjustmentId = parseInt(params.adjustmentId, 10)
  if (Number.isNaN(truckloadId) || Number.isNaN(adjustmentId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid IDs' },
      { status: 400 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { isAddition, amount, appliesTo, comment, orderId, excludedFromQb } = body

  // Verify the adjustment belongs to this truckload.
  const existing = await query(
    `SELECT id, is_manual, split_load_id
     FROM cross_driver_freight_deductions
     WHERE id = $1 AND truckload_id = $2`,
    [adjustmentId, truckloadId]
  )
  if (existing.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Adjustment not found' },
      { status: 404 }
    )
  }

  // The QB-exclusion flag is a metadata toggle that admins can flip on
  // ANY adjustment row, including system-generated split-load entries —
  // it doesn't change the row's content. So we only enforce the
  // "manual-only / non-split" guard when a CONTENT field is being
  // edited (amount/comment/etc).
  const editsContent =
    isAddition !== undefined ||
    amount !== undefined ||
    appliesTo !== undefined ||
    comment !== undefined ||
    orderId !== undefined

  if (editsContent) {
    if (!existing.rows[0].is_manual) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot edit non-manual adjustment',
        },
        { status: 400 }
      )
    }
    if (existing.rows[0].split_load_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot edit split-load adjustment from this endpoint',
        },
        { status: 400 }
      )
    }
  }

  // Build dynamic SET clause from supplied fields only.
  const sets: string[] = []
  const values: any[] = []

  if (isAddition !== undefined) {
    if (typeof isAddition !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isAddition must be boolean' },
        { status: 400 }
      )
    }
    values.push(isAddition)
    sets.push(`is_addition = $${values.length}`)
  }
  if (amount !== undefined) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a non-negative number' },
        { status: 400 }
      )
    }
    values.push(amount)
    sets.push(`deduction = $${values.length}`)
  }
  if (appliesTo !== undefined) {
    if (appliesTo !== 'load_value' && appliesTo !== 'driver_pay') {
      return NextResponse.json(
        { success: false, error: "appliesTo must be 'load_value' or 'driver_pay'" },
        { status: 400 }
      )
    }
    values.push(appliesTo)
    sets.push(`applies_to = $${values.length}`)
  }
  if (comment !== undefined) {
    if (typeof comment !== 'string') {
      return NextResponse.json(
        { success: false, error: 'comment must be a string' },
        { status: 400 }
      )
    }
    values.push(comment)
    sets.push(`comment = $${values.length}`)
  }
  if (orderId !== undefined) {
    if (
      orderId !== null &&
      (typeof orderId !== 'number' || !Number.isFinite(orderId))
    ) {
      return NextResponse.json(
        { success: false, error: 'orderId must be a number or null' },
        { status: 400 }
      )
    }
    values.push(orderId)
    sets.push(`order_id = $${values.length}`)
  }
  if (excludedFromQb !== undefined) {
    if (typeof excludedFromQb !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'excludedFromQb must be boolean' },
        { status: 400 }
      )
    }
    values.push(excludedFromQb)
    sets.push(`excluded_from_qb = $${values.length}`)
  }

  if (sets.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No fields to update' },
      { status: 400 }
    )
  }

  values.push(adjustmentId)
  const idParam = values.length
  values.push(truckloadId)
  const tlParam = values.length

  const client = await getClient()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `UPDATE cross_driver_freight_deductions
       SET ${sets.join(', ')}
       WHERE id = $${idParam} AND truckload_id = $${tlParam}
       RETURNING id, order_id, deduction, comment, is_addition, applies_to, customer_name, COALESCE(excluded_from_qb, false) as excluded_from_qb, TO_CHAR(date, 'YYYY-MM-DD') as date`,
      values
    )
    await client.query('COMMIT')

    const row = result.rows[0]
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
        excludedFromQb: row.excluded_from_qb,
        date: row.date,
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating adjustment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update adjustment' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}

// DELETE /api/truckloads/[id]/adjustments/[adjustmentId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; adjustmentId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const truckloadId = parseInt(params.id, 10)
  const adjustmentId = parseInt(params.adjustmentId, 10)
  if (Number.isNaN(truckloadId) || Number.isNaN(adjustmentId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid IDs' },
      { status: 400 }
    )
  }

  // Only manual, non-split-load rows can be deleted.
  const existing = await query(
    `SELECT id, is_manual, split_load_id
     FROM cross_driver_freight_deductions
     WHERE id = $1 AND truckload_id = $2`,
    [adjustmentId, truckloadId]
  )
  if (existing.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Adjustment not found' },
      { status: 404 }
    )
  }
  if (!existing.rows[0].is_manual) {
    return NextResponse.json(
      { success: false, error: 'Cannot delete non-manual adjustment' },
      { status: 400 }
    )
  }
  if (existing.rows[0].split_load_id) {
    return NextResponse.json(
      { success: false, error: 'Cannot delete split-load adjustment from this endpoint' },
      { status: 400 }
    )
  }

  await query(
    `DELETE FROM cross_driver_freight_deductions
     WHERE id = $1 AND truckload_id = $2`,
    [adjustmentId, truckloadId]
  )

  return NextResponse.json({ success: true })
}
