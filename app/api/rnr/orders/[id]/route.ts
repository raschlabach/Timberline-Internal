import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderResult = await query(
      `SELECT
        o.*, c.customer_name
      FROM rnr_orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1`,
      [params.id]
    )

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const itemsResult = await query(
      `SELECT
        oi.*,
        p.rnr_part_number,
        p.species_id, p.product_type_id, p.profile_id,
        p.thickness, p.width, p.length, p.board_feet, p.lineal_feet,
        s.name as species_name,
        pt.name as product_type_name,
        pr.name as profile_name
      FROM rnr_order_items oi
      LEFT JOIN rnr_parts p ON p.id = oi.part_id
      LEFT JOIN rnr_species s ON s.id = p.species_id
      LEFT JOIN rnr_product_types pt ON pt.id = p.product_type_id
      LEFT JOIN rnr_profiles pr ON pr.id = p.profile_id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC`,
      [params.id]
    )

    return NextResponse.json({
      ...orderResult.rows[0],
      items: itemsResult.rows,
    })
  } catch (error: unknown) {
    console.error('Error fetching order:', error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customer_id, po_number, order_date, due_date, status, is_rush, notes, total_price, items } = body

    const orderResult = await query(
      `UPDATE rnr_orders SET
        customer_id = COALESCE($1, customer_id),
        po_number = $2,
        order_date = COALESCE($3, order_date),
        due_date = $4,
        status = COALESCE($5, status),
        is_rush = COALESCE($6, is_rush),
        notes = $7,
        total_price = COALESCE($8, total_price),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *`,
      [customer_id, po_number || null, order_date, due_date || null, status, is_rush, notes || null, total_price, params.id]
    )

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (items && Array.isArray(items)) {
      await query(`DELETE FROM rnr_order_items WHERE order_id = $1`, [params.id])

      for (const item of items) {
        await query(
          `INSERT INTO rnr_order_items (order_id, part_id, customer_part_number, description, quantity_ordered, quantity_final, price_per_unit, price_unit, line_total, is_new_part, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            params.id,
            item.part_id || null,
            item.customer_part_number || null,
            item.description || null,
            item.quantity_ordered || 0,
            item.quantity_final || null,
            item.price_per_unit || null,
            item.price_unit || 'BF',
            item.line_total || 0,
            item.is_new_part || false,
            item.notes || null,
          ]
        )
      }
    }

    return NextResponse.json(orderResult.rows[0])
  } catch (error: unknown) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `DELETE FROM rnr_orders WHERE id = $1 RETURNING id`,
      [params.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting order:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
