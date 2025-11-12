import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // 1. Mark the truckload as completed
      await client.query(
        `UPDATE truckloads 
         SET is_completed = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [truckloadId]
      )

      // 2. Get all assignments for this truckload
      const assignmentsResult = await client.query(
        `SELECT 
          toa.order_id,
          toa.assignment_type,
          o.is_transfer_order
         FROM truckload_order_assignments toa
         JOIN orders o ON toa.order_id = o.id
         WHERE toa.truckload_id = $1`,
        [truckloadId]
      )

      // 3. For each assignment, mark skids and vinyl as picked up or delivered
      for (const assignment of assignmentsResult.rows) {
        const { order_id, assignment_type, is_transfer_order } = assignment

        // For pickup assignments, mark skids and vinyl as picked up
        if (assignment_type === 'pickup') {
          await client.query(
            `UPDATE skids 
             SET is_picked_up = true,
                 updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $1`,
            [order_id]
          )

          await client.query(
            `UPDATE vinyl 
             SET is_picked_up = true,
                 updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $1`,
            [order_id]
          )
        }

        // For delivery assignments, mark skids and vinyl as delivered
        if (assignment_type === 'delivery') {
          await client.query(
            `UPDATE skids 
             SET is_delivered = true,
                 updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $1`,
            [order_id]
          )

          await client.query(
            `UPDATE vinyl 
             SET is_delivered = true,
                 updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $1`,
            [order_id]
          )
        }
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Truckload completed successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error completing truckload:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to complete truckload'
    }, { status: 500 })
  }
} 