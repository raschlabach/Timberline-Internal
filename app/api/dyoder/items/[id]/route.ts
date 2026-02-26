import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemId = parseInt(params.id)
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 })
    }

    const body = await request.json()
    const { skid_count, weight, freight_quote, special_tops } = body

    await query(
      `UPDATE dyoder_import_items
       SET skid_count = $1,
           weight = $2,
           freight_quote = $3,
           special_tops = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND status != 'converted'`,
      [
        skid_count ?? 0,
        weight ?? 0,
        freight_quote ?? 0,
        special_tops ?? '',
        itemId,
      ]
    )

    // Recalculate parent import totals
    await query(
      `UPDATE dyoder_imports
       SET total_weight = (
             SELECT COALESCE(SUM(weight), 0) FROM dyoder_import_items
             WHERE import_id = dyoder_imports.id
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT import_id FROM dyoder_import_items WHERE id = $1)`,
      [itemId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating D Yoder item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemId = parseInt(params.id)
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 })
    }

    const check = await query(
      `SELECT status, import_id FROM dyoder_import_items WHERE id = $1`,
      [itemId]
    )

    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (check.rows[0].status === 'converted') {
      return NextResponse.json(
        { error: 'Cannot delete an item that has already been converted to an order' },
        { status: 400 }
      )
    }

    const importId = check.rows[0].import_id

    await query('DELETE FROM dyoder_import_items WHERE id = $1', [itemId])

    // Recalculate parent import totals
    await query(
      `UPDATE dyoder_imports
       SET total_items = (
             SELECT COUNT(*) FROM dyoder_import_items WHERE import_id = $1
           ),
           total_weight = (
             SELECT COALESCE(SUM(weight), 0) FROM dyoder_import_items
             WHERE import_id = $1
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [importId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting D Yoder item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
