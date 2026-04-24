import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const species = searchParams.get('species')
    const grade = searchParams.get('grade')

    if (!species || !grade) {
      return NextResponse.json({ error: 'species and grade are required' }, { status: 400 })
    }

    const result = await query(
      `SELECT lp.cost_per_bf, lp.effective_date
       FROM rnr_lumber_pricing lp
       JOIN rnr_species s ON s.id = lp.species_id
       WHERE s.name = $1 AND lp.grade = $2
       ORDER BY lp.effective_date DESC
       LIMIT 3`,
      [species, grade]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ average_cost: null, entries: [] })
    }

    const costs = result.rows.map((r: { cost_per_bf: string }) => parseFloat(r.cost_per_bf))
    const averageCost = costs.reduce((a: number, b: number) => a + b, 0) / costs.length

    return NextResponse.json({
      average_cost: Math.round(averageCost * 10000) / 10000,
      entries: result.rows.map((r: { cost_per_bf: string; effective_date: string }) => ({
        cost_per_bf: r.cost_per_bf,
        date: r.effective_date,
      })),
    })
  } catch (error: unknown) {
    console.error('Error fetching lumber pricing:', error)
    return NextResponse.json({ error: 'Failed to fetch lumber pricing' }, { status: 500 })
  }
}
