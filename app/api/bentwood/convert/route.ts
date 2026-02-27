import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const client = await getClient()

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      client.release()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { itemIds, truckloadId, pickupDate, loadTypes } = body as {
      itemIds: number[]
      truckloadId?: number
      pickupDate: string
      loadTypes?: {
        ohioToIndiana: boolean
        backhaul: boolean
        localFlatbed: boolean
        rrOrder: boolean
        localSemi: boolean
        middlefield: boolean
        paNy: boolean
      }
    }

    if (!itemIds?.length) {
      client.release()
      return NextResponse.json({ error: 'No items selected' }, { status: 400 })
    }

    const bentwoodResult = await client.query(
      `SELECT id FROM customers WHERE customer_name ILIKE '%bentwood%' LIMIT 1`
    )

    if (bentwoodResult.rows.length === 0) {
      client.release()
      return NextResponse.json(
        { error: 'Bentwood Solutions customer not found in database. Please add them as a customer first.' },
        { status: 400 }
      )
    }

    const pickupCustomerId = bentwoodResult.rows[0].id

    if (truckloadId) {
      const truckloadResult = await client.query(
        `SELECT id FROM truckloads WHERE id = $1 AND is_completed = false`,
        [truckloadId]
      )

      if (truckloadResult.rows.length === 0) {
        client.release()
        return NextResponse.json(
          { error: 'Truckload not found or already completed' },
          { status: 400 }
        )
      }
    }

    const itemsResult = await client.query(
      `SELECT
        item.*,
        c.customer_name as matched_customer_name
      FROM bentwood_import_items item
      LEFT JOIN customers c ON item.matched_customer_id = c.id
      WHERE item.id = ANY($1)
        AND item.status = 'pending'`,
      [itemIds]
    )

    if (itemsResult.rows.length === 0) {
      client.release()
      return NextResponse.json(
        { error: 'No valid pending items found to convert' },
        { status: 400 }
      )
    }

    const unmatchedItems = itemsResult.rows.filter((item: any) => !item.matched_customer_id)
    if (unmatchedItems.length > 0) {
      const names = unmatchedItems.map((i: any) => i.ship_to_name).join(', ')
      client.release()
      return NextResponse.json(
        { error: `Cannot convert items with unmatched customers: ${names}. Please match them first.` },
        { status: 400 }
      )
    }

    await client.query('BEGIN')

    const createdOrders: { orderId: number; itemId: number; customerName: string }[] = []

    let nextSequence = 1
    if (truckloadId) {
      const seqResult = await client.query(
        `SELECT COALESCE(MAX(sequence_number), 0) as max_seq
         FROM truckload_order_assignments
         WHERE truckload_id = $1`,
        [truckloadId]
      )
      nextSequence = seqResult.rows[0].max_seq + 1
    }

    const fallbackDate = pickupDate || new Date().toISOString().split('T')[0]
    const orderStatus = truckloadId ? 'delivery_assigned' : 'pending'

    for (const item of itemsResult.rows) {
      const itemPickupDate = item.pickup_date
        ? new Date(item.pickup_date).toISOString().split('T')[0]
        : fallbackDate

      const lt = loadTypes || {
        ohioToIndiana: true,
        localFlatbed: true,
        backhaul: false,
        rrOrder: false,
        localSemi: false,
        middlefield: false,
        paNy: false,
      }

      const orderResult = await client.query(
        `INSERT INTO orders (
          pickup_customer_id,
          delivery_customer_id,
          pickup_date,
          freight_quote,
          status,
          created_by,
          oh_to_in,
          backhaul,
          local_flatbed,
          rr_order,
          local_semi,
          middlefield,
          pa_ny
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id`,
        [
          pickupCustomerId,
          item.matched_customer_id,
          itemPickupDate,
          item.freight_quote || null,
          orderStatus,
          session.user.id,
          lt.ohioToIndiana,
          lt.backhaul,
          lt.localFlatbed,
          lt.rrOrder,
          lt.localSemi,
          lt.middlefield,
          lt.paNy,
        ]
      )

      const orderId = orderResult.rows[0].id

      if (item.is_bundle) {
        if (item.skid_qty > 0) {
          await client.query(
            `INSERT INTO freight_items (order_id, type, quantity, description, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, 'hand_bundle', item.skid_qty, null, session.user.id]
          )
        }
      } else {
        if (item.skid_qty > 0) {
          await client.query(
            `INSERT INTO skids (order_id, width, length, square_footage, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, 4, 4, 16, item.skid_qty]
          )
        }
      }

      if (truckloadId) {
        await client.query(
          `INSERT INTO truckload_order_assignments (
            truckload_id, order_id, assignment_type, sequence_number
          ) VALUES ($1, $2, $3, $4)`,
          [truckloadId, orderId, 'delivery', nextSequence]
        )
        nextSequence++
      }

      await client.query(
        `UPDATE bentwood_import_items
         SET status = 'converted',
             order_id = $1,
             truckload_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [orderId, truckloadId || null, item.id]
      )

      createdOrders.push({
        orderId,
        itemId: item.id,
        customerName: item.matched_customer_name || item.ship_to_name,
      })
    }

    const pendingCheck = await client.query(
      `SELECT COUNT(*) as pending
       FROM bentwood_import_items
       WHERE import_id = (SELECT import_id FROM bentwood_import_items WHERE id = $1)
         AND status = 'pending'`,
      [itemIds[0]]
    )

    if (parseInt(pendingCheck.rows[0].pending) === 0) {
      await client.query(
        `UPDATE bentwood_imports
         SET status = 'completed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT import_id FROM bentwood_import_items WHERE id = $1)`,
        [itemIds[0]]
      )
    }

    await client.query('COMMIT')

    const message = truckloadId
      ? `Created ${createdOrders.length} orders and assigned to truckload #${truckloadId}`
      : `Created ${createdOrders.length} orders`

    return NextResponse.json({
      success: true,
      ordersCreated: createdOrders.length,
      orders: createdOrders,
      message,
    })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Error converting Bentwood items:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to convert items' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
