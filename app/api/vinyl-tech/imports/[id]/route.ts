import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const importId = parseInt(params.id)
    if (isNaN(importId)) {
      return NextResponse.json({ error: 'Invalid import ID' }, { status: 400 })
    }

    const importResult = await query(
      `SELECT
        i.id,
        i.file_name,
        i.week_label,
        TO_CHAR(i.week_date, 'YYYY-MM-DD') as week_date,
        i.sheet_status,
        i.total_items,
        i.items_with_freight,
        i.total_weight,
        i.status,
        i.notes,
        i.created_at,
        u.full_name as created_by_name
      FROM vinyl_tech_imports i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1`,
      [importId]
    )

    if (importResult.rows.length === 0) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    const itemsResult = await query(
      `SELECT
        item.id,
        item.vt_code,
        item.ship_to_name,
        item.skid_16ft,
        item.skid_12ft,
        item.skid_4x8,
        item.misc,
        item.weight,
        item.notes_on_skids,
        item.additional_notes,
        item.schedule_notes,
        item.has_freight,
        item.customer_matched,
        item.matched_customer_id,
        item.freight_quote,
        item.status,
        item.order_id,
        item.truckload_id,
        c.customer_name as matched_customer_name
      FROM vinyl_tech_import_items item
      LEFT JOIN customers c ON item.matched_customer_id = c.id
      WHERE item.import_id = $1
      ORDER BY item.id ASC`,
      [importId]
    )

    return NextResponse.json({
      import: importResult.rows[0],
      items: itemsResult.rows,
    })
  } catch (error) {
    console.error('Error fetching vinyl tech import:', error)
    return NextResponse.json(
      { error: 'Failed to fetch import' },
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

    const importId = parseInt(params.id)
    if (isNaN(importId)) {
      return NextResponse.json({ error: 'Invalid import ID' }, { status: 400 })
    }

    await query('DELETE FROM vinyl_tech_imports WHERE id = $1', [importId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vinyl tech import:', error)
    return NextResponse.json(
      { error: 'Failed to delete import' },
      { status: 500 }
    )
  }
}
