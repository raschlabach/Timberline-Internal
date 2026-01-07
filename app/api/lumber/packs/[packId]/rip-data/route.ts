import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/packs/[packId]/rip-data - Update pack rip data
export async function PATCH(
  request: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const result = await query(
      `UPDATE lumber_packs
       SET 
         actual_board_feet = $1,
         rip_yield = $2,
         rip_comments = $3,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        body.actual_board_feet,
        body.rip_yield,
        body.rip_comments,
        params.packId
      ]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating pack rip data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
