import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      'DELETE FROM grain_tickets WHERE id = $1 RETURNING id',
      [parseInt(params.id)]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting grain ticket:', error)
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      ticket_date,
      ticket_type,
      gross_weight_lbs,
      tare_weight_lbs,
      net_weight_lbs,
      moisture_percent,
      moisture_deduction_lbs,
      dockage_percent,
      dockage_deduction_lbs,
      adjusted_net_weight_lbs,
      bushels,
      notes,
    } = body

    const result = await query(
      `UPDATE grain_tickets SET
        ticket_date = $1, ticket_type = $2, gross_weight_lbs = $3, tare_weight_lbs = $4,
        net_weight_lbs = $5, moisture_percent = $6, moisture_deduction_lbs = $7,
        dockage_percent = $8, dockage_deduction_lbs = $9, adjusted_net_weight_lbs = $10,
        bushels = $11, notes = $12
       WHERE id = $13
       RETURNING *`,
      [
        ticket_date,
        ticket_type,
        gross_weight_lbs,
        tare_weight_lbs,
        net_weight_lbs,
        moisture_percent || null,
        moisture_deduction_lbs || 0,
        dockage_percent || null,
        dockage_deduction_lbs || 0,
        adjusted_net_weight_lbs,
        bushels,
        notes || null,
        parseInt(params.id),
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({ ticket: result.rows[0] })
  } catch (error) {
    console.error('Error updating grain ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
