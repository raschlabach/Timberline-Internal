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

    const groupId = parseInt(params.id)
    if (isNaN(groupId)) {
      return NextResponse.json({ success: false, error: 'Invalid group ID' }, { status: 400 })
    }

    const body = await request.json()
    const { polygonIds } = body

    if (!Array.isArray(polygonIds)) {
      return NextResponse.json({ success: false, error: 'polygonIds array is required' }, { status: 400 })
    }

    await query('DELETE FROM load_suggestion_group_polygons WHERE group_id = $1', [groupId])

    if (polygonIds.length > 0) {
      const values = polygonIds
        .map((_: number, i: number) => `($1, $${i + 2})`)
        .join(', ')
      await query(
        `INSERT INTO load_suggestion_group_polygons (group_id, polygon_id) VALUES ${values}`,
        [groupId, ...polygonIds]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating group polygons:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
