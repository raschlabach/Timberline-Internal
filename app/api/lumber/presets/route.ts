import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/presets - Get all presets with items
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT * FROM lumber_load_presets_with_items
      ORDER BY is_favorite DESC, supplier_name, preset_name
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching presets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/presets - Create a new preset
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.preset_name || !body.supplier_id || !body.items || body.items.length === 0) {
      return NextResponse.json({ 
        error: 'preset_name, supplier_id, and items are required' 
      }, { status: 400 })
    }

    // Insert the preset
    const presetResult = await query(
      `INSERT INTO lumber_load_presets (
        preset_name, 
        supplier_id, 
        supplier_location_id, 
        lumber_type, 
        pickup_or_delivery, 
        comments,
        is_favorite,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        body.preset_name,
        body.supplier_id,
        body.supplier_location_id || null,
        body.lumber_type || null,
        body.pickup_or_delivery || null,
        body.comments || null,
        body.is_favorite || false,
        session.user.id
      ]
    )

    const preset = presetResult.rows[0]

    // Insert preset items
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i]
      await query(
        `INSERT INTO lumber_load_preset_items (
          preset_id,
          species,
          grade,
          thickness,
          estimated_footage,
          price,
          display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          preset.id,
          item.species,
          item.grade,
          item.thickness,
          item.estimated_footage || null,
          item.price || null,
          i
        ]
      )
    }

    // Fetch the complete preset with items
    const completePreset = await query(
      'SELECT * FROM lumber_load_presets_with_items WHERE id = $1',
      [preset.id]
    )

    return NextResponse.json(completePreset.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating preset:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
