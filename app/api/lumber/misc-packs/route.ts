import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST /api/lumber/misc-packs - Create a new misc pack
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { misc_order_id, pack_id } = body

    if (!misc_order_id) {
      return NextResponse.json({ error: 'misc_order_id is required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO misc_rip_packs (misc_order_id, pack_id)
       VALUES ($1, $2)
       RETURNING *`,
      [misc_order_id, pack_id || null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating misc pack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/lumber/misc-packs - Get finished misc packs with optional date filters (for rip bonus)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let sql = `
      SELECT 
        mp.*,
        mo.customer_name,
        mo.species,
        mo.grade,
        mo.thickness,
        lo_op.name as operator_name,
        lo_s1.name as stacker_1_name,
        lo_s2.name as stacker_2_name,
        lo_s3.name as stacker_3_name,
        lo_s4.name as stacker_4_name
      FROM misc_rip_packs mp
      JOIN misc_rip_orders mo ON mp.misc_order_id = mo.id
      LEFT JOIN lumber_operators lo_op ON mp.operator_id = lo_op.id
      LEFT JOIN lumber_operators lo_s1 ON mp.stacker_1_id = lo_s1.id
      LEFT JOIN lumber_operators lo_s2 ON mp.stacker_2_id = lo_s2.id
      LEFT JOIN lumber_operators lo_s3 ON mp.stacker_3_id = lo_s3.id
      LEFT JOIN lumber_operators lo_s4 ON mp.stacker_4_id = lo_s4.id
      WHERE mp.is_finished = TRUE
    `

    const params: any[] = []
    
    if (startDate) {
      params.push(startDate)
      sql += ` AND mp.finished_at >= $${params.length}`
    }
    if (endDate) {
      params.push(endDate)
      sql += ` AND mp.finished_at <= $${params.length}`
    }
    if (month && year) {
      params.push(parseInt(month), parseInt(year))
      sql += ` AND EXTRACT(MONTH FROM mp.finished_at) = $${params.length - 1} AND EXTRACT(YEAR FROM mp.finished_at) = $${params.length}`
    }

    sql += ' ORDER BY mp.finished_at DESC'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching finished misc packs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
