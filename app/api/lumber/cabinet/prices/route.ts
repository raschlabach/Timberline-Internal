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
      'SELECT part_number, our_price FROM cabinet_part_prices ORDER BY part_number'
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching cabinet prices:', error)
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

    if (!body.part_number || body.our_price === undefined) {
      return NextResponse.json(
        { error: 'part_number and our_price are required' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO cabinet_part_prices (part_number, our_price, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (part_number) DO UPDATE SET our_price = $2, updated_at = NOW()
       RETURNING part_number, our_price`,
      [body.part_number, body.our_price]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error saving cabinet price:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
