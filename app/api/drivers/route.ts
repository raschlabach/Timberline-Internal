import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { hash } from 'bcrypt'
import { randomBytes } from 'crypto'
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
    const body = await request.json()
    console.log('Driver creation request:', { body: { ...body, fullName: body.fullName || body.name } })
    
    const name = String(body.name ?? body.fullName ?? '').trim()
    const explicitUsername = String(body.username ?? '').trim()
    const color = body.color

    // Return 400 if name is missing
    if (!name) {
      client.release()
      return NextResponse.json({
        success: false,
        error: 'Name is required'
      }, { status: 400 })
    }

    if (!color) {
      client.release()
      return NextResponse.json({
        success: false,
        error: 'Color is required'
      }, { status: 400 })
    }

    // Derive username from name or explicit username
    const base = explicitUsername || name || 'driver'
    const username = base.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    console.log('Derived username:', username)

    // Generate a random password hash for drivers (they don't need to log in)
    // Use a random string that will never be guessed
    const randomPassword = randomBytes(32).toString('hex')
    const passwordHash = await hash(randomPassword, 10)
    console.log('Generated password hash for driver')

    // Start a transaction since we need to insert into two tables
    await client.query('BEGIN')
    console.log('Transaction started for driver creation')

    try {
      // Generate unique username with retry logic
      const unique = username || 'driver'
      let finalUsername = unique
      let tries = 0
      let userId: number | null = null

      while (tries < 3) {
        try {
          console.log(`Attempting to create user with username: ${finalUsername} (try ${tries + 1}/3)`)
          const userResult = await client.query(
            `INSERT INTO users (username, password_hash, full_name, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, 'driver', true, now(), now())
             RETURNING id`,
            [finalUsername, passwordHash, name || null]
          )
          userId = userResult.rows[0].id
          console.log('User created with ID:', userId)
          break
        } catch (e: any) {
          console.log('User creation attempt failed:', { 
            message: e.message, 
            code: e.code,
            username: finalUsername 
          })
          if (String(e.message).includes('duplicate') || e.code === '23505') {
            finalUsername = `${unique}_${Math.floor(Math.random() * 1e6)}`
            tries++
            continue
          }
          throw e
        }
      }

      if (!userId) {
        throw new Error('Failed to create user after retries')
      }

      // Insert into drivers table
      console.log('Inserting driver record for user:', userId)
      await client.query(
        `INSERT INTO drivers (user_id, color)
         VALUES ($1, $2)`,
        [userId, color]
      )
      console.log('Driver record created')

      await client.query('COMMIT')
      console.log('Transaction committed successfully')

      return NextResponse.json({
        success: true,
        message: 'Driver created successfully'
      })
    } catch (error) {
      console.error('Error in driver creation transaction:', error)
      try {
        await client.query('ROLLBACK')
        console.log('Rollback successful')
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError)
      }
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error creating driver:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : { error: String(error) }
    console.error('Error details:', errorDetails)
    return NextResponse.json({
      success: false,
      error: errorMessage || 'Failed to create driver',
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
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