import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/[loadId] - Get a specific load with items
export async function GET(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
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
        d.name as driver_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', li.id,
              'species', li.species,
              'grade', li.grade,
              'thickness', li.thickness,
              'estimated_footage', li.estimated_footage,
              'actual_footage', li.actual_footage,
              'price', li.price
            ) ORDER BY li.id
          ) FILTER (WHERE li.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM lumber_loads l
      LEFT JOIN lumber_suppliers s ON l.supplier_id = s.id
      LEFT JOIN lumber_supplier_locations sl ON l.supplier_location_id = sl.id
      LEFT JOIN lumber_drivers d ON l.driver_id = d.id
      LEFT JOIN lumber_load_items li ON l.id = li.load_id
      WHERE l.id = $1
      GROUP BY l.id, s.name, sl.location_name, d.name
    `, [params.loadId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching load:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/lumber/loads/[loadId] - Update load details
export async function PATCH(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Build dynamic update query
    const allowedFields = [
      'load_id', 'supplier_id', 'supplier_location_id', 'lumber_type', 'pickup_or_delivery',
      'estimated_delivery_date', 'comments',
      'actual_arrival_date', 'pickup_number', 'plant', 'pickup_date',
      'invoice_number', 'invoice_total', 'invoice_date', 'driver_id',
      'assigned_pickup_date', 'entered_in_quickbooks', 'is_paid', 'load_quality',
      'all_packs_tallied', 'all_packs_finished', 'po_generated', 'po_generated_at'
    ]
    
    // Map truck_driver_id to driver_id (frontend uses different name)
    if (body.truck_driver_id !== undefined) {
      body.driver_id = body.truck_driver_id
      delete body.truck_driver_id
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`)
        values.push(body[field])
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(params.loadId)
    const result = await query(
      `UPDATE lumber_loads 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating load:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/loads/[loadId] - Delete a load and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if load exists
    const loadCheck = await query(
      'SELECT id, load_id FROM lumber_loads WHERE id = $1',
      [params.loadId]
    )

    if (loadCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 })
    }

    // Delete related records first (due to foreign key constraints)
    // The CASCADE on foreign keys should handle this, but let's be explicit
    
    // Delete packs (associated with load items, which are associated with load)
    await query(
      'DELETE FROM lumber_packs WHERE load_id = $1',
      [params.loadId]
    )

    // Delete documents
    await query(
      'DELETE FROM lumber_load_documents WHERE load_id = $1',
      [params.loadId]
    )

    // Delete load items
    await query(
      'DELETE FROM lumber_load_items WHERE load_id = $1',
      [params.loadId]
    )

    // Finally delete the load itself
    await query(
      'DELETE FROM lumber_loads WHERE id = $1',
      [params.loadId]
    )

    return NextResponse.json({ 
      success: true, 
      message: `Load ${loadCheck.rows[0].load_id} deleted successfully` 
    })
  } catch (error) {
    console.error('Error deleting load:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
