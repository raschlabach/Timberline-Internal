import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/misc-orders/[orderId]/packs - Get all packs for a misc order
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT 
        mp.*,
        lo_op.name as operator_name,
        lo_s1.name as stacker_1_name,
        lo_s2.name as stacker_2_name,
        lo_s3.name as stacker_3_name,
        lo_s4.name as stacker_4_name
      FROM misc_rip_packs mp
      LEFT JOIN lumber_operators lo_op ON mp.operator_id = lo_op.id
      LEFT JOIN lumber_operators lo_s1 ON mp.stacker_1_id = lo_s1.id
      LEFT JOIN lumber_operators lo_s2 ON mp.stacker_2_id = lo_s2.id
      LEFT JOIN lumber_operators lo_s3 ON mp.stacker_3_id = lo_s3.id
      LEFT JOIN lumber_operators lo_s4 ON mp.stacker_4_id = lo_s4.id
      WHERE mp.misc_order_id = $1
      ORDER BY mp.created_at ASC`,
      [params.orderId]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching misc packs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
