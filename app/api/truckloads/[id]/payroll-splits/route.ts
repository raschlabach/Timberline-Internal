import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient } from '@/lib/db'

// POST /api/truckloads/[id]/payroll-splits
//
// Creates a split-load pair atomically.
//
// Body:
// {
//   orderId: number,
//   miscAmount: number,         // positive dollars moving between drivers
//   mainRole: 'pickup' | 'delivery',  // which side is the "main" (full quote − misc)
//   mainAppliesTo: 'load_value' | 'driver_pay',
//   miscAppliesTo: 'load_value' | 'driver_pay',
// }
//
// The "other half" truckload is determined automatically from the order's
// other assignment. The dispatcher does NOT pick a truckload manually:
// - If the order's other assignment exists on another truckload, both
//   entries are created and the misc-side assignment gets its quote
//   excluded.
// - If the order's other assignment doesn't exist yet (delay case), only
//   the THIS-side entry is created; the auto-reconcile step on the
//   payroll page creates the pair when that assignment is later made.

interface CreateSplitBody {
  orderId: number
  miscAmount: number
  mainRole: 'pickup' | 'delivery'
  mainAppliesTo: 'load_value' | 'driver_pay'
  miscAppliesTo: 'load_value' | 'driver_pay'
}

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

  let body: CreateSplitBody
  try {
    body = (await request.json()) as CreateSplitBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateBody(body)
  if (validation) {
    return NextResponse.json({ success: false, error: validation }, { status: 400 })
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Make sure the assignments table has the columns we need (defensive
    // for older environments).
    await client.query(
      `ALTER TABLE truckload_order_assignments
       ADD COLUMN IF NOT EXISTS exclude_from_load_value BOOLEAN DEFAULT FALSE`
    )

    // Reject if a split already exists for this order. Each order is
    // limited to one active split.
    const existingSplit = await client.query(
      `SELECT id FROM split_loads WHERE order_id = $1 LIMIT 1`,
      [body.orderId]
    )
    if (existingSplit.rows.length > 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        {
          success: false,
          error: 'This order already has a split load. Edit or remove it first.',
        },
        { status: 409 }
      )
    }

    // Find this truckload's assignment for this order.
    const thisAssignmentResult = await client.query(
      `SELECT id, assignment_type
       FROM truckload_order_assignments
       WHERE truckload_id = $1 AND order_id = $2
       LIMIT 1`,
      [truckloadId, body.orderId]
    )
    if (thisAssignmentResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'This order is not on this truckload' },
        { status: 400 }
      )
    }
    const thisAssignmentType = thisAssignmentResult.rows[0].assignment_type as
      | 'pickup'
      | 'delivery'
    const thisAssignmentId = thisAssignmentResult.rows[0].id as number

    // Look up customer + driver names for the other side (used in description).
    const orderInfo = await client.query(
      `SELECT
         pc.customer_name as pickup_customer,
         dc.customer_name as delivery_customer
       FROM orders o
       LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
       LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
       WHERE o.id = $1`,
      [body.orderId]
    )
    const pickupCustomerName = orderInfo.rows[0]?.pickup_customer ?? null
    const deliveryCustomerName = orderInfo.rows[0]?.delivery_customer ?? null

    // Auto-detect the OTHER assignment for this order. There's no manual
    // truckload selection — whatever truckload happens to have the other
    // half is the one that gets the matching entry.
    const miscRole = body.mainRole === 'pickup' ? 'delivery' : 'pickup'
    const otherAssignmentResult = await client.query(
      `SELECT toa.id, toa.assignment_type, toa.truckload_id
       FROM truckload_order_assignments toa
       JOIN truckloads t ON toa.truckload_id = t.id
       WHERE toa.order_id = $1
         AND toa.truckload_id != $2
         AND COALESCE(t.status, 'active') != 'draft'
       ORDER BY t.start_date ASC
       LIMIT 1`,
      [body.orderId, truckloadId]
    )
    const otherAssignment = otherAssignmentResult.rows[0] || null

    let mainTruckloadDriverName: string | null = null
    let miscTruckloadDriverName: string | null = null
    let miscAssignmentId: number | null = null
    let miscTruckloadId: number | null = null
    let mainTruckloadId: number

    const thisIsMain = thisAssignmentType === body.mainRole
    if (thisIsMain) {
      mainTruckloadId = truckloadId
      // If the misc side exists, use it. Otherwise it's a delay — leave null.
      miscTruckloadId = otherAssignment?.truckload_id ?? null
      miscAssignmentId = otherAssignment?.id ?? null
    } else {
      // User is on the misc side. Their assignment is the misc one.
      miscTruckloadId = truckloadId
      miscAssignmentId = thisAssignmentId
      // The main side is the OTHER assignment (must exist for this case to
      // make sense; if not, fall back to creating only THIS side).
      mainTruckloadId = otherAssignment?.truckload_id ?? truckloadId
    }

    // Look up the main truckload's driver name.
    const mainDriver = await client.query(
      `SELECT u.full_name as name FROM truckloads t
       LEFT JOIN users u ON t.driver_id = u.id
       WHERE t.id = $1`,
      [mainTruckloadId]
    )
    mainTruckloadDriverName = mainDriver.rows[0]?.name ?? null

    if (miscTruckloadId !== null && miscTruckloadId !== undefined) {
      const miscDriver = await client.query(
        `SELECT u.full_name as name FROM truckloads t
         LEFT JOIN users u ON t.driver_id = u.id
         WHERE t.id = $1`,
        [miscTruckloadId]
      )
      miscTruckloadDriverName = miscDriver.rows[0]?.name ?? null
    }

    // Create the split_loads row first — cross_driver_freight_deductions's
    // split_load_id is a FK to it. The split_loads row stores the
    // canonical metadata for the split (which side is main, applies-tos).
    const splitLoadInsert = await client.query(
      `INSERT INTO split_loads (
         order_id, misc_value, full_quote_assignment,
         full_quote_applies_to, misc_applies_to
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        body.orderId,
        body.miscAmount,
        body.mainRole,
        body.mainAppliesTo,
        body.miscAppliesTo,
      ]
    )
    const splitLoadId = Number(splitLoadInsert.rows[0].id)

    // Build descriptions.
    const miscRoleLabel = body.mainRole === 'pickup' ? 'delivery' : 'pickup'
    const mainSideCustomer =
      body.mainRole === 'pickup' ? pickupCustomerName : deliveryCustomerName
    const miscSideCustomer =
      body.mainRole === 'pickup' ? deliveryCustomerName : pickupCustomerName

    const mainSideDescription = `*Split Load* ${
      miscTruckloadDriverName || 'Unassigned driver'
    } receives $${body.miscAmount.toFixed(2)} for ${miscRoleLabel}`
    const miscSideDescription = `*Split Load* receives $${body.miscAmount.toFixed(
      2
    )} for ${miscRoleLabel} from ${mainTruckloadDriverName || 'main driver'}`

    // INSERT the main side (deduction).
    const mainCustomerName = mainSideCustomer
    const mainInsert = await client.query(
      `INSERT INTO cross_driver_freight_deductions (
         truckload_id, order_id, deduction, is_manual, comment,
         is_addition, applies_to, customer_name, action,
         split_load_id, date
       ) VALUES ($1, $2, $3, true, $4, false, $5, $6, $7, $8, CURRENT_DATE)
       RETURNING id, order_id, deduction, comment, is_addition, applies_to, customer_name, action,
         split_load_id, TO_CHAR(date, 'YYYY-MM-DD') as date`,
      [
        mainTruckloadId,
        body.orderId,
        body.miscAmount,
        mainSideDescription,
        body.mainAppliesTo,
        mainCustomerName,
        body.mainRole === 'pickup' ? 'Picked up' : 'Delivered',
        splitLoadId,
      ]
    )

    let miscRow: any = null
    // INSERT the misc side (addition) only when we know its truckload.
    if (miscTruckloadId !== null && miscTruckloadId !== mainTruckloadId) {
      const miscInsert = await client.query(
        `INSERT INTO cross_driver_freight_deductions (
           truckload_id, order_id, deduction, is_manual, comment,
           is_addition, applies_to, customer_name, action,
           split_load_id, date
         ) VALUES ($1, $2, $3, true, $4, true, $5, $6, $7, $8, CURRENT_DATE)
         RETURNING id, order_id, deduction, comment, is_addition, applies_to, customer_name, action,
           split_load_id, TO_CHAR(date, 'YYYY-MM-DD') as date`,
        [
          miscTruckloadId,
          body.orderId,
          body.miscAmount,
          miscSideDescription,
          body.miscAppliesTo,
          miscSideCustomer,
          miscRoleLabel === 'pickup' ? 'Picked up' : 'Delivered',
          splitLoadId,
        ]
      )
      miscRow = miscInsert.rows[0]

      // Mark the misc-side assignment so its quote is excluded from load
      // value totals.
      if (miscAssignmentId !== null) {
        await client.query(
          `UPDATE truckload_order_assignments
           SET exclude_from_load_value = true
           WHERE id = $1`,
          [miscAssignmentId]
        )
      }
    }

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      splitLoadId,
      main: shapeAdjustment(mainInsert.rows[0]),
      misc: miscRow ? shapeAdjustment(miscRow) : null,
      mainTruckloadId,
      miscTruckloadId,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating split load:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create split load',
      },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}

function shapeAdjustment(row: any) {
  return {
    id: row.id,
    orderId: row.order_id,
    amount: parseFloat(String(row.deduction)),
    comment: row.comment,
    isAddition: row.is_addition,
    appliesTo: row.applies_to,
    customerName: row.customer_name,
    action: row.action,
    splitLoadId: row.split_load_id,
    date: row.date,
  }
}

function validateBody(input: CreateSplitBody): string | null {
  if (typeof input.orderId !== 'number' || !Number.isFinite(input.orderId)) {
    return 'orderId must be a number'
  }
  if (typeof input.miscAmount !== 'number' || !Number.isFinite(input.miscAmount) || input.miscAmount <= 0) {
    return 'miscAmount must be a positive number'
  }
  if (input.mainRole !== 'pickup' && input.mainRole !== 'delivery') {
    return 'mainRole must be pickup or delivery'
  }
  if (input.mainAppliesTo !== 'load_value' && input.mainAppliesTo !== 'driver_pay') {
    return 'mainAppliesTo must be load_value or driver_pay'
  }
  if (input.miscAppliesTo !== 'load_value' && input.miscAppliesTo !== 'driver_pay') {
    return 'miscAppliesTo must be load_value or driver_pay'
  }
  return null
}
