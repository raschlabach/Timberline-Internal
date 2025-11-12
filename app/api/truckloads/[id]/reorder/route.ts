import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = await getClient()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    const body = await request.json()
    const { orders } = body

    if (!Array.isArray(orders)) {
      return NextResponse.json({ success: false, error: 'Invalid orders data' }, { status: 400 })
    }

    // Start transaction
    await client.query('BEGIN')

    try {
      // First, get all current assignments for this truckload
      const { rows: currentAssignments } = await client.query(
        `SELECT id, order_id, assignment_type, sequence_number 
         FROM truckload_order_assignments 
         WHERE truckload_id = $1`,
        [truckloadId]
      )

      // Create a map of current assignments for easy lookup
      const assignmentMap = new Map(
        currentAssignments.map(a => [`${a.order_id}-${a.assignment_type}`, a])
      )

      // Update sequence numbers for each order
      for (const order of orders) {
        const assignment = assignmentMap.get(`${order.id}-${order.assignment_type}`)
        if (assignment) {
          await client.query(
            `UPDATE truckload_order_assignments 
             SET sequence_number = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [order.sequence_number, assignment.id]
          )
        }
      }

      // Commit transaction
      await client.query('COMMIT')
      return NextResponse.json({ success: true })
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error reordering truckload stops:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to reorder stops'
    }, { status: 500 })
  } finally {
    client.release()
  }
} 