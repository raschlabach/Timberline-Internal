import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient } from '@/lib/db'

// PATCH /api/truckloads/[id]/assignments/[orderId]/exclude-from-load-value
// Update the exclude_from_load_value flag for a specific assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; orderId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    const orderId = parseInt(params.orderId)
    
    if (isNaN(truckloadId) || isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload or order ID' }, { status: 400 })
    }

    const body = await request.json()
    const { assignmentType, excludeFromLoadValue } = body

    if (!assignmentType || typeof excludeFromLoadValue !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const client = await getClient()
    try {
      // Update the exclude_from_load_value flag for the specific assignment
      const result = await client.query(`
        UPDATE truckload_order_assignments
        SET exclude_from_load_value = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE truckload_id = $2
          AND order_id = $3
          AND assignment_type = $4
        RETURNING id
      `, [excludeFromLoadValue, truckloadId, orderId, assignmentType])

      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating exclude from load value:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update exclude from load value'
    }, { status: 500 })
  }
}

