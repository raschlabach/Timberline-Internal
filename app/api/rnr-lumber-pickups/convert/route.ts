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
    const { loadIds, truckloadId, loadTypes } = body as {
      loadIds: number[]
      truckloadId?: number
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

    if (!loadIds?.length) {
      client.release()
      return NextResponse.json({ error: 'No loads selected' }, { status: 400 })
    }

    const rnrResult = await client.query(
      `SELECT id FROM customers WHERE customer_name ILIKE '%rnr%enterprise%' LIMIT 1`
    )

    if (rnrResult.rows.length === 0) {
      client.release()
      return NextResponse.json(
        { error: 'RNR Enterprises customer not found in database. Please add them as a customer first.' },
        { status: 400 }
      )
    }

    const deliveryCustomerId = rnrResult.rows[0].id

    let truckloadDriverName: string | null = null
    let truckloadEndDate: string | null = null

    if (truckloadId) {
      const truckloadResult = await client.query(
        `SELECT t.id, t.end_date, u.full_name as driver_name
         FROM truckloads t
         LEFT JOIN users u ON t.driver_id = u.id
         WHERE t.id = $1 AND t.is_completed = false`,
        [truckloadId]
      )

      if (truckloadResult.rows.length === 0) {
        client.release()
        return NextResponse.json(
          { error: 'Truckload not found or already completed' },
          { status: 400 }
        )
      }

      truckloadDriverName = truckloadResult.rows[0].driver_name
      truckloadEndDate = truckloadResult.rows[0].end_date
        ? new Date(truckloadResult.rows[0].end_date).toISOString().split('T')[0]
        : null
    }

    const loadsResult = await client.query(
      `SELECT
        ll.id,
        ll.load_id,
        ll.supplier_id,
        ll.plant_id,
        ll.pickup_number,
        ll.comments,
        ll.timberline_order_id,
        COALESCE(rscm_plant.customer_id, rscm_default.customer_id) as pickup_customer_id,
        COALESCE(SUM(lli.estimated_footage), 0) as total_estimated_footage
      FROM lumber_loads ll
      LEFT JOIN rnr_supplier_customer_map rscm_plant
        ON rscm_plant.supplier_id = ll.supplier_id AND rscm_plant.plant_id = ll.plant_id AND ll.plant_id IS NOT NULL
      LEFT JOIN rnr_supplier_customer_map rscm_default
        ON rscm_default.supplier_id = ll.supplier_id AND rscm_default.plant_id IS NULL
      LEFT JOIN lumber_load_items lli ON lli.load_id = ll.id
      WHERE ll.id = ANY($1)
        AND ll.pickup_or_delivery = 'pickup'
        AND ll.timberline_order_id IS NULL
      GROUP BY ll.id, ll.load_id, ll.supplier_id, ll.plant_id, ll.pickup_number, ll.comments,
               ll.timberline_order_id, rscm_plant.customer_id, rscm_default.customer_id`,
      [loadIds]
    )

    if (loadsResult.rows.length === 0) {
      client.release()
      return NextResponse.json(
        { error: 'No valid unconverted pickup loads found' },
        { status: 400 }
      )
    }

    const unmatchedLoads = loadsResult.rows.filter((l: Record<string, unknown>) => !l.pickup_customer_id)
    if (unmatchedLoads.length > 0) {
      const ids = unmatchedLoads.map((l: Record<string, unknown>) => l.load_id).join(', ')
      client.release()
      return NextResponse.json(
        { error: `Cannot convert loads with unmatched suppliers: ${ids}. Please match them first.` },
        { status: 400 }
      )
    }

    await client.query('BEGIN')

    let lumberDriverId: number | null = null
    if (truckloadId && truckloadDriverName) {
      const existingDriver = await client.query(
        `SELECT id FROM lumber_drivers WHERE LOWER(name) = LOWER($1) AND is_active = true LIMIT 1`,
        [truckloadDriverName]
      )

      if (existingDriver.rows.length > 0) {
        lumberDriverId = existingDriver.rows[0].id
      } else {
        const newDriver = await client.query(
          `INSERT INTO lumber_drivers (name, is_active) VALUES ($1, true) RETURNING id`,
          [truckloadDriverName]
        )
        lumberDriverId = newDriver.rows[0].id
      }
    }

    const createdOrders: { orderId: number; loadId: number; loadCode: string }[] = []

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

    const lt = loadTypes || {
      ohioToIndiana: false,
      backhaul: false,
      localFlatbed: false,
      rrOrder: true,
      localSemi: false,
      middlefield: false,
      paNy: false,
    }

    const orderStatus = truckloadId ? 'pickup_assigned' : 'unassigned'

    for (const load of loadsResult.rows) {
      const pickupDate = new Date().toISOString().split('T')[0]

      const orderResult = await client.query(
        `INSERT INTO orders (
          pickup_customer_id,
          delivery_customer_id,
          pickup_date,
          comments,
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
          load.pickup_customer_id,
          deliveryCustomerId,
          pickupDate,
          load.comments ? `RNR ${load.load_id} - ${load.comments}` : `RNR ${load.load_id}`,
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

      const totalFootage = parseFloat(load.total_estimated_footage) || 0
      if (totalFootage > 0) {
        await client.query(
          `INSERT INTO footage (order_id, square_footage, description)
           VALUES ($1, $2, $3)`,
          [orderId, totalFootage, `Lumber pickup - ${load.load_id}`]
        )
      }

      if (truckloadId) {
        await client.query(
          `INSERT INTO truckload_order_assignments (
            truckload_id, order_id, assignment_type, sequence_number
          ) VALUES ($1, $2, $3, $4)`,
          [truckloadId, orderId, 'pickup', nextSequence]
        )
        nextSequence++
      }

      if (truckloadId && lumberDriverId && truckloadEndDate) {
        await client.query(
          `UPDATE lumber_loads
           SET timberline_order_id = $1,
               driver_id = $2,
               assigned_pickup_date = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [orderId, lumberDriverId, truckloadEndDate, load.id]
        )
      } else {
        await client.query(
          `UPDATE lumber_loads
           SET timberline_order_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [orderId, load.id]
        )
      }

      createdOrders.push({
        orderId,
        loadId: load.id,
        loadCode: load.load_id,
      })
    }

    await client.query('COMMIT')

    const message = truckloadId
      ? `Created ${createdOrders.length} order${createdOrders.length !== 1 ? 's' : ''} and assigned to truckload`
      : `Created ${createdOrders.length} order${createdOrders.length !== 1 ? 's' : ''}`

    return NextResponse.json({
      success: true,
      ordersCreated: createdOrders.length,
      orders: createdOrders,
      message,
    })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Error converting RNR lumber pickups:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to convert loads' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
