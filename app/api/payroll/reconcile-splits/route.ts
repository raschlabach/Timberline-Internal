import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient } from '@/lib/db'

// POST /api/payroll/reconcile-splits
//
// Finds split-load entries that don't have a matching pair on another
// truckload. For each one, if the order's other half has been assigned to a
// truckload, this endpoint creates the matching pair entry there and marks
// the misc-side assignment as exclude_from_load_value.
//
// This makes "Not assigned yet" splits self-heal once the other half lands
// on someone's truckload — the user doesn't have to remember to come back.
//
// Body (optional):
// {
//   startDate?: string,   // YYYY-MM-DD - limit to splits in this date range
//   endDate?: string
// }
//
// Returns: { success: true, reconciled: number }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { startDate?: string; endDate?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Find orphaned split-load entries whose order has another assignment
    // somewhere that doesn't yet have a matching split-load entry. Pull
    // the canonical metadata from split_loads so we know the misc applies_to
    // (and full applies_to) without guessing from the existing entry.
    const orphans = await client.query(
      `SELECT
         cdfd.id,
         cdfd.truckload_id,
         cdfd.order_id,
         cdfd.split_load_id,
         cdfd.deduction,
         cdfd.is_addition,
         cdfd.applies_to,
         cdfd.action,
         cdfd.comment,
         sl.full_quote_assignment,
         sl.full_quote_applies_to,
         sl.misc_applies_to
       FROM cross_driver_freight_deductions cdfd
       LEFT JOIN split_loads sl ON sl.id = cdfd.split_load_id
       WHERE cdfd.split_load_id IS NOT NULL
         AND cdfd.order_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM cross_driver_freight_deductions other
           WHERE other.split_load_id = cdfd.split_load_id
             AND other.id != cdfd.id
         )
         AND EXISTS (
           SELECT 1 FROM truckload_order_assignments toa_other
           JOIN truckloads t ON toa_other.truckload_id = t.id
           WHERE toa_other.order_id = cdfd.order_id
             AND toa_other.truckload_id != cdfd.truckload_id
             AND COALESCE(t.status, 'active') != 'draft'
         )`
    )

    let reconciled = 0
    for (const row of orphans.rows) {
      // Find the other side's assignment.
      const otherResult = await client.query(
        `SELECT toa.id, toa.assignment_type, toa.truckload_id,
                pc.customer_name as pickup_customer,
                dc.customer_name as delivery_customer,
                u.full_name as driver_name
         FROM truckload_order_assignments toa
         JOIN truckloads t ON toa.truckload_id = t.id
         JOIN orders o ON toa.order_id = o.id
         LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
         LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
         LEFT JOIN users u ON t.driver_id = u.id
         WHERE toa.order_id = $1
           AND toa.truckload_id != $2
           AND COALESCE(t.status, 'active') != 'draft'
         ORDER BY t.start_date ASC
         LIMIT 1`,
        [row.order_id, row.truckload_id]
      )
      if (otherResult.rows.length === 0) continue
      const other = otherResult.rows[0]

      // Determine which side is which:
      // - If the existing entry is a deduction, this truckload is "main";
      //   the other one becomes "misc" → addition.
      // - If the existing entry is an addition, this truckload is "misc";
      //   the other one becomes "main" → deduction.
      const newIsAddition = !row.is_addition
      const newCustomerName =
        other.assignment_type === 'pickup'
          ? other.pickup_customer
          : other.delivery_customer
      const newAction = other.assignment_type === 'pickup' ? 'Picked up' : 'Delivered'

      // Pull the original side's customer + driver names so we can rebuild
      // descriptions in the same shape as the manual creation flow.
      const thisDriverResult = await client.query(
        `SELECT u.full_name as name FROM truckloads t
         LEFT JOIN users u ON t.driver_id = u.id
         WHERE t.id = $1`,
        [row.truckload_id]
      )
      const thisDriverName = thisDriverResult.rows[0]?.name ?? 'this driver'
      const otherDriverName = other.driver_name ?? 'other driver'

      // The existing-entry comment already describes one side. We just
      // need to write the matching one. Use the same "Split Load" idiom.
      const amountStr = parseFloat(String(row.deduction)).toFixed(2)
      const newComment = newIsAddition
        ? `*Split Load* receives $${amountStr} for ${other.assignment_type} from ${thisDriverName}`
        : `*Split Load* ${otherDriverName} receives $${amountStr} for ${other.assignment_type}`

      // Use the applies_to that was chosen when the split was created.
      // For the new (matching) entry: if it's an addition (misc side), use
      // misc_applies_to; if it's a deduction (main side), use
      // full_quote_applies_to. Falls back to the existing entry's value.
      const newAppliesTo = newIsAddition
        ? row.misc_applies_to ?? row.applies_to ?? 'driver_pay'
        : row.full_quote_applies_to ?? row.applies_to ?? 'driver_pay'

      await client.query(
        `INSERT INTO cross_driver_freight_deductions (
           truckload_id, order_id, deduction, is_manual, comment,
           is_addition, applies_to, customer_name, action,
           split_load_id, date
         ) VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, CURRENT_DATE)`,
        [
          other.truckload_id,
          row.order_id,
          row.deduction,
          newComment,
          newIsAddition,
          newAppliesTo,
          newCustomerName,
          newAction,
          row.split_load_id,
        ]
      )

      // If this is the misc side (addition), mark the misc assignment so
      // its quote is excluded from load value totals.
      if (newIsAddition) {
        await client.query(
          `UPDATE truckload_order_assignments
           SET exclude_from_load_value = true
           WHERE id = $1`,
          [other.id]
        )
      } else {
        // The existing entry is on the misc side; its assignment should
        // have its quote excluded.
        await client.query(
          `UPDATE truckload_order_assignments
           SET exclude_from_load_value = true
           WHERE truckload_id = $1 AND order_id = $2`,
          [row.truckload_id, row.order_id]
        )
      }

      reconciled += 1
    }

    await client.query('COMMIT')
    return NextResponse.json({ success: true, reconciled })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error reconciling splits:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reconcile splits' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
