import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid polygon ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      name,
      coordinates,
      color,
      matchOn,
      maxFootage,
      maxStops,
      onlyUnassignedType,
      loadTypeFilter,
    } = body

    const result = await query(
      `UPDATE load_suggestion_polygons SET
        name = COALESCE($1, name),
        coordinates = COALESCE($2, coordinates),
        color = COALESCE($3, color),
        match_on = COALESCE($4, match_on),
        max_footage = $5,
        max_stops = $6,
        only_unassigned_type = $7,
        load_type_filter = $8
       WHERE id = $9
       RETURNING 
        id, name, coordinates, color, match_on as "matchOn",
        max_footage as "maxFootage", max_stops as "maxStops",
        only_unassigned_type as "onlyUnassignedType",
        load_type_filter as "loadTypeFilter",
        is_active as "isActive"`,
      [
        name || null,
        coordinates ? JSON.stringify(coordinates) : null,
        color || null,
        matchOn || null,
        maxFootage ?? null,
        maxStops ?? null,
        onlyUnassignedType ?? null,
        loadTypeFilter ? JSON.stringify(loadTypeFilter) : null,
        id,
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Polygon not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, polygon: result.rows[0] })
  } catch (error) {
    console.error('Error updating polygon:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid polygon ID' }, { status: 400 })
    }

    await query('DELETE FROM load_suggestion_polygons WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting polygon:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
