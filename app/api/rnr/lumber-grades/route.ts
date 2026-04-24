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

    if (!species) {
      return NextResponse.json({ error: 'species is required' }, { status: 400 })
    }

    const result = await query(
      `SELECT DISTINCT lp.grade
       FROM rnr_lumber_pricing lp
       JOIN rnr_species s ON s.id = lp.species_id
       WHERE s.name = $1
       ORDER BY lp.grade ASC`,
      [species]
    )

    return NextResponse.json(result.rows.map((r: { grade: string }) => r.grade))
  } catch (error: unknown) {
    console.error('Error fetching grades:', error)
    return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 })
  }
}
