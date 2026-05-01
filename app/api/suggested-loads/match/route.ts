import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { matchOrdersToPolygons, type PolygonRule, type MatchableOrder } from '@/lib/point-in-polygon'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const polygonsResult = await query(`
      SELECT 
        id, name, coordinates, color, match_on as "matchOn",
        max_footage as "maxFootage", max_stops as "maxStops",
        only_unassigned_type as "onlyUnassignedType",
        load_type_filter as "loadTypeFilter"
      FROM load_suggestion_polygons
      WHERE is_active = true
      ORDER BY name
    `)

    const polygons: PolygonRule[] = polygonsResult.rows.map((p: any) => ({
      ...p,
      coordinates: typeof p.coordinates === 'string' ? JSON.parse(p.coordinates) : p.coordinates,
    }))

    let dateFilter = ''
    const queryParams: any[] = []
    if (dateFrom) {
      queryParams.push(dateFrom)
      dateFilter += ` AND o.pickup_date >= $${queryParams.length}`
    }
    if (dateTo) {
      queryParams.push(dateTo)
      dateFilter += ` AND o.pickup_date <= $${queryParams.length}`
    }

    const ordersResult = await query(`
      SELECT 
        o.id,
        o.pickup_date as "pickupDate",
        o.is_rush as "isRush",
        o.needs_attention as "needsAttention",
        o.comments,
        o.oh_to_in as "ohToIn",
        o.backhaul,
        o.local_semi as "localSemi",
        o.local_flatbed as "localFlatbed",
        o.rr_order as "rrOrder",
        o.middlefield,
        o.pa_ny as "paNy",
        o.status,
        o.freight_quote as "freightQuote",
        pc.id as "pickupCustomerId",
        pc.customer_name as "pickupCustomer",
        pl.city as "pickupCity",
        pl.state as "pickupState",
        pl.latitude as "pickupLat",
        pl.longitude as "pickupLng",
        dc.id as "deliveryCustomerId",
        dc.customer_name as "deliveryCustomer",
        dl.city as "deliveryCity",
        dl.state as "deliveryState",
        dl.latitude as "deliveryLat",
        dl.longitude as "deliveryLng",
        COALESCE(
          (SELECT SUM(s.width * s.length * s.quantity) FROM skids s WHERE s.order_id = o.id), 0
        ) + COALESCE(
          (SELECT SUM(v.width * v.length * v.quantity) FROM vinyl v WHERE v.order_id = o.id), 0
        ) + COALESCE(
          (SELECT SUM(f.square_footage) FROM footage f WHERE f.order_id = o.id), 0
        ) as "totalFootage",
        EXISTS (
          SELECT 1 FROM truckload_order_assignments toa 
          WHERE toa.order_id = o.id AND toa.assignment_type = 'pickup'
        ) as "pickupAssigned",
        EXISTS (
          SELECT 1 FROM truckload_order_assignments toa 
          WHERE toa.order_id = o.id AND toa.assignment_type = 'delivery'
        ) as "deliveryAssigned"
      FROM orders o
      JOIN customers pc ON o.pickup_customer_id = pc.id
      LEFT JOIN locations pl ON pc.location_id = pl.id
      JOIN customers dc ON o.delivery_customer_id = dc.id
      LEFT JOIN locations dl ON dc.location_id = dl.id
      WHERE o.status = 'unassigned'
      ${dateFilter}
      ORDER BY o.pickup_date, o.id
    `, queryParams)

    const orders: MatchableOrder[] = ordersResult.rows.map((o: any) => ({
      id: o.id,
      pickupLat: o.pickupLat ? parseFloat(o.pickupLat) : null,
      pickupLng: o.pickupLng ? parseFloat(o.pickupLng) : null,
      deliveryLat: o.deliveryLat ? parseFloat(o.deliveryLat) : null,
      deliveryLng: o.deliveryLng ? parseFloat(o.deliveryLng) : null,
      pickupAssigned: o.pickupAssigned,
      deliveryAssigned: o.deliveryAssigned,
      ohToIn: o.ohToIn,
      backhaul: o.backhaul,
      localSemi: o.localSemi,
      localFlatbed: o.localFlatbed,
      rrOrder: o.rrOrder,
      middlefield: o.middlefield,
      paNy: o.paNy,
      totalFootage: parseInt(o.totalFootage) || 0,
    }))

    const { matches, unmatched } = matchOrdersToPolygons(orders, polygons)

    const groupsResult = await query(`
      SELECT 
        g.id, g.name, g.max_footage as "maxFootage", g.max_stops as "maxStops",
        g.preferred_driver_id as "preferredDriverId",
        COALESCE(u.full_name, NULL) as "preferredDriverName",
        COALESCE(
          array_agg(gp.polygon_id) FILTER (WHERE gp.polygon_id IS NOT NULL),
          '{}'
        ) as "polygonIds"
      FROM load_suggestion_groups g
      LEFT JOIN load_suggestion_group_polygons gp ON g.id = gp.group_id
      LEFT JOIN users u ON g.preferred_driver_id = u.id
      WHERE g.is_active = true
      GROUP BY g.id, u.full_name
    `)

    const orderMap = new Map(ordersResult.rows.map((o: any) => [o.id, o]))

    const polygonToOrders = new Map<number, any[]>()
    for (const m of matches) {
      if (!polygonToOrders.has(m.polygonId)) polygonToOrders.set(m.polygonId, [])
      polygonToOrders.get(m.polygonId)!.push(orderMap.get(m.orderId))
    }

    const groupedResults = groupsResult.rows.map((g: any) => {
      const groupOrders: any[] = []
      for (const pId of g.polygonIds) {
        const pOrders = polygonToOrders.get(pId) || []
        groupOrders.push(...pOrders)
      }
      const uniqueOrders = Array.from(new Map(groupOrders.map((o: any) => [o.id, o])).values())
      const totalFootage = uniqueOrders.reduce((sum: number, o: any) => sum + (parseInt(o.totalFootage) || 0), 0)

      return {
        ...g,
        orders: uniqueOrders,
        totalFootage,
        totalStops: uniqueOrders.length,
        isOverFootage: g.maxFootage ? totalFootage > g.maxFootage : false,
        isOverStops: g.maxStops ? uniqueOrders.length > g.maxStops : false,
      }
    })

    const unmatchedOrders = unmatched.map((id) => orderMap.get(id)).filter(Boolean)

    return NextResponse.json({
      success: true,
      groups: groupedResults,
      unmatchedOrders,
      totalOrders: ordersResult.rows.length,
      matchedCount: matches.length,
      unmatchedCount: unmatched.length,
    })
  } catch (error) {
    console.error('Error running match:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
