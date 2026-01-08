import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST /api/lumber/loads/bulk-create - Create multiple loads with shared fields
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { shared_fields, items } = body

    if (!shared_fields || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid request: shared_fields and items required' }, { status: 400 })
    }

    // Validate each item has required fields
    for (const item of items) {
      if (!item.load_id || !item.species || !item.grade || !item.thickness) {
        return NextResponse.json({ 
          error: 'Each item must have load_id, species, grade, and thickness' 
        }, { status: 400 })
      }
    }

    // Check for duplicate load IDs in the request
    const loadIds = items.map((item: any) => item.load_id)
    const uniqueLoadIds = new Set(loadIds)
    if (uniqueLoadIds.size !== loadIds.length) {
      return NextResponse.json({ error: 'Duplicate load IDs in request' }, { status: 400 })
    }

    // Check if any load IDs already exist in the database
    const existingLoadsResult = await query(
      `SELECT load_id FROM lumber_loads WHERE load_id = ANY($1::text[])`,
      [loadIds]
    )

    if (existingLoadsResult.rows.length > 0) {
      const existingIds = existingLoadsResult.rows.map(row => row.load_id).join(', ')
      return NextResponse.json({ 
        error: `Load ID(s) already exist: ${existingIds}` 
      }, { status: 409 })
    }

    // Create all loads
    const createdLoads = []
    
    for (const item of items) {
      // Insert the load
      const loadResult = await query(
        `INSERT INTO lumber_loads (
          load_id, 
          supplier_id, 
          supplier_location_id, 
          lumber_type, 
          pickup_or_delivery, 
          estimated_delivery_date, 
          comments,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          item.load_id,
          shared_fields.supplier_id,
          shared_fields.supplier_location_id || null,
          shared_fields.lumber_type || null,
          shared_fields.pickup_or_delivery || null,
          shared_fields.estimated_delivery_date || null,
          shared_fields.comments || null,
          session.user.id
        ]
      )

      const load = loadResult.rows[0]

      // Insert the load item (species/grade/thickness combination)
      await query(
        `INSERT INTO lumber_load_items (
          load_id,
          species,
          grade,
          thickness,
          estimated_footage,
          price
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          load.id,
          item.species,
          item.grade,
          item.thickness,
          item.estimated_footage || null,
          item.price || null
        ]
      )

      createdLoads.push(load)
    }

    return NextResponse.json({ 
      success: true,
      created: createdLoads.length,
      loads: createdLoads
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating loads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
