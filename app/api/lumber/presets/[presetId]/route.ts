import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/presets/[presetId] - Get a specific preset with items
export async function GET(
  request: NextRequest,
  { params }: { params: { presetId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      'SELECT * FROM lumber_load_presets_with_items WHERE id = $1',
      [params.presetId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching preset:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/lumber/presets/[presetId] - Update a preset
export async function PATCH(
  request: NextRequest,
  { params }: { params: { presetId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const presetId = params.presetId

    // Update preset
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.preset_name !== undefined) {
      updates.push(`preset_name = $${paramIndex++}`)
      values.push(body.preset_name)
    }
    if (body.supplier_id !== undefined) {
      updates.push(`supplier_id = $${paramIndex++}`)
      values.push(body.supplier_id)
    }
    if (body.supplier_location_id !== undefined) {
      updates.push(`supplier_location_id = $${paramIndex++}`)
      values.push(body.supplier_location_id)
    }
    if (body.lumber_type !== undefined) {
      updates.push(`lumber_type = $${paramIndex++}`)
      values.push(body.lumber_type)
    }
    if (body.pickup_or_delivery !== undefined) {
      updates.push(`pickup_or_delivery = $${paramIndex++}`)
      values.push(body.pickup_or_delivery)
    }
    if (body.comments !== undefined) {
      updates.push(`comments = $${paramIndex++}`)
      values.push(body.comments)
    }
    if (body.is_favorite !== undefined) {
      updates.push(`is_favorite = $${paramIndex++}`)
      values.push(body.is_favorite)
    }

    if (updates.length > 0) {
      values.push(presetId)
      await query(
        `UPDATE lumber_load_presets 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}`,
        values
      )
    }

    // Update items if provided
    if (body.items) {
      // Delete existing items
      await query('DELETE FROM lumber_load_preset_items WHERE preset_id = $1', [presetId])

      // Insert new items
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i]
        await query(
          `INSERT INTO lumber_load_preset_items (
            preset_id, species, grade, thickness, estimated_footage, price, display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [presetId, item.species, item.grade, item.thickness, 
           item.estimated_footage || null, item.price || null, i]
        )
      }
    }

    // Fetch updated preset
    const result = await query(
      'SELECT * FROM lumber_load_presets_with_items WHERE id = $1',
      [presetId]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating preset:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/presets/[presetId] - Delete a preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: { presetId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      'DELETE FROM lumber_load_presets WHERE id = $1 RETURNING *',
      [params.presetId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Preset deleted successfully' })
  } catch (error) {
    console.error('Error deleting preset:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
