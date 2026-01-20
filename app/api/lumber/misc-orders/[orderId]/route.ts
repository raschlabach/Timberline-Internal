import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/misc-orders/[orderId] - Get a specific misc order
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT 
        mo.*,
        COUNT(mp.id) as pack_count,
        COUNT(CASE WHEN mp.is_finished THEN 1 END) as finished_pack_count,
        COALESCE(SUM(CASE WHEN mp.is_finished THEN mp.actual_board_feet ELSE 0 END), 0) as total_finished_bf
      FROM misc_rip_orders mo
      LEFT JOIN misc_rip_packs mp ON mo.id = mp.misc_order_id
      WHERE mo.id = $1
      GROUP BY mo.id`,
      [params.orderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching misc order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/lumber/misc-orders/[orderId] - Update a misc order
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.customer_name !== undefined) {
      updates.push(`customer_name = $${paramIndex++}`)
      values.push(body.customer_name)
    }
    if (body.species !== undefined) {
      updates.push(`species = $${paramIndex++}`)
      values.push(body.species)
    }
    if (body.grade !== undefined) {
      updates.push(`grade = $${paramIndex++}`)
      values.push(body.grade)
    }
    if (body.thickness !== undefined) {
      updates.push(`thickness = $${paramIndex++}`)
      values.push(body.thickness)
    }
    if (body.estimated_footage !== undefined) {
      updates.push(`estimated_footage = $${paramIndex++}`)
      values.push(body.estimated_footage)
    }
    if (body.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`)
      values.push(body.notes)
    }
    if (body.is_complete !== undefined) {
      updates.push(`is_complete = $${paramIndex++}`)
      values.push(body.is_complete)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(params.orderId)

    const result = await query(
      `UPDATE misc_rip_orders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating misc order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/misc-orders/[orderId] - Delete a misc order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // This will cascade delete all packs due to ON DELETE CASCADE
    const result = await query(
      `DELETE FROM misc_rip_orders WHERE id = $1 RETURNING id`,
      [params.orderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting misc order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
