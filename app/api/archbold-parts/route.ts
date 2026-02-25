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
      'SELECT id, item_code, width, length, used_for, created_at, updated_at FROM archbold_parts ORDER BY item_code'
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching archbold parts:', error)
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

    if (!body.item_code) {
      return NextResponse.json({ error: 'item_code is required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO archbold_parts (item_code, width, length, used_for)
       VALUES ($1, $2, $3, $4)
       RETURNING id, item_code, width, length, used_for, created_at, updated_at`,
      [body.item_code, body.width || null, body.length || null, body.used_for || null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('unique')) {
      return NextResponse.json({ error: 'An item with this code already exists' }, { status: 409 })
    }
    console.error('Error creating archbold part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
