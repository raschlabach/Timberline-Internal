import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/packs/finished - Get all finished packs with optional date filters
// Includes both regular packs (from lumber_packs) and misc packs (from misc_rip_packs)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    // Build date filter conditions
    let dateConditionRegular = ''
    let dateConditionMisc = ''
    const params: any[] = []
    
    if (startDate) {
      params.push(startDate)
      dateConditionRegular += ` AND p.finished_at >= $${params.length}`
      dateConditionMisc += ` AND mp.finished_at >= $${params.length}`
    }
    if (endDate) {
      params.push(endDate)
      dateConditionRegular += ` AND p.finished_at <= $${params.length}`
      dateConditionMisc += ` AND mp.finished_at <= $${params.length}`
    }
    if (month && year) {
      params.push(parseInt(month), parseInt(year))
      dateConditionRegular += ` AND EXTRACT(MONTH FROM p.finished_at) = $${params.length - 1} AND EXTRACT(YEAR FROM p.finished_at) = $${params.length}`
      dateConditionMisc += ` AND EXTRACT(MONTH FROM mp.finished_at) = $${params.length - 1} AND EXTRACT(YEAR FROM mp.finished_at) = $${params.length}`
    }

    // Query for regular packs
    const regularPacksSql = `
      SELECT 
        p.id,
        p.pack_id,
        p.load_id,
        p.load_item_id,
        p.length,
        p.tally_board_feet,
        p.actual_board_feet,
        p.rip_yield,
        p.rip_comments,
        p.is_finished,
        p.finished_at,
        p.operator_id,
        p.stacker_1_id,
        p.stacker_2_id,
        p.stacker_3_id,
        p.stacker_4_id,
        p.created_at,
        p.updated_at,
        li.species,
        li.grade,
        li.thickness,
        l.load_id as load_load_id,
        lo_op.name as operator_name,
        lo_s1.name as stacker_1_name,
        lo_s2.name as stacker_2_name,
        lo_s3.name as stacker_3_name,
        lo_s4.name as stacker_4_name,
        'rnr' as pack_type
      FROM lumber_packs p
      JOIN lumber_load_items li ON p.load_item_id = li.id
      JOIN lumber_loads l ON p.load_id = l.id
      LEFT JOIN lumber_operators lo_op ON p.operator_id = lo_op.id
      LEFT JOIN lumber_operators lo_s1 ON p.stacker_1_id = lo_s1.id
      LEFT JOIN lumber_operators lo_s2 ON p.stacker_2_id = lo_s2.id
      LEFT JOIN lumber_operators lo_s3 ON p.stacker_3_id = lo_s3.id
      LEFT JOIN lumber_operators lo_s4 ON p.stacker_4_id = lo_s4.id
      WHERE p.is_finished = TRUE${dateConditionRegular}
    `

    // Query for misc packs
    const miscPacksSql = `
      SELECT 
        mp.id,
        mp.pack_id,
        NULL as load_id,
        NULL as load_item_id,
        NULL as length,
        NULL as tally_board_feet,
        mp.actual_board_feet,
        mp.rip_yield,
        mp.rip_comments,
        mp.is_finished,
        mp.finished_at,
        mp.operator_id,
        mp.stacker_1_id,
        mp.stacker_2_id,
        mp.stacker_3_id,
        mp.stacker_4_id,
        mp.created_at,
        mp.updated_at,
        mo.species,
        mo.grade,
        mo.thickness,
        'MISC: ' || mo.customer_name as load_load_id,
        lo_op.name as operator_name,
        lo_s1.name as stacker_1_name,
        lo_s2.name as stacker_2_name,
        lo_s3.name as stacker_3_name,
        lo_s4.name as stacker_4_name,
        'misc' as pack_type
      FROM misc_rip_packs mp
      JOIN misc_rip_orders mo ON mp.misc_order_id = mo.id
      LEFT JOIN lumber_operators lo_op ON mp.operator_id = lo_op.id
      LEFT JOIN lumber_operators lo_s1 ON mp.stacker_1_id = lo_s1.id
      LEFT JOIN lumber_operators lo_s2 ON mp.stacker_2_id = lo_s2.id
      LEFT JOIN lumber_operators lo_s3 ON mp.stacker_3_id = lo_s3.id
      LEFT JOIN lumber_operators lo_s4 ON mp.stacker_4_id = lo_s4.id
      WHERE mp.is_finished = TRUE${dateConditionMisc}
    `

    // Combine both queries with UNION ALL and order by finished_at
    const combinedSql = `
      (${regularPacksSql})
      UNION ALL
      (${miscPacksSql})
      ORDER BY finished_at DESC
    `

    const result = await query(combinedSql, params)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching finished packs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
