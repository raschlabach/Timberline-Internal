import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { hash } from 'bcrypt'

// GET /api/drivers - Get all drivers
export async function GET() {
  try {
    const result = await query(`
      SELECT 
        u.id,
        u.full_name as "fullName",
        u.username,
        d.color
      FROM users u
      INNER JOIN drivers d ON u.id = d.user_id
      WHERE u.role = 'driver'
      ORDER BY u.full_name ASC
    `)

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
    const { fullName, username, password, color } = await request.json()

    // Start a transaction since we need to insert into two tables
    await client.query('BEGIN')

    try {
      // Insert into users table first
      const userResult = await client.query(
        `INSERT INTO users (full_name, username, password_hash, role)
         VALUES ($1, $2, $3, 'driver')
         RETURNING id`,
        [fullName, username || null, password ? await hash(password, 10) : null]
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
    const { id, fullName, username, password, color } = await request.json()

    // Start a transaction
    await client.query('BEGIN')

    try {
      // Update users table
      const userUpdateQuery = password
        ? `UPDATE users 
           SET full_name = $1, username = $2, password_hash = $3
           WHERE id = $4`
        : `UPDATE users 
           SET full_name = $1, username = $2
           WHERE id = $4`

      const userParams = password
        ? [fullName, username || null, await hash(password, 10), id]
        : [fullName, username || null, id]

      await client.query(userUpdateQuery, userParams)

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