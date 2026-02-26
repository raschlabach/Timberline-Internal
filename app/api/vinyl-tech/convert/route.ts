import { NextRequest, NextResponse } from 'next/server'
import { getClient, query } from '@/lib/db'
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
    const { itemIds, truckloadId, pickupDate } = body as {
      itemIds: number[]
      truckloadId: number
      pickupDate: string
    }

    if (!itemIds?.length) {
      client.release()
      return NextResponse.json({ error: 'No items selected' }, { status: 400 })
    }

    if (!truckloadId) {
      client.release()
      return NextResponse.json({ error: 'No truckload selected' }, { status: 400 })
    }

    // Find Vinyl Tech as the pickup customer
    const vinylTechResult = await client.query(
      `SELECT id FROM customers WHERE customer_name ILIKE '%vinyl tech%' LIMIT 1`
    )

    if (vinylTechResult.rows.length === 0) {
      client.release()
      return NextResponse.json(
        { error: 'Vinyl Tech customer not found in database. Please add Vinyl Tech as a customer first.' },
        { status: 400 }
      )
    }

    const pickupCustomerId = vinylTechResult.rows[0].id

    // Verify the truckload exists and is not completed
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

    // Fetch the selected items
    const itemsResult = await client.query(
      `SELECT
        item.*,
        c.customer_name as matched_customer_name
      FROM vinyl_tech_import_items item
      LEFT JOIN customers c ON item.matched_customer_id = c.id
      WHERE item.id = ANY($1)
        AND item.status = 'pending'
        AND item.has_freight = true`,
      [itemIds]
    )

    if (itemsResult.rows.length === 0) {
      client.release()
      return NextResponse.json(
        { error: 'No valid pending items found to convert' },
        { status: 400 }
      )
    }

    // Check for unmatched customers
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

    // Get next sequence number for truckload assignments
    const seqResult = await client.query(
      `SELECT COALESCE(MAX(sequence_number), 0) as max_seq
       FROM truckload_order_assignments
       WHERE truckload_id = $1`,
      [truckloadId]
    )
    let nextSequence = seqResult.rows[0].max_seq + 1

    // Use the provided pickup date, or fallback to the import's week_date
    const orderDate = pickupDate || new Date().toISOString().split('T')[0]

    for (const item of itemsResult.rows) {
      // Create the order: pickup = Vinyl Tech, delivery = matched customer
      const orderResult = await client.query(
        `INSERT INTO orders (
          pickup_customer_id,
          delivery_customer_id,
          pickup_date,
          comments,
          status,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          pickupCustomerId,
          item.matched_customer_id,
          orderDate,
          [item.notes_on_skids, item.additional_notes, item.schedule_notes]
            .filter(Boolean)
            .join(' | ') || null,
          'delivery_assigned',
          session.user.id,
        ]
      )

      const orderId = orderResult.rows[0].id

      // Create vinyl records for each skid type
      if (item.skid_16ft > 0) {
        for (let i = 0; i < item.skid_16ft; i++) {
          await client.query(
            `INSERT INTO vinyl (order_id, width, length, square_footage, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, 4, 16, 4 * 16, 1]
          )
        }
      }

      if (item.skid_12ft > 0) {
        for (let i = 0; i < item.skid_12ft; i++) {
          await client.query(
            `INSERT INTO vinyl (order_id, width, length, square_footage, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, 4, 12, 4 * 12, 1]
          )
        }
      }

      if (item.skid_4x8 > 0) {
        for (let i = 0; i < item.skid_4x8; i++) {
          await client.query(
            `INSERT INTO vinyl (order_id, width, length, square_footage, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, 4, 8, 4 * 8, 1]
          )
        }
      }

      // Create the truckload assignment as delivery
      await client.query(
        `INSERT INTO truckload_order_assignments (
          truckload_id, order_id, assignment_type, sequence_number
        ) VALUES ($1, $2, $3, $4)`,
        [truckloadId, orderId, 'delivery', nextSequence]
      )
      nextSequence++

      // Update the import item to mark as converted
      await client.query(
        `UPDATE vinyl_tech_import_items
         SET status = 'converted',
             order_id = $1,
             truckload_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [orderId, truckloadId, item.id]
      )

      createdOrders.push({
        orderId,
        itemId: item.id,
        customerName: item.matched_customer_name || item.ship_to_name,
      })
    }

    // Check if all freight items for this import are now converted
    const pendingCheck = await client.query(
      `SELECT COUNT(*) as pending
       FROM vinyl_tech_import_items
       WHERE import_id = (SELECT import_id FROM vinyl_tech_import_items WHERE id = $1)
         AND status = 'pending'
         AND has_freight = true`,
      [itemIds[0]]
    )

    if (parseInt(pendingCheck.rows[0].pending) === 0) {
      await client.query(
        `UPDATE vinyl_tech_imports
         SET status = 'completed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT import_id FROM vinyl_tech_import_items WHERE id = $1)`,
        [itemIds[0]]
      )
    }

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      ordersCreated: createdOrders.length,
      orders: createdOrders,
      message: `Created ${createdOrders.length} orders and assigned to truckload #${truckloadId}`,
    })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Error converting vinyl tech items:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to convert items' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
