import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/loads/[loadId]/assign-driver - Assign driver and pickup date
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
         driver_id = $1,
         assigned_pickup_date = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [body.driver_id, body.assigned_pickup_date, params.loadId]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error assigning driver:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
