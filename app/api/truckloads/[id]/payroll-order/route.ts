import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH /api/truckloads/[id]/payroll-order
//
// Updates the payroll-only display order for a truckload's orders.
// This does NOT change the dispatch sequence_number; only payroll_sequence
// is updated. The first item in assignmentIds gets payroll_sequence = 1, etc.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const truckloadId = parseInt(params.id, 10)
  if (Number.isNaN(truckloadId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid truckload ID' },
      { status: 400 }
    )
  }

  let body: { assignmentIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { assignmentIds } = body
  if (!Array.isArray(assignmentIds) || assignmentIds.some((id) => typeof id !== 'number')) {
    return NextResponse.json(
      { success: false, error: 'assignmentIds must be an array of numbers' },
      { status: 400 }
    )
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Make sure the column exists. If a deployment hasn't run the migration
    // yet, create it on the fly so the request still succeeds.
    await client.query(
      `ALTER TABLE truckload_order_assignments
       ADD COLUMN IF NOT EXISTS payroll_sequence INTEGER`
    )

    // Verify all submitted assignments belong to this truckload before
    // touching anything.
    const verify = await client.query(
      `SELECT id FROM truckload_order_assignments
       WHERE truckload_id = $1 AND id = ANY($2::int[])`,
      [truckloadId, assignmentIds]
    )
    if (verify.rows.length !== assignmentIds.length) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        {
          success: false,
          error: 'One or more assignments do not belong to this truckload',
        },
        { status: 400 }
      )
    }

    // Apply the new payroll order. Position 1 = first.
    for (let i = 0; i < assignmentIds.length; i += 1) {
      await client.query(
        `UPDATE truckload_order_assignments
         SET payroll_sequence = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND truckload_id = $3`,
        [i + 1, assignmentIds[i], truckloadId]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error saving payroll order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save payroll order' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
