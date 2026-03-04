import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT 
        p.*, 
        c.customer_name,
        s.name as species_name,
        pt.name as product_type_name,
        pr.name as profile_name
      FROM rnr_parts p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN rnr_species s ON s.id = p.species_id
      LEFT JOIN rnr_product_types pt ON pt.id = p.product_type_id
      LEFT JOIN rnr_profiles pr ON pr.id = p.profile_id
      WHERE p.id = $1`,
      [params.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    console.error('Error fetching part:', error)
    return NextResponse.json({ error: 'Failed to fetch part' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      item_class, qb_item_code, price, is_active
    } = body

    const result = await query(
      `UPDATE rnr_parts SET
        rnr_part_number = $1, customer_part_number = $2, customer_id = $3,
        description = $4, species_id = $5, product_type_id = $6, profile_id = $7,
        thickness = $8, width = $9, length = $10, board_feet = $11, lineal_feet = $12,
        layup_width = $13, layup_length = $14, pieces_per_layup = $15,
        item_class = $16, qb_item_code = $17, price = $18, is_active = $19,
        updated_at = NOW()
      WHERE id = $20
      RETURNING *`,
      [
        rnr_part_number, customer_part_number, customer_id, description,
        species_id, product_type_id, profile_id, thickness, width, length,
        board_feet, lineal_feet, layup_width, layup_length, pieces_per_layup,
        item_class, qb_item_code, price, is_active,
        params.id
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    console.error('Error updating part:', error)
    return NextResponse.json({ error: 'Failed to update part' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `UPDATE rnr_parts SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [params.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deactivating part:', error)
    return NextResponse.json({ error: 'Failed to deactivate part' }, { status: 500 })
  }
}
