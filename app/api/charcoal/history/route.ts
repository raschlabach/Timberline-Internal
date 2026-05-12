import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function GET(request: Request) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to query params are required (YYYY-MM-DD)' }, { status: 400 })
    }

    const tz = 'America/New_York'

    const [baggedResult, orderedResult, ytdBaggedResult, ytdOrderedResult] = await Promise.all([
      query(
        `SELECT
           (s.wrapped_at AT TIME ZONE $3)::date AS date,
           COUNT(*) FILTER (WHERE NOT s.is_walnut_creek)::int AS bagged_std,
           COUNT(*) FILTER (WHERE s.is_walnut_creek)::int AS bagged_wc
         FROM charcoal_skids s
         WHERE (s.wrapped_at AT TIME ZONE $3)::date >= $1::date
           AND (s.wrapped_at AT TIME ZONE $3)::date <= $2::date
         GROUP BY (s.wrapped_at AT TIME ZONE $3)::date`,
        [from, to, tz]
      ),
      query(
        `SELECT
           (o.created_at AT TIME ZONE $3)::date AS date,
           SUM(o.quantity) FILTER (WHERE NOT c.is_walnut_creek)::int AS ordered_std,
           SUM(o.quantity) FILTER (WHERE c.is_walnut_creek)::int AS ordered_wc
         FROM charcoal_orders o
         JOIN charcoal_customers c ON c.id = o.customer_id
         WHERE (o.created_at AT TIME ZONE $3)::date >= $1::date
           AND (o.created_at AT TIME ZONE $3)::date <= $2::date
         GROUP BY (o.created_at AT TIME ZONE $3)::date`,
        [from, to, tz]
      ),
      query(
        `SELECT COUNT(*)::int AS count
         FROM charcoal_skids
         WHERE EXTRACT(YEAR FROM (wrapped_at AT TIME ZONE $1)) = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [tz]
      ),
      query(
        `SELECT COALESCE(SUM(o.quantity), 0)::int AS count
         FROM charcoal_orders o
         WHERE EXTRACT(YEAR FROM (o.created_at AT TIME ZONE $1)) = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [tz]
      ),
    ])

    const baggedMap = new Map<string, { std: number; wc: number }>()
    for (const row of baggedResult.rows) {
      const d = typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0]
      baggedMap.set(d, { std: row.bagged_std, wc: row.bagged_wc })
    }

    const orderedMap = new Map<string, { std: number; wc: number }>()
    for (const row of orderedResult.rows) {
      const d = typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0]
      orderedMap.set(d, { std: row.ordered_std ?? 0, wc: row.ordered_wc ?? 0 })
    }

    const byDay: { date: string; bagged_std: number; bagged_wc: number; ordered_std: number; ordered_wc: number }[] = []
    const startDate = new Date(from + 'T00:00:00')
    const endDate = new Date(to + 'T00:00:00')

    let monthBaggedStd = 0, monthBaggedWc = 0, monthOrderedStd = 0, monthOrderedWc = 0

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const bagged = baggedMap.get(dateStr) ?? { std: 0, wc: 0 }
      const ordered = orderedMap.get(dateStr) ?? { std: 0, wc: 0 }
      byDay.push({
        date: dateStr,
        bagged_std: bagged.std,
        bagged_wc: bagged.wc,
        ordered_std: ordered.std,
        ordered_wc: ordered.wc,
      })
      monthBaggedStd += bagged.std
      monthBaggedWc += bagged.wc
      monthOrderedStd += ordered.std
      monthOrderedWc += ordered.wc
    }

    return NextResponse.json({
      byDay,
      monthTotals: {
        baggedStd: monthBaggedStd,
        baggedWc: monthBaggedWc,
        orderedStd: monthOrderedStd,
        orderedWc: monthOrderedWc,
      },
      ytdTotals: {
        bagged: ytdBaggedResult.rows[0]?.count ?? 0,
        ordered: ytdOrderedResult.rows[0]?.count ?? 0,
      },
    })
  } catch (error) {
    console.error('Error fetching charcoal history:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
