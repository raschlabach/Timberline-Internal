import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid part ID' }, { status: 400 })
    }

    if (!body.item_code) {
      return NextResponse.json({ error: 'item_code is required' }, { status: 400 })
    }

    const result = await query(
      `UPDATE archbold_parts
       SET item_code = $1, width = $2, length = $3, used_for = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, item_code, width, length, used_for, created_at, updated_at`,
      [body.item_code, body.width || null, body.length || null, body.used_for || null, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('unique')) {
      return NextResponse.json({ error: 'An item with this code already exists' }, { status: 409 })
    }
    console.error('Error updating archbold part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
      return NextResponse.json({ error: 'Invalid part ID' }, { status: 400 })
    }

    const inUse = await query(
      'SELECT COUNT(*) as count FROM nw_shipping_report_items WHERE archbold_part_id = $1',
      [id]
    )

    if (parseInt(inUse.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete this part because it is used in shipping reports' },
        { status: 409 }
      )
    }

    const result = await query('DELETE FROM archbold_parts WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting archbold part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
