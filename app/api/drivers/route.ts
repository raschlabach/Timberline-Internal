import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { hash } from 'bcrypt'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/drivers - Get all drivers
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching drivers...')
    const result = await query(`
      SELECT 
        u.id,
        u.full_name,
        d.color
      FROM users u
      JOIN drivers d ON u.id = d.user_id
      WHERE u.role = 'driver'
      ORDER BY u.full_name
    `)

    console.log('Drivers query result:', result.rows)

    return NextResponse.json({
      success: true,
      drivers: result.rows
    })
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch drivers'
    }, { status: 500 })
  }
}

// POST /api/drivers - Create a new driver
export async function POST(request: Request) {
  const client = await getClient()
  
  try {
    const { fullName, color } = await request.json()

    if (!fullName || !color) {
      return NextResponse.json({
        success: false,
        error: 'Full name and color are required'
      }, { status: 400 })
    }

    // Start a transaction since we need to insert into two tables
    await client.query('BEGIN')

    try {
      // Insert into users table first (no username/password needed)
      const userResult = await client.query(
        `INSERT INTO users (full_name, username, password_hash, role)
         VALUES ($1, NULL, NULL, 'driver')
         RETURNING id`,
        [fullName.trim()]
      )

      // Insert into drivers table
      await client.query(
        `INSERT INTO drivers (user_id, color)
         VALUES ($1, $2)`,
        [userResult.rows[0].id, color]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Driver created successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error creating driver:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create driver'
    }, { status: 500 })
  }
}

// PUT /api/drivers - Update a driver
export async function PUT(request: Request) {
  const client = await getClient()
  
  try {
    const { id, fullName, color } = await request.json()

    if (!id || !fullName || !color) {
      return NextResponse.json({
        success: false,
        error: 'ID, full name, and color are required'
      }, { status: 400 })
    }

    // Start a transaction
    await client.query('BEGIN')

    try {
      // Update users table (only full name, no username/password changes)
      await client.query(
        `UPDATE users 
         SET full_name = $1
         WHERE id = $2`,
        [fullName.trim(), id]
      )

      // Update drivers table
      await client.query(
        `UPDATE drivers 
         SET color = $1
         WHERE user_id = $2`,
        [color, id]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Driver updated successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating driver:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update driver'
    }, { status: 500 })
  }
} 