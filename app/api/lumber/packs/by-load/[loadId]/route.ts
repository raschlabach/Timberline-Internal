import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/packs/by-load/[loadId] - Get all packs for a load
export async function GET(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT 
        p.*,
        li.species,
        li.grade,
        li.thickness,
        l.load_id as load_load_id,
        lo_op.name as operator_name,
        lo_s1.name as stacker_1_name,
        lo_s2.name as stacker_2_name,
        lo_s3.name as stacker_3_name,
        lo_s4.name as stacker_4_name
      FROM lumber_packs p
      JOIN lumber_load_items li ON p.load_item_id = li.id
      JOIN lumber_loads l ON p.load_id = l.id
      LEFT JOIN lumber_operators lo_op ON p.operator_id = lo_op.id
      LEFT JOIN lumber_operators lo_s1 ON p.stacker_1_id = lo_s1.id
      LEFT JOIN lumber_operators lo_s2 ON p.stacker_2_id = lo_s2.id
      LEFT JOIN lumber_operators lo_s3 ON p.stacker_3_id = lo_s3.id
      LEFT JOIN lumber_operators lo_s4 ON p.stacker_4_id = lo_s4.id
      WHERE p.load_id = $1
      ORDER BY p.id`,
      [params.loadId]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching packs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
