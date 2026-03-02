import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'

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

    const orderResult = await query(
      `SELECT id, customer, po_number, is_done, created_at, updated_at
       FROM freight_orders WHERE id = $1`,
      [id]
    )

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const skidsResult = await query(
      `SELECT id, skid_number, po_number, width, length, height, weight, sort_order
       FROM freight_order_skids
       WHERE order_id = $1
       ORDER BY sort_order, id`,
      [id]
    )

    return NextResponse.json({
      ...orderResult.rows[0],
      skids: skidsResult.rows
    })
  } catch (error) {
    console.error('Error fetching freight order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const client = await getClient()
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

    await client.query('BEGIN')

    await client.query(
      `UPDATE freight_orders
       SET customer = $1, po_number = $2,
           is_done = COALESCE($3, is_done), updated_at = NOW()
       WHERE id = $4`,
      [body.customer || '', body.po_number || null, body.is_done ?? null, id]
    )

    if (Array.isArray(body.skids)) {
      await client.query('DELETE FROM freight_order_skids WHERE order_id = $1', [id])

      for (let idx = 0; idx < body.skids.length; idx++) {
        const skid = body.skids[idx]
        await client.query(
          `INSERT INTO freight_order_skids
           (order_id, skid_number, po_number, width, length, height, weight, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            skid.skid_number || null,
            skid.po_number || null,
            skid.width || null,
            skid.length || null,
            skid.height || null,
            skid.weight || null,
            idx
          ]
        )
      }
    }

    await client.query('COMMIT')

    const orderResult = await query(
      `SELECT id, customer, po_number, is_done, created_at, updated_at
       FROM freight_orders WHERE id = $1`,
      [id]
    )

    const skidsResult = await query(
      `SELECT id, skid_number, po_number, width, length, height, weight, sort_order
       FROM freight_order_skids
       WHERE order_id = $1
       ORDER BY sort_order, id`,
      [id]
    )

    return NextResponse.json({
      ...orderResult.rows[0],
      skids: skidsResult.rows
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating freight order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    client.release()
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
      'DELETE FROM freight_orders WHERE id = $1 RETURNING id',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting freight order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
