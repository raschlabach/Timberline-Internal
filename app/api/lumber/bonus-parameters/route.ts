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
