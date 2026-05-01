import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
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
      return NextResponse.json({ success: false, error: 'Invalid group ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, maxFootage, maxStops, preferredDriverId, polygonIds } = body

    const client = await getClient()
    try {
      await client.query('BEGIN')

      await client.query(
        `UPDATE load_suggestion_groups SET
          name = COALESCE($1, name),
          max_footage = $2,
          max_stops = $3,
          preferred_driver_id = $4
         WHERE id = $5`,
        [name || null, maxFootage ?? null, maxStops ?? null, preferredDriverId ?? null, id]
      )

      if (polygonIds !== undefined) {
        await client.query('DELETE FROM load_suggestion_group_polygons WHERE group_id = $1', [id])
        if (polygonIds.length > 0) {
          const values = polygonIds
            .map((_: number, i: number) => `($1, $${i + 2})`)
            .join(', ')
          await client.query(
            `INSERT INTO load_suggestion_group_polygons (group_id, polygon_id) VALUES ${values}`,
            [id, ...polygonIds]
          )
        }
      }

      await client.query('COMMIT')

      const result = await query(
        `SELECT 
          g.id, g.name, g.max_footage as "maxFootage", g.max_stops as "maxStops",
          g.preferred_driver_id as "preferredDriverId", g.is_active as "isActive",
          COALESCE(
            json_agg(json_build_object('id', p.id, 'name', p.name, 'color', p.color))
            FILTER (WHERE p.id IS NOT NULL), '[]'
          ) as polygons
         FROM load_suggestion_groups g
         LEFT JOIN load_suggestion_group_polygons gp ON g.id = gp.group_id
         LEFT JOIN load_suggestion_polygons p ON gp.polygon_id = p.id
         WHERE g.id = $1
         GROUP BY g.id`,
        [id]
      )

      return NextResponse.json({ success: true, group: result.rows[0] })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating group:', error)
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
      return NextResponse.json({ success: false, error: 'Invalid group ID' }, { status: 400 })
    }

    await query('DELETE FROM load_suggestion_groups WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
