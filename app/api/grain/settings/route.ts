import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const result = await query(
      'SELECT id, year, starting_amount_lbs, starting_amount_bushels, notes FROM grain_yearly_settings WHERE year = $1',
      [parseInt(year)]
    )

    return NextResponse.json({ settings: result.rows[0] || null })
  } catch (error) {
    console.error('Error fetching grain settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { year, starting_amount, unit } = body

    if (!year || starting_amount === undefined || !unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const LBS_PER_BUSHEL = 56
    const amountLbs = unit === 'bushels' ? starting_amount * LBS_PER_BUSHEL : starting_amount
    const amountBushels = unit === 'lbs' ? starting_amount / LBS_PER_BUSHEL : starting_amount

    const existing = await query(
      'SELECT id FROM grain_yearly_settings WHERE year = $1',
      [year]
    )

    let result
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE grain_yearly_settings 
         SET starting_amount_lbs = $1, starting_amount_bushels = $2, updated_at = NOW()
         WHERE year = $3
         RETURNING *`,
        [amountLbs, amountBushels, year]
      )
    } else {
      result = await query(
        `INSERT INTO grain_yearly_settings (year, starting_amount_lbs, starting_amount_bushels)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [year, amountLbs, amountBushels]
      )
    }

    return NextResponse.json({ settings: result.rows[0] })
  } catch (error) {
    console.error('Error saving grain settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
