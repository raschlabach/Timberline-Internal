import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { CreateLoadFormData } from '@/types/lumber'

// GET /api/lumber/loads - Get all loads
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT 
        l.*,
        s.name as supplier_name,
        sl.location_name,
        sl.phone_number_1,
        sl.phone_number_2,
        d.name as driver_name,
        json_agg(
          json_build_object(
            'id', li.id,
            'species', li.species,
            'grade', li.grade,
            'thickness', li.thickness,
            'estimated_footage', li.estimated_footage,
            'actual_footage', li.actual_footage,
            'price', li.price
          )
        ) as items
      FROM lumber_loads l
      JOIN lumber_suppliers s ON l.supplier_id = s.id
      LEFT JOIN lumber_supplier_locations sl ON l.supplier_location_id = sl.id
      LEFT JOIN lumber_drivers d ON l.driver_id = d.id
      LEFT JOIN lumber_load_items li ON l.id = li.load_id
      GROUP BY l.id, s.name, sl.location_name, sl.phone_number_1, sl.phone_number_2, d.name
      ORDER BY l.created_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching loads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/loads - Create a new load
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateLoadFormData = await request.json()

    // Validate required fields
    if (!body.load_id || !body.supplier_id || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if load_id already exists
    const existingLoad = await query(
      'SELECT id FROM lumber_loads WHERE load_id = $1',
      [body.load_id]
    )
    
    if (existingLoad.rows.length > 0) {
      return NextResponse.json(
        { error: 'Load ID already exists' },
        { status: 400 }
      )
    }

    // Start transaction
    await query('BEGIN')

    try {
      // Insert load
      const loadResult = await query(
        `INSERT INTO lumber_loads (
          load_id, supplier_id, supplier_location_id, lumber_type,
          pickup_or_delivery, estimated_delivery_date, comments, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          body.load_id,
          body.supplier_id,
          body.supplier_location_id,
          body.lumber_type,
          body.pickup_or_delivery,
          body.estimated_delivery_date,
          body.comments,
          session.user.id
        ]
      )

      const loadId = loadResult.rows[0].id

      // Insert load items
      for (const item of body.items) {
        await query(
          `INSERT INTO lumber_load_items (
            load_id, species, grade, thickness, estimated_footage, price
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            loadId,
            item.species,
            item.grade,
            item.thickness,
            item.estimated_footage,
            item.price
          ]
        )
      }

      await query('COMMIT')

      return NextResponse.json(loadResult.rows[0], { status: 201 })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error creating load:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
