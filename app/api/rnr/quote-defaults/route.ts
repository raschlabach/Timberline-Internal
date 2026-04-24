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
      `SELECT id, margin_1, margin_2, margin_3, updated_at FROM rnr_quote_defaults LIMIT 1`
    )

    if (result.rows.length === 0) {
      const inserted = await query(
        `INSERT INTO rnr_quote_defaults (margin_1, margin_2, margin_3) VALUES (20, 25, 30) RETURNING *`
      )
      return NextResponse.json(inserted.rows[0])
    }

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    console.error('Error fetching quote defaults:', error)
    return NextResponse.json({ error: 'Failed to fetch quote defaults' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { margin_1, margin_2, margin_3 } = await request.json()

    const existing = await query(`SELECT id FROM rnr_quote_defaults LIMIT 1`)

    let result
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE rnr_quote_defaults SET margin_1 = $1, margin_2 = $2, margin_3 = $3, updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [margin_1, margin_2, margin_3, existing.rows[0].id]
      )
    } else {
      result = await query(
        `INSERT INTO rnr_quote_defaults (margin_1, margin_2, margin_3) VALUES ($1, $2, $3) RETURNING *`,
        [margin_1, margin_2, margin_3]
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    console.error('Error updating quote defaults:', error)
    return NextResponse.json({ error: 'Failed to update quote defaults' }, { status: 500 })
  }
}
