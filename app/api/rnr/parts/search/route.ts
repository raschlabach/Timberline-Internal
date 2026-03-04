import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const customerId = searchParams.get('customer_id')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (q.length < 1) {
      return NextResponse.json([])
    }

    let sql = `SELECT 
      p.id, p.rnr_part_number, p.customer_part_number, p.description,
      p.thickness, p.width, p.length, p.board_feet, p.lineal_feet,
      p.price, p.is_active, p.customer_id, p.species_id, p.product_type_id, p.profile_id,
      c.customer_name, s.name as species_name, pt.name as product_type_name, pr.name as profile_name
    FROM rnr_parts p
    LEFT JOIN customers c ON c.id = p.customer_id
    LEFT JOIN rnr_species s ON s.id = p.species_id
    LEFT JOIN rnr_product_types pt ON pt.id = p.product_type_id
    LEFT JOIN rnr_profiles pr ON pr.id = p.profile_id
    WHERE p.is_active = true
      AND (p.rnr_part_number ILIKE $1 OR p.customer_part_number ILIKE $1 OR p.description ILIKE $1 OR p.qb_item_code ILIKE $1)`

    const params: (string | number)[] = [`%${q}%`]
    let paramIdx = 2

    if (customerId) {
      sql += ` AND p.customer_id = $${paramIdx}`
      params.push(parseInt(customerId))
      paramIdx++
    }

    sql += ` ORDER BY p.rnr_part_number ASC LIMIT $${paramIdx}`
    params.push(limit)

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error searching parts:', error)
    return NextResponse.json({ error: 'Failed to search parts' }, { status: 500 })
  }
}
