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
    const { skid_qty, is_bundle, freight_quote } = body

    await query(
      `UPDATE bentwood_import_items
       SET skid_qty = $1,
           is_bundle = $2,
           freight_quote = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND status != 'converted'`,
      [
        skid_qty ?? 0,
        is_bundle ?? false,
        freight_quote ?? 0,
        itemId,
      ]
    )

    await query(
      `UPDATE bentwood_imports
       SET total_skids = (
             SELECT COALESCE(SUM(CASE WHEN is_bundle = false THEN skid_qty ELSE 0 END), 0)
             FROM bentwood_import_items WHERE import_id = bentwood_imports.id
           ),
           total_bundles = (
             SELECT COALESCE(SUM(CASE WHEN is_bundle = true THEN skid_qty ELSE 0 END), 0)
             FROM bentwood_import_items WHERE import_id = bentwood_imports.id
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT import_id FROM bentwood_import_items WHERE id = $1)`,
      [itemId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating Bentwood item:', error)
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
      `SELECT status, import_id FROM bentwood_import_items WHERE id = $1`,
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

    await query('DELETE FROM bentwood_import_items WHERE id = $1', [itemId])

    await query(
      `UPDATE bentwood_imports
       SET total_items = (
             SELECT COUNT(*) FROM bentwood_import_items WHERE import_id = $1
           ),
           total_skids = (
             SELECT COALESCE(SUM(CASE WHEN is_bundle = false THEN skid_qty ELSE 0 END), 0)
             FROM bentwood_import_items WHERE import_id = $1
           ),
           total_bundles = (
             SELECT COALESCE(SUM(CASE WHEN is_bundle = true THEN skid_qty ELSE 0 END), 0)
             FROM bentwood_import_items WHERE import_id = $1
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [importId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting Bentwood item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
