import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// GET /api/lumber/packs/finished - Get all finished packs with optional date filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let sql = `
      SELECT 
        p.*,
        li.species,
        li.grade,
        li.thickness,
        l.load_id as load_load_id,
        u_op.full_name as operator_name,
        u_s1.full_name as stacker_1_name,
        u_s2.full_name as stacker_2_name,
        u_s3.full_name as stacker_3_name,
        u_s4.full_name as stacker_4_name
      FROM lumber_packs p
      JOIN lumber_load_items li ON p.load_item_id = li.id
      JOIN lumber_loads l ON p.load_id = l.id
      LEFT JOIN users u_op ON p.operator_id = u_op.id
      LEFT JOIN users u_s1 ON p.stacker_1_id = u_s1.id
      LEFT JOIN users u_s2 ON p.stacker_2_id = u_s2.id
      LEFT JOIN users u_s3 ON p.stacker_3_id = u_s3.id
      LEFT JOIN users u_s4 ON p.stacker_4_id = u_s4.id
      WHERE p.is_finished = TRUE
    `

    const params: any[] = []
    if (startDate) {
      params.push(startDate)
      sql += ` AND p.finished_at >= $${params.length}`
    }
    if (endDate) {
      params.push(endDate)
      sql += ` AND p.finished_at <= $${params.length}`
    }

    sql += ' ORDER BY p.finished_at DESC'

    const result = await query(sql, params)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching finished packs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
