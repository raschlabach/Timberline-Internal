import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      'SELECT profile, species, price_per_bf FROM cabinet_category_prices ORDER BY profile, species'
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching cabinet category prices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.profile || !body.species || body.price_per_bf === undefined) {
      return NextResponse.json(
        { error: 'profile, species, and price_per_bf are required' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO cabinet_category_prices (profile, species, price_per_bf, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (profile, species) DO UPDATE SET price_per_bf = $3, updated_at = NOW()
       RETURNING profile, species, price_per_bf`,
      [body.profile, body.species, body.price_per_bf]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error saving cabinet category price:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
