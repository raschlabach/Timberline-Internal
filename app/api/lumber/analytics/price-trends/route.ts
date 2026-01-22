import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// Time range configurations
const TIME_RANGES: Record<string, { months: number; label: string }> = {
  '3m': { months: 3, label: '3 Months' },
  '6m': { months: 6, label: '6 Months' },
  '1y': { months: 12, label: '1 Year' },
  '2y': { months: 24, label: '2 Years' },
  '5y': { months: 60, label: '5 Years' }
}

// GET /api/lumber/analytics/price-trends - Get price trends by species/grade with configurable time range
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '1y'
    const config = TIME_RANGES[range] || TIME_RANGES['1y']
    const monthsBack = config.months - 1 // -1 because we include the current month

    // Get monthly average prices for the specified time range, grouped by species/grade
    // Only include prices >= $0.20 per BF (exclude blank or unrealistic low prices)
    const result = await query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE - INTERVAL '${monthsBack} months'),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) as month
      ),
      species_grades AS (
        SELECT DISTINCT species, grade
        FROM lumber_load_items
        WHERE price IS NOT NULL AND price >= 0.20
      ),
      monthly_prices AS (
        SELECT 
          li.species,
          li.grade,
          date_trunc('month', l.created_at) as month,
          AVG(li.price) as avg_price,
          COUNT(*) as load_count
        FROM lumber_load_items li
        JOIN lumber_loads l ON li.load_id = l.id
        WHERE li.price IS NOT NULL
          AND li.price >= 0.20
          AND l.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '${monthsBack} months')
        GROUP BY li.species, li.grade, date_trunc('month', l.created_at)
      )
      SELECT 
        sg.species,
        sg.grade,
        json_agg(
          json_build_object(
            'month', to_char(m.month, 'YYYY-MM'),
            'month_display', CASE 
              WHEN ${config.months} <= 12 THEN to_char(m.month, 'Mon YYYY')
              ELSE to_char(m.month, 'Mon ''YY')
            END,
            'avg_price', COALESCE(mp.avg_price, NULL),
            'load_count', COALESCE(mp.load_count, 0)
          ) ORDER BY m.month
        ) as monthly_data,
        (
          SELECT AVG(li2.price)
          FROM lumber_load_items li2
          WHERE li2.species = sg.species 
            AND li2.grade = sg.grade 
            AND li2.price IS NOT NULL
            AND li2.price >= 0.20
        ) as overall_avg_price
      FROM species_grades sg
      CROSS JOIN months m
      LEFT JOIN monthly_prices mp ON sg.species = mp.species 
        AND sg.grade = mp.grade 
        AND m.month = mp.month
      GROUP BY sg.species, sg.grade
      ORDER BY sg.species, sg.grade
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching price trends:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
