import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH /api/truckloads/[id]/assignments/[assignmentId] - Update an assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; assignmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    const assignmentId = parseInt(params.assignmentId)
    
    if (isNaN(truckloadId) || isNaN(assignmentId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload or assignment ID' }, { status: 400 })
    }

    const body = await request.json()
    const { excludeFromLoadValue } = body

    if (excludeFromLoadValue === undefined) {
      return NextResponse.json({ success: false, error: 'Missing excludeFromLoadValue field' }, { status: 400 })
    }

    // Verify the assignment belongs to this truckload
    const verifyResult = await query(
      `SELECT id FROM truckload_order_assignments 
       WHERE id = $1 AND truckload_id = $2`,
      [assignmentId, truckloadId]
    )

    if (verifyResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Assignment not found or does not belong to this truckload' }, { status: 404 })
    }

    // Update the exclude_from_load_value field
    const result = await query(
      `UPDATE truckload_order_assignments 
       SET exclude_from_load_value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND truckload_id = $3
       RETURNING id, exclude_from_load_value`,
      [excludeFromLoadValue === true, assignmentId, truckloadId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Failed to update assignment' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      assignment: {
        id: result.rows[0].id,
        excludeFromLoadValue: result.rows[0].exclude_from_load_value
      }
    })
  } catch (error) {
    console.error('Error updating assignment:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update assignment'
    }, { status: 500 })
  }
}

