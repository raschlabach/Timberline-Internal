import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT p.id, p.name, p.product_type_id, p.is_active,
              pt.name as product_type_name
       FROM rnr_profiles p
       LEFT JOIN rnr_product_types pt ON pt.id = p.product_type_id
       ORDER BY p.name`
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error fetching profiles:', error)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, product_type_id } = await request.json()
    const result = await query(
      `INSERT INTO rnr_profiles (name, product_type_id) VALUES ($1, $2) RETURNING *`,
      [name, product_type_id || null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating profile:', error)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }
}
