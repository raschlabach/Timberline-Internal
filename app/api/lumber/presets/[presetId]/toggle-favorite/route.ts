import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST /api/lumber/presets/[presetId]/toggle-favorite - Toggle favorite status
export async function POST(
  request: NextRequest,
  { params }: { params: { presetId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `UPDATE lumber_load_presets 
       SET is_favorite = NOT is_favorite
       WHERE id = $1
       RETURNING *`,
      [params.presetId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error toggling favorite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
