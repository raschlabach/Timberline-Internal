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
      `SELECT id, file_name, po_numbers, due_date, is_done,
              jsonb_array_length(processed_sheets) AS sheet_count,
              jsonb_array_length(special_results) AS special_count,
              created_at, updated_at
       FROM cabinet_orders
       ORDER BY is_done ASC, updated_at DESC`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching cabinet orders:', error)
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

    if (!body.file_name || !body.processed_sheets) {
      return NextResponse.json(
        { error: 'file_name and processed_sheets are required' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO cabinet_orders (file_name, po_numbers, due_date, processed_sheets, special_results, upload_combos, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, file_name, po_numbers, due_date, is_done, created_at, updated_at`,
      [
        body.file_name,
        body.po_numbers || [],
        body.due_date || null,
        JSON.stringify(body.processed_sheets),
        JSON.stringify(body.special_results || []),
        JSON.stringify(body.upload_combos || []),
        (session.user as unknown as { id?: number }).id || null,
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating cabinet order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
