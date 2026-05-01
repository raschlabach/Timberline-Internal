import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT 
        id, name, coordinates, color, match_on as "matchOn",
        max_footage as "maxFootage", max_stops as "maxStops",
        only_unassigned_type as "onlyUnassignedType",
        load_type_filter as "loadTypeFilter",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM load_suggestion_polygons
      WHERE is_active = true
      ORDER BY name
    `)

    return NextResponse.json({ success: true, polygons: result.rows })
  } catch (error) {
    console.error('Error fetching polygons:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      coordinates,
      color = '#3B82F6',
      matchOn = 'delivery',
      maxFootage = null,
      maxStops = null,
      onlyUnassignedType = null,
      loadTypeFilter = null,
    } = body

    if (!name || !coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Name and at least 3 coordinate points are required' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO load_suggestion_polygons 
        (name, coordinates, color, match_on, max_footage, max_stops, only_unassigned_type, load_type_filter, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING 
        id, name, coordinates, color, match_on as "matchOn",
        max_footage as "maxFootage", max_stops as "maxStops",
        only_unassigned_type as "onlyUnassignedType",
        load_type_filter as "loadTypeFilter",
        is_active as "isActive"`,
      [
        name,
        JSON.stringify(coordinates),
        color,
        matchOn,
        maxFootage,
        maxStops,
        onlyUnassignedType,
        loadTypeFilter ? JSON.stringify(loadTypeFilter) : null,
        (session.user as any).id,
      ]
    )

    return NextResponse.json({ success: true, polygon: result.rows[0] })
  } catch (error) {
    console.error('Error creating polygon:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
