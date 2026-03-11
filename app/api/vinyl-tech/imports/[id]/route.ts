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
        COALESCE(
          TO_CHAR(item.pickup_date, 'YYYY-MM-DD'),
          TO_CHAR(pickup_t.start_date, 'YYYY-MM-DD')
        ) as pickup_date,
        COALESCE(item.pickup_driver, pickup_u.full_name) as pickup_driver,
        item.status,
        item.order_id,
        item.truckload_id,
        c.customer_name as matched_customer_name,
        u.full_name as driver_name,
        d.color as driver_color,
        t.trailer_number,
        TO_CHAR(t.start_date, 'YYYY-MM-DD') as truckload_start_date,
        TO_CHAR(t.end_date, 'YYYY-MM-DD') as truckload_end_date,
        pickup_u.full_name as pickup_assignment_driver,
        pickup_d.color as pickup_driver_color,
        TO_CHAR(pickup_t.start_date, 'YYYY-MM-DD') as pickup_truckload_date
      FROM vinyl_tech_import_items item
      LEFT JOIN customers c ON item.matched_customer_id = c.id
      LEFT JOIN truckloads t ON item.truckload_id = t.id
      LEFT JOIN drivers d ON t.driver_id = d.user_id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN truckload_order_assignments pickup_toa
        ON item.order_id = pickup_toa.order_id AND pickup_toa.assignment_type = 'pickup'
      LEFT JOIN truckloads pickup_t ON pickup_toa.truckload_id = pickup_t.id
      LEFT JOIN drivers pickup_d ON pickup_t.driver_id = pickup_d.user_id
      LEFT JOIN users pickup_u ON pickup_d.user_id = pickup_u.id
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
