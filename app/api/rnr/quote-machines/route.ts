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
      `SELECT id, name, rate_per_hour, setup_cost, throughput_unit, throughput_rate, notes, active, created_at, updated_at
       FROM rnr_machines
       ORDER BY active DESC, name ASC`
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error fetching machines:', error)
    return NextResponse.json({ error: 'Failed to fetch machines' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, rate_per_hour, setup_cost, throughput_unit, throughput_rate, notes } = await request.json()

    if (!name || rate_per_hour == null || !throughput_unit || throughput_rate == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO rnr_machines (name, rate_per_hour, setup_cost, throughput_unit, throughput_rate, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, rate_per_hour, setup_cost || 0, throughput_unit, throughput_rate, notes || null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating machine:', error)
    return NextResponse.json({ error: 'Failed to create machine' }, { status: 500 })
  }
}
