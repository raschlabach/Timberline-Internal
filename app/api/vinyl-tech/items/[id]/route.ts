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
    const { skid_16ft, skid_12ft, skid_4x8, misc, weight, notes_on_skids } = body

    const hasFreight = (skid_16ft || 0) + (skid_12ft || 0) + (skid_4x8 || 0) + (misc || 0) > 0

    await query(
      `UPDATE vinyl_tech_import_items
       SET skid_16ft = $1,
           skid_12ft = $2,
           skid_4x8 = $3,
           misc = $4,
           weight = $5,
           notes_on_skids = $6,
           has_freight = $7,
           status = CASE WHEN $7 = false THEN 'skipped' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND status != 'converted'`,
      [
        skid_16ft ?? 0,
        skid_12ft ?? 0,
        skid_4x8 ?? 0,
        misc ?? 0,
        weight ?? 0,
        notes_on_skids ?? '',
        hasFreight,
        itemId,
      ]
    )

    // Recalculate parent import totals
    await query(
      `UPDATE vinyl_tech_imports
       SET items_with_freight = (
             SELECT COUNT(*) FROM vinyl_tech_import_items
             WHERE import_id = vinyl_tech_imports.id AND has_freight = true
           ),
           total_weight = (
             SELECT COALESCE(SUM(weight), 0) FROM vinyl_tech_import_items
             WHERE import_id = vinyl_tech_imports.id
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT import_id FROM vinyl_tech_import_items WHERE id = $1)`,
      [itemId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating vinyl tech item:', error)
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

    // Don't allow deleting already-converted items
    const check = await query(
      `SELECT status, import_id FROM vinyl_tech_import_items WHERE id = $1`,
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

    await query('DELETE FROM vinyl_tech_import_items WHERE id = $1', [itemId])

    // Recalculate parent import totals
    await query(
      `UPDATE vinyl_tech_imports
       SET total_items = (
             SELECT COUNT(*) FROM vinyl_tech_import_items WHERE import_id = $1
           ),
           items_with_freight = (
             SELECT COUNT(*) FROM vinyl_tech_import_items
             WHERE import_id = $1 AND has_freight = true
           ),
           total_weight = (
             SELECT COALESCE(SUM(weight), 0) FROM vinyl_tech_import_items
             WHERE import_id = $1
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [importId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vinyl tech item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
