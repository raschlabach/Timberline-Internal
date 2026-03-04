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
      `SELECT id, name, code, is_active FROM rnr_species ORDER BY name`
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error fetching species:', error)
    return NextResponse.json({ error: 'Failed to fetch species' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, code } = await request.json()
    const result = await query(
      `INSERT INTO rnr_species (name, code) VALUES ($1, $2) RETURNING *`,
      [name, code]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating species:', error)
    return NextResponse.json({ error: 'Failed to create species' }, { status: 500 })
  }
}
