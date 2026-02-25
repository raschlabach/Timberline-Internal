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
    const tabId = searchParams.get('tab_id')

    let sql = `
      SELECT p.id, p.tab_id, p.part_name, p.price_per_bf,
             p.customer_id, c.name AS customer_name,
             p.species_id, s.name AS species_name
      FROM part_builder_parts p
      JOIN part_builder_customers c ON c.id = p.customer_id
      JOIN part_builder_species s ON s.id = p.species_id
    `
    const params: string[] = []

    if (tabId) {
      sql += ' WHERE p.tab_id = $1'
      params.push(tabId)
    }

    sql += ' ORDER BY c.name, p.part_name, s.name'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching part builder parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tab_id, customer_id, species_id, part_name, price_per_bf } = body

    if (!tab_id || !customer_id || !species_id || !part_name?.trim() || price_per_bf === undefined) {
      return NextResponse.json(
        { error: 'tab_id, customer_id, species_id, part_name, and price_per_bf are required' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO part_builder_parts (tab_id, customer_id, species_id, part_name, price_per_bf)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tab_id, customer_id, species_id, part_name.trim(), price_per_bf]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error creating part builder part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, price_per_bf } = body

    if (!id || price_per_bf === undefined) {
      return NextResponse.json(
        { error: 'id and price_per_bf are required' },
        { status: 400 }
      )
    }

    await query(
      'UPDATE part_builder_parts SET price_per_bf = $1, updated_at = NOW() WHERE id = $2',
      [price_per_bf, id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating part builder part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await query('DELETE FROM part_builder_parts WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting part builder part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
