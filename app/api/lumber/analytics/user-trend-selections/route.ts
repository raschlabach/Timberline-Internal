import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/analytics/user-trend-selections - Get user's saved trend selections
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if table exists first
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_price_trend_selections'
      ) as table_exists
    `)
    
    if (!tableCheck.rows[0]?.table_exists) {
      return NextResponse.json([]) // Return empty array if table doesn't exist yet
    }

    const result = await query(`
      SELECT species, grade
      FROM user_price_trend_selections
      WHERE user_id = $1
      ORDER BY species, grade
    `, [session.user?.id])

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching user trend selections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lumber/analytics/user-trend-selections - Save user's trend selections
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if table exists first
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_price_trend_selections'
      ) as table_exists
    `)
    
    if (!tableCheck.rows[0]?.table_exists) {
      return NextResponse.json({ 
        error: 'Migration not applied. Please run the user trend selections migration first.' 
      }, { status: 400 })
    }

    const body = await request.json()
    const { selections } = body // Array of { species, grade }

    if (!Array.isArray(selections)) {
      return NextResponse.json({ error: 'selections must be an array' }, { status: 400 })
    }

    const userId = session.user?.id

    // Delete all existing selections for this user
    await query(`
      DELETE FROM user_price_trend_selections
      WHERE user_id = $1
    `, [userId])

    // Insert new selections
    if (selections.length > 0) {
      const values = selections.map((s, idx) => 
        `($1, $${idx * 2 + 2}, $${idx * 2 + 3})`
      ).join(', ')
      
      const params = [userId]
      selections.forEach(s => {
        params.push(s.species, s.grade)
      })

      await query(`
        INSERT INTO user_price_trend_selections (user_id, species, grade)
        VALUES ${values}
        ON CONFLICT (user_id, species, grade) DO NOTHING
      `, params)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving user trend selections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
