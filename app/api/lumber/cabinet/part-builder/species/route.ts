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
      'SELECT id, name FROM part_builder_species ORDER BY name'
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching part builder species:', error)
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
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO part_builder_species (name) VALUES ($1)
       ON CONFLICT (name) DO NOTHING
       RETURNING id, name`,
      [body.name.trim()]
    )

    if (result.rows.length === 0) {
      const existing = await query(
        'SELECT id, name FROM part_builder_species WHERE name = $1',
        [body.name.trim()]
      )
      return NextResponse.json(existing.rows[0])
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error creating part builder species:', error)
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

    await query('DELETE FROM part_builder_species WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting part builder species:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
