import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const result = await query(
      `SELECT id, file_name, po_numbers, due_date, processed_sheets, special_results,
              upload_combos, is_done, created_at, updated_at
       FROM cabinet_orders WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching cabinet order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const body = await request.json()

    const setClauses: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let paramIdx = 1

    if (body.is_done !== undefined) {
      setClauses.push(`is_done = $${paramIdx}`)
      values.push(body.is_done)
      paramIdx++
    }

    if (body.processed_sheets !== undefined) {
      setClauses.push(`processed_sheets = $${paramIdx}`)
      values.push(JSON.stringify(body.processed_sheets))
      paramIdx++
    }

    if (body.special_results !== undefined) {
      setClauses.push(`special_results = $${paramIdx}`)
      values.push(JSON.stringify(body.special_results))
      paramIdx++
    }

    values.push(id)

    const result = await query(
      `UPDATE cabinet_orders
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx}
       RETURNING id, file_name, po_numbers, due_date, is_done, created_at, updated_at`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating cabinet order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const result = await query(
      'DELETE FROM cabinet_orders WHERE id = $1 RETURNING id',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cabinet order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
