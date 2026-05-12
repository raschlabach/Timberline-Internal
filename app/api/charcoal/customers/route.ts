import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCharcoalSession, forbidden, unauthorized } from '@/lib/charcoal-auth'

export async function POST(request: Request) {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const body = await request.json()
    const { name, contact_name, phone, email, notes, is_walnut_creek } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO charcoal_customers (name, contact_name, phone, email, notes, is_walnut_creek)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name.trim(), contact_name || null, phone || null, email || null, notes || null, is_walnut_creek ?? false]
    )

    return NextResponse.json({ customer: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating charcoal customer:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { role } = await getCharcoalSession()
    if (!role) return unauthorized()
    if (role !== 'office') return forbidden()

    const result = await query(
      `SELECT id, name, contact_name, phone, email, notes, is_walnut_creek, created_at, updated_at
       FROM charcoal_customers
       ORDER BY name ASC`
    )

    return NextResponse.json({ customers: result.rows })
  } catch (error) {
    console.error('Error fetching charcoal customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}
