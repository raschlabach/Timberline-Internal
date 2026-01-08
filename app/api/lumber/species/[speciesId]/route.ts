import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/species/[speciesId] - Update a species
export async function PATCH(
  request: NextRequest,
  { params }: { params: { speciesId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const result = await query(
      `UPDATE lumber_species
       SET name = COALESCE($1, name),
           display_order = COALESCE($2, display_order),
           is_active = COALESCE($3, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [body.name, body.display_order, body.is_active, params.speciesId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Species not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating species:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/species/[speciesId] - Deactivate a species
export async function DELETE(
  request: NextRequest,
  { params }: { params: { speciesId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `UPDATE lumber_species SET is_active = FALSE WHERE id = $1 RETURNING *`,
      [params.speciesId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Species not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating species:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
