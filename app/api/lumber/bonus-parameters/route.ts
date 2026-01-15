import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/bonus-parameters - Get bonus parameters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT * FROM lumber_bonus_parameters
       WHERE is_active = TRUE
       ORDER BY bf_min`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching bonus parameters:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/bonus-parameters - Create a new bonus parameter
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bf_min, bf_max, bonus_amount } = body

    if (bf_min === undefined || bf_max === undefined || bonus_amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (bf_min >= bf_max) {
      return NextResponse.json({ error: 'BF Min must be less than BF Max' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO lumber_bonus_parameters (bf_min, bf_max, bonus_amount, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING *`,
      [bf_min, bf_max, bonus_amount]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error creating bonus parameter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
