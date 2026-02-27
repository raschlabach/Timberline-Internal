import { NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = await getClient()

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      client.release()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await client.query(`
      SELECT
        ll.id,
        ll.load_id,
        ll.supplier_id,
        ls.name as supplier_name,
        ll.pickup_number,
        ll.pickup_or_delivery,
        ll.estimated_delivery_date,
        ll.actual_arrival_date,
        ll.pickup_date,
        ll.plant,
        ll.plant_id,
        lsp.plant_name,
        ll.comments,
        ll.created_at,
        ll.timberline_order_id,
        COALESCE(rscm_plant.customer_id, rscm_default.customer_id) as matched_customer_id,
        COALESCE(c_plant.customer_name, c_default.customer_name) as matched_customer_name,
        COALESCE(loc_plant.latitude, loc_default.latitude) as customer_lat,
        COALESCE(loc_plant.longitude, loc_default.longitude) as customer_lng,
        lsl.address as supplier_address,
        lsl.city as supplier_city,
        lsl.state as supplier_state,
        lsl.zip_code as supplier_zip,
        COALESCE(
          json_agg(
            json_build_object(
              'id', lli.id,
              'species', lli.species,
              'grade', lli.grade,
              'thickness', lli.thickness,
              'estimated_footage', lli.estimated_footage,
              'actual_footage', lli.actual_footage
            )
          ) FILTER (WHERE lli.id IS NOT NULL),
          '[]'
        ) as items,
        COALESCE(SUM(lli.estimated_footage), 0) as total_estimated_footage,
        COALESCE(SUM(lli.actual_footage), 0) as total_actual_footage,
        BOOL_OR(lli.actual_footage IS NOT NULL AND lli.actual_footage > 0) as has_actual_footage,
        o.status as timberline_order_status,
        CASE
          WHEN toa.id IS NOT NULL THEN true
          ELSE false
        END as is_assigned_to_truck
      FROM lumber_loads ll
      JOIN lumber_suppliers ls ON ll.supplier_id = ls.id
      LEFT JOIN lumber_load_items lli ON lli.load_id = ll.id
      LEFT JOIN lumber_supplier_locations lsl ON lsl.id = ll.supplier_location_id
      LEFT JOIN lumber_supplier_plants lsp ON lsp.id = ll.plant_id
      -- Plant-specific mapping (takes priority)
      LEFT JOIN rnr_supplier_customer_map rscm_plant
        ON rscm_plant.supplier_id = ll.supplier_id AND rscm_plant.plant_id = ll.plant_id AND ll.plant_id IS NOT NULL
      LEFT JOIN customers c_plant ON c_plant.id = rscm_plant.customer_id
      LEFT JOIN locations loc_plant ON loc_plant.id = c_plant.location_id
      -- Default mapping (no plant)
      LEFT JOIN rnr_supplier_customer_map rscm_default
        ON rscm_default.supplier_id = ll.supplier_id AND rscm_default.plant_id IS NULL
      LEFT JOIN customers c_default ON c_default.id = rscm_default.customer_id
      LEFT JOIN locations loc_default ON loc_default.id = c_default.location_id
      LEFT JOIN orders o ON o.id = ll.timberline_order_id
      LEFT JOIN truckload_order_assignments toa ON toa.order_id = ll.timberline_order_id
      WHERE ll.pickup_or_delivery = 'pickup'
      GROUP BY ll.id, ls.name, ll.plant, ll.plant_id, lsp.plant_name,
               rscm_plant.customer_id, c_plant.customer_name, loc_plant.latitude, loc_plant.longitude,
               rscm_default.customer_id, c_default.customer_name, loc_default.latitude, loc_default.longitude,
               lsl.address, lsl.city, lsl.state, lsl.zip_code, o.status, toa.id
      ORDER BY ll.created_at DESC
    `)

    const loads = result.rows.map((row: Record<string, unknown>) => {
      const hasActualFootage = row.has_actual_footage === true
      const hasTimberlineOrder = row.timberline_order_id !== null
      const isAssignedToTruck = row.is_assigned_to_truck === true
      const isPast = hasActualFootage || hasTimberlineOrder || isAssignedToTruck

      return {
        ...row,
        is_past: isPast,
        is_ready: row.pickup_number !== null && row.pickup_number !== '',
        customer_matched: row.matched_customer_id !== null,
      }
    })

    return NextResponse.json({ success: true, loads })
  } catch (error) {
    console.error('Error fetching RNR lumber pickups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lumber pickups' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
