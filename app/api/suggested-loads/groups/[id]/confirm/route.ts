import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const groupId = parseInt(params.id)
    if (isNaN(groupId)) {
      return NextResponse.json({ success: false, error: 'Invalid group ID' }, { status: 400 })
    }

    const body = await request.json()
    const { orderIds, driverId, startDate, endDate, trailerNumber = '' } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one order ID is required' }, { status: 400 })
    }

    if (!startDate) {
      return NextResponse.json({ success: false, error: 'Start date is required' }, { status: 400 })
    }

    const groupResult = await query(
      'SELECT name, preferred_driver_id FROM load_suggestion_groups WHERE id = $1',
      [groupId]
    )
    if (groupResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 })
    }

    const group = groupResult.rows[0]
    const finalDriverId = driverId || group.preferred_driver_id

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const bolResult = await client.query(`
        SELECT COALESCE(MAX(CAST(bill_of_lading_number AS INTEGER)), 0) + 1 as next_bol
        FROM truckloads
        WHERE bill_of_lading_number ~ '^[0-9]+$'
      `)
      const nextBol = bolResult.rows[0].next_bol.toString()

      const truckloadResult = await client.query(
        `INSERT INTO truckloads (
          driver_id, start_date, end_date, trailer_number, bill_of_lading_number,
          description, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
        RETURNING id`,
        [
          finalDriverId,
          startDate,
          endDate || startDate,
          trailerNumber,
          nextBol,
          `Created from suggested load group: ${group.name}`,
          (session.user as any).id,
        ]
      )

      const truckloadId = truckloadResult.rows[0].id

      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i]

        const orderCheck = await client.query(
          'SELECT pickup_customer_id, delivery_customer_id, status FROM orders WHERE id = $1',
          [orderId]
        )
        if (orderCheck.rows.length === 0) continue

        const order = orderCheck.rows[0]
        const assignmentType = order.status === 'unassigned' ? 'pickup' : 'delivery'

        await client.query(
          `INSERT INTO truckload_order_assignments (truckload_id, order_id, assignment_type, sequence_number)
           VALUES ($1, $2, $3, $4)`,
          [truckloadId, orderId, assignmentType, i + 1]
        )

        await client.query(
          `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [assignmentType === 'pickup' ? 'pickup_assigned' : 'delivery_assigned', orderId]
        )
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        truckloadId,
        message: `Created draft truckload #${truckloadId} with ${orderIds.length} orders`,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error confirming group:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
