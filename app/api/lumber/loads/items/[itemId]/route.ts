import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/loads/items/[itemId] - Update load item
export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
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

    // Allow updating all load item fields
    if (body.species !== undefined) {
      updates.push(`species = $${paramIndex++}`)
      values.push(body.species)
    }

    if (body.grade !== undefined) {
      updates.push(`grade = $${paramIndex++}`)
      values.push(body.grade)
    }

    if (body.thickness !== undefined) {
      updates.push(`thickness = $${paramIndex++}`)
      values.push(body.thickness)
    }

    if (body.estimated_footage !== undefined) {
      updates.push(`estimated_footage = $${paramIndex++}`)
      values.push(body.estimated_footage)
    }

    if (body.actual_footage !== undefined) {
      updates.push(`actual_footage = $${paramIndex++}`)
      values.push(body.actual_footage)
      
      // Set actual_footage_entered_at timestamp when footage is first entered
      // Only set if actual_footage is being set to a non-null value and timestamp isn't already set
      if (body.actual_footage !== null) {
        updates.push(`actual_footage_entered_at = COALESCE(actual_footage_entered_at, CURRENT_TIMESTAMP)`)
      }
    }

    if (body.price !== undefined) {
      updates.push(`price = $${paramIndex++}`)
      values.push(body.price)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)

    values.push(params.itemId)
    const result = await query(
      `UPDATE lumber_load_items 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
