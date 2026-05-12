import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'
import { computeAllocations } from '@/lib/charcoal-allocation'

export async function GET() {
  try {
    const { role, userId } = await getCharcoalSession()
    if (!userId) return unauthorized()
    if (!role) return forbidden()

    const [ordersResult, skidsResult, stdInvResult, wcInvResult, projectionsResult, lastSkidResult] = await Promise.all([
      query(
        `SELECT o.id, o.customer_id, c.name AS customer_name, c.is_walnut_creek AS customer_is_walnut_creek,
                o.quantity, o.due_date, o.notes, o.priority, o.status, o.created_at, o.updated_at
         FROM charcoal_orders o
         JOIN charcoal_customers c ON c.id = o.customer_id
         WHERE o.status = 'open'
         ORDER BY o.priority ASC`
      ),
      query(
        `SELECT s.id, s.wrapped_at, s.wrapped_by_id, u.full_name AS wrapped_by_name,
                s.is_walnut_creek, s.notes, s.created_at, s.updated_at
         FROM charcoal_skids s
         LEFT JOIN users u ON u.id = s.wrapped_by_id
         ORDER BY s.wrapped_at DESC
         LIMIT 25`
      ),
      query(`SELECT COUNT(*)::int AS count FROM charcoal_skids WHERE is_walnut_creek = FALSE`),
      query(`SELECT COUNT(*)::int AS count FROM charcoal_skids WHERE is_walnut_creek = TRUE`),
      query(
        `SELECT id, count, ready_date, is_walnut_creek, notes, created_by_id, created_at, updated_at
         FROM charcoal_projected_skids
         WHERE count > 0
         ORDER BY ready_date ASC, created_at ASC`
      ),
      query(
        `SELECT s.wrapped_at, u.full_name AS wrapped_by_name, s.is_walnut_creek
         FROM charcoal_skids s
         LEFT JOIN users u ON u.id = s.wrapped_by_id
         ORDER BY s.wrapped_at DESC
         LIMIT 1`
      ),
    ])

    const orders = ordersResult.rows
    const skids = skidsResult.rows
    const stdInv = stdInvResult.rows[0]?.count ?? 0
    const wcInv = wcInvResult.rows[0]?.count ?? 0
    const projections = projectionsResult.rows

    const stdProj = projections.filter(p => !p.is_walnut_creek).reduce((sum, p) => sum + p.count, 0)
    const wcProj = projections.filter(p => p.is_walnut_creek).reduce((sum, p) => sum + p.count, 0)

    const allocation = computeAllocations(orders, stdInv, wcInv, projections)

    return NextResponse.json({
      orders,
      skids,
      counters: { stdInv, wcInv, stdProj, wcProj },
      projections: projectionsResult.rows,
      allocation,
      lastSkid: lastSkidResult.rows[0] || null,
    })
  } catch (error) {
    console.error('Error fetching charcoal dashboard:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}
