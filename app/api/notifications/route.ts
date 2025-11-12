import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const client = await getClient()
    try {
      const result = await client.query(
        `SELECT 
          n.id,
          n.type,
          n.title,
          n.message,
          n.order_id,
          n.document_attachment_id,
          n.is_dismissed,
          n.dismissed_by,
          n.dismissed_at,
          n.created_at,
          o.id as order_exists
         FROM notifications n
         LEFT JOIN orders o ON n.order_id = o.id
         WHERE n.is_dismissed = false
         ORDER BY n.created_at DESC`
      )

      return NextResponse.json({
        success: true,
        notifications: result.rows
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch notifications'
    }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationId } = await request.json()

    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'Notification ID required' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query(
        `UPDATE notifications 
         SET is_dismissed = true, 
             dismissed_by = $1, 
             dismissed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [session.user.id, notificationId]
      )

      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error dismissing notification:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to dismiss notification'
    }, { status: 500 })
  }
}
