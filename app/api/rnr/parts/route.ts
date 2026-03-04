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
    const search = searchParams.get('search') || ''
    const customerId = searchParams.get('customer_id')
    const speciesId = searchParams.get('species_id')
    const productTypeId = searchParams.get('product_type_id')
    const profileId = searchParams.get('profile_id')
    const isActive = searchParams.get('is_active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let whereClause = 'WHERE 1=1'
    const params: (string | number | boolean)[] = []
    let paramIdx = 1

    if (search) {
      whereClause += ` AND (
        p.rnr_part_number ILIKE $${paramIdx} OR 
        p.customer_part_number ILIKE $${paramIdx} OR 
        p.description ILIKE $${paramIdx} OR
        p.qb_item_code ILIKE $${paramIdx}
      )`
      params.push(`%${search}%`)
      paramIdx++
    }

    if (customerId) {
      whereClause += ` AND p.customer_id = $${paramIdx}`
      params.push(parseInt(customerId))
      paramIdx++
    }

    if (speciesId) {
      whereClause += ` AND p.species_id = $${paramIdx}`
      params.push(parseInt(speciesId))
      paramIdx++
    }

    if (productTypeId) {
      whereClause += ` AND p.product_type_id = $${paramIdx}`
      params.push(parseInt(productTypeId))
      paramIdx++
    }

    if (profileId) {
      whereClause += ` AND p.profile_id = $${paramIdx}`
      params.push(parseInt(profileId))
      paramIdx++
    }

    if (isActive !== null && isActive !== '') {
      whereClause += ` AND p.is_active = $${paramIdx}`
      params.push(isActive === 'true')
      paramIdx++
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM rnr_parts p ${whereClause}`,
      params
    )

    const partsResult = await query(
      `SELECT 
        p.id, p.rnr_part_number, p.customer_part_number, p.description,
        p.thickness, p.width, p.length, p.board_feet, p.lineal_feet,
        p.layup_width, p.layup_length, p.pieces_per_layup,
        p.item_class, p.qb_item_code, p.price, p.is_active,
        p.created_at, p.updated_at,
        p.customer_id, p.species_id, p.product_type_id, p.profile_id,
        c.customer_name as customer_name,
        s.name as species_name,
        pt.name as product_type_name,
        pr.name as profile_name
      FROM rnr_parts p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN rnr_species s ON s.id = p.species_id
      LEFT JOIN rnr_product_types pt ON pt.id = p.product_type_id
      LEFT JOIN rnr_profiles pr ON pr.id = p.profile_id
      ${whereClause}
      ORDER BY c.customer_name ASC, p.rnr_part_number ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    )

    const filtersResult = await query(
      `SELECT
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'customer_name', c.customer_name))
          FILTER (WHERE c.id IS NOT NULL), '[]') AS customers,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name))
          FILTER (WHERE s.id IS NOT NULL), '[]') AS species,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', pt.id, 'name', pt.name))
          FILTER (WHERE pt.id IS NOT NULL), '[]') AS product_types,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', pr.id, 'name', pr.name))
          FILTER (WHERE pr.id IS NOT NULL), '[]') AS profiles
      FROM rnr_parts p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN rnr_species s ON s.id = p.species_id
      LEFT JOIN rnr_product_types pt ON pt.id = p.product_type_id
      LEFT JOIN rnr_profiles pr ON pr.id = p.profile_id
      WHERE p.is_active = true`,
    )

    const filters = filtersResult.rows[0] || {}

    return NextResponse.json({
      parts: partsResult.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      filters: {
        customers: filters.customers || [],
        species: filters.species || [],
        product_types: filters.product_types || [],
        profiles: filters.profiles || [],
      },
    })
  } catch (error: unknown) {
    console.error('Error fetching parts:', error)
    return NextResponse.json({ error: 'Failed to fetch parts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      rnr_part_number, customer_part_number, customer_id, description,
      species_id, product_type_id, profile_id, thickness, width, length,
      board_feet, lineal_feet, layup_width, layup_length, pieces_per_layup,
      item_class, qb_item_code, price
    } = body

    const result = await query(
      `INSERT INTO rnr_parts (
        rnr_part_number, customer_part_number, customer_id, description,
        species_id, product_type_id, profile_id, thickness, width, length,
        board_feet, lineal_feet, layup_width, layup_length, pieces_per_layup,
        item_class, qb_item_code, price
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        rnr_part_number, customer_part_number, customer_id, description,
        species_id, product_type_id, profile_id, thickness, width, length,
        board_feet, lineal_feet, layup_width, layup_length, pieces_per_layup,
        item_class, qb_item_code, price
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating part:', error)
    return NextResponse.json({ error: 'Failed to create part' }, { status: 500 })
  }
}
