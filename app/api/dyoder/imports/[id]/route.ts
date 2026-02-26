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
        i.id, i.file_name, i.batch_number, i.ship_from, i.ship_to_state,
        i.total_items, i.total_weight, i.status, i.notes, i.created_at,
        u.full_name as created_by_name
      FROM dyoder_imports i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1`,
      [importId]
    )

    if (importResult.rows.length === 0) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    const itemsResult = await query(
      `SELECT
        item.*,
        c.customer_name as matched_customer_name,
        TO_CHAR(item.ship_date, 'YYYY-MM-DD') as ship_date_formatted
      FROM dyoder_import_items item
      LEFT JOIN customers c ON item.matched_customer_id = c.id
      WHERE item.import_id = $1
      ORDER BY item.id`,
      [importId]
    )

    return NextResponse.json({
      import: importResult.rows[0],
      items: itemsResult.rows,
    })
  } catch (error) {
    console.error('Error fetching D Yoder import:', error)
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

    const convertedCheck = await query(
      `SELECT COUNT(*) as count FROM dyoder_import_items
       WHERE import_id = $1 AND status = 'converted'`,
      [importId]
    )

    if (parseInt(convertedCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete an import that has converted items. Hide it instead.' },
        { status: 400 }
      )
    }

    await query('DELETE FROM dyoder_imports WHERE id = $1', [importId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting D Yoder import:', error)
    return NextResponse.json(
      { error: 'Failed to delete import' },
      { status: 500 }
    )
  }
}
