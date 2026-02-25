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
      `SELECT r.id, r.northwest_po, r.archbold_po, r.created_at, r.updated_at,
              COUNT(i.id)::int AS item_count,
              COALESCE(SUM(i.qty_per_skid), 0)::int AS total_qty
       FROM nw_shipping_reports r
       LEFT JOIN nw_shipping_report_items i ON i.report_id = r.id
       GROUP BY r.id
       ORDER BY r.updated_at DESC`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching NW shipping reports:', error)
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

    const result = await query(
      `INSERT INTO nw_shipping_reports (northwest_po, archbold_po, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, northwest_po, archbold_po, created_at, updated_at`,
      [body.northwest_po || null, body.archbold_po || null, (session.user as unknown as { id?: number }).id || null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating NW shipping report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
