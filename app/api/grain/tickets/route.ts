import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const result = await query(
      `SELECT id, ticket_date, ticket_type, gross_weight_lbs, tare_weight_lbs, 
              net_weight_lbs, moisture_percent, moisture_deduction_lbs, 
              dockage_percent, dockage_deduction_lbs, adjusted_net_weight_lbs, 
              bushels, notes, created_at
       FROM grain_tickets 
       WHERE EXTRACT(YEAR FROM ticket_date) = $1
       ORDER BY ticket_date DESC, created_at DESC`,
      [parseInt(year)]
    )

    return NextResponse.json({ tickets: result.rows })
  } catch (error) {
    console.error('Error fetching grain tickets:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

    if (!ticket_type || !gross_weight_lbs || !tare_weight_lbs || !net_weight_lbs) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO grain_tickets 
        (ticket_date, ticket_type, gross_weight_lbs, tare_weight_lbs, net_weight_lbs,
         moisture_percent, moisture_deduction_lbs, dockage_percent, dockage_deduction_lbs,
         adjusted_net_weight_lbs, bushels, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        ticket_date || new Date().toISOString(),
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
        session.user.id,
      ]
    )

    return NextResponse.json({ ticket: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating grain ticket:', error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
