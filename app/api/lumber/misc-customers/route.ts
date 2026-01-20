import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/misc-customers - Get unique customer names for autocomplete
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `SELECT DISTINCT customer_name 
       FROM misc_rip_orders 
       ORDER BY customer_name ASC`
    )

    return NextResponse.json(result.rows.map(r => r.customer_name))
  } catch (error) {
    console.error('Error fetching misc customers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
