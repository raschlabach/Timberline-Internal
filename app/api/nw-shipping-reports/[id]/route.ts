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
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    }

    const reportResult = await query(
      `SELECT id, northwest_po, archbold_po, delivery_date, is_done, created_at, updated_at
       FROM nw_shipping_reports WHERE id = $1`,
      [id]
    )

    if (reportResult.rows.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const itemsResult = await query(
      `SELECT i.id, i.pallet_number, i.pallet_tag, i.archbold_part_id,
              i.qty_per_skid, i.skid_width, i.skid_length, i.skid_height, i.skid_weight,
              i.sort_order,
              p.item_code, p.width AS part_width, p.length AS part_length, p.used_for
       FROM nw_shipping_report_items i
       LEFT JOIN archbold_parts p ON p.id = i.archbold_part_id
       WHERE i.report_id = $1
       ORDER BY i.sort_order, i.id`,
      [id]
    )

    return NextResponse.json({
      ...reportResult.rows[0],
      items: itemsResult.rows
    })
  } catch (error) {
    console.error('Error fetching NW shipping report:', error)
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
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    }

    const body = await request.json()

    await client.query('BEGIN')

    await client.query(
      `UPDATE nw_shipping_reports
       SET northwest_po = $1, archbold_po = $2, delivery_date = $3,
           is_done = COALESCE($4, is_done), updated_at = NOW()
       WHERE id = $5`,
      [body.northwest_po || null, body.archbold_po || null, body.delivery_date || null, body.is_done ?? null, id]
    )

    if (Array.isArray(body.items)) {
      await client.query('DELETE FROM nw_shipping_report_items WHERE report_id = $1', [id])

      for (let idx = 0; idx < body.items.length; idx++) {
        const item = body.items[idx]
        await client.query(
          `INSERT INTO nw_shipping_report_items
           (report_id, pallet_number, pallet_tag, archbold_part_id, qty_per_skid,
            skid_width, skid_length, skid_height, skid_weight, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            item.pallet_number || null,
            item.pallet_tag || null,
            item.archbold_part_id || null,
            item.qty_per_skid || null,
            item.skid_width || null,
            item.skid_length || null,
            item.skid_height || null,
            item.skid_weight || null,
            idx
          ]
        )
      }
    }

    await client.query('COMMIT')

    const reportResult = await query(
      `SELECT id, northwest_po, archbold_po, delivery_date, is_done, created_at, updated_at
       FROM nw_shipping_reports WHERE id = $1`,
      [id]
    )

    const itemsResult = await query(
      `SELECT i.id, i.pallet_number, i.pallet_tag, i.archbold_part_id,
              i.qty_per_skid, i.skid_width, i.skid_length, i.skid_height, i.skid_weight,
              i.sort_order,
              p.item_code, p.width AS part_width, p.length AS part_length, p.used_for
       FROM nw_shipping_report_items i
       LEFT JOIN archbold_parts p ON p.id = i.archbold_part_id
       WHERE i.report_id = $1
       ORDER BY i.sort_order, i.id`,
      [id]
    )

    return NextResponse.json({
      ...reportResult.rows[0],
      items: itemsResult.rows
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating NW shipping report:', error)
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
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    }

    const result = await query(
      'DELETE FROM nw_shipping_reports WHERE id = $1 RETURNING id',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting NW shipping report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
