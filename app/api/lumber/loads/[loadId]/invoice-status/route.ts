import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/loads/[loadId]/invoice-status - Update invoice status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const result = await query(
      `UPDATE lumber_loads
       SET 
         entered_in_quickbooks = $1,
         is_paid = $2,
         paid_at = CASE WHEN $2 = TRUE THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [body.entered_in_quickbooks, body.is_paid, params.loadId]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating invoice status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
