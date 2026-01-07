import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/loads/[loadId]/quality - Update load quality
export async function PATCH(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const result = await query(
      `UPDATE lumber_loads
       SET 
         load_quality = $1,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [body.load_quality, params.loadId]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating load quality:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
