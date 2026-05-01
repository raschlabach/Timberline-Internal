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
        g.id, g.name,
        g.max_footage as "maxFootage",
        g.max_stops as "maxStops",
        g.preferred_driver_id as "preferredDriverId",
        g.is_active as "isActive",
        g.created_at as "createdAt",
        COALESCE(
          json_agg(
            json_build_object('id', p.id, 'name', p.name, 'color', p.color)
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as polygons,
        COALESCE(u.full_name, NULL) as "preferredDriverName"
      FROM load_suggestion_groups g
      LEFT JOIN load_suggestion_group_polygons gp ON g.id = gp.group_id
      LEFT JOIN load_suggestion_polygons p ON gp.polygon_id = p.id
      LEFT JOIN users u ON g.preferred_driver_id = u.id
      WHERE g.is_active = true
      GROUP BY g.id, u.full_name
      ORDER BY g.name
    `)

    return NextResponse.json({ success: true, groups: result.rows })
  } catch (error) {
    console.error('Error fetching groups:', error)
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
      maxFootage = null,
      maxStops = null,
      preferredDriverId = null,
      polygonIds = [],
    } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    const groupResult = await query(
      `INSERT INTO load_suggestion_groups (name, max_footage, max_stops, preferred_driver_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, max_footage as "maxFootage", max_stops as "maxStops",
                 preferred_driver_id as "preferredDriverId", is_active as "isActive"`,
      [name, maxFootage, maxStops, preferredDriverId, (session.user as any).id]
    )

    const group = groupResult.rows[0]

    if (polygonIds.length > 0) {
      const values = polygonIds
        .map((_: number, i: number) => `($1, $${i + 2})`)
        .join(', ')
      await query(
        `INSERT INTO load_suggestion_group_polygons (group_id, polygon_id) VALUES ${values}`,
        [group.id, ...polygonIds]
      )
    }

    return NextResponse.json({ success: true, group })
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
