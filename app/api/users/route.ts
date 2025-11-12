import { NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { hash } from 'bcrypt'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/users - Get all users (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    console.log('Fetching all users...')
    const result = await query(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at,
        d.color as driver_color,
        d.phone as driver_phone
      FROM users u
      LEFT JOIN drivers d ON u.id = d.user_id
      ORDER BY u.created_at DESC
    `)

    console.log('Users query result:', result.rows)

    return NextResponse.json({
      success: true,
      users: result.rows
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch users'
    }, { status: 500 })
  }
}

// POST /api/users - Create a new user (admin only)
export async function POST(request: Request) {
  const client = await getClient()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { username, password, fullName, email, role, driverColor, driverPhone } = await request.json()

    // Validate required fields
    if (!username || !password || !fullName || !role) {
      return NextResponse.json({
        success: false,
        error: 'Username, password, full name, and role are required'
      }, { status: 400 })
    }

    // Validate role
    if (!['admin', 'user', 'driver'].includes(role)) {
      return NextResponse.json({
        success: false,
        error: 'Role must be admin, user, or driver'
      }, { status: 400 })
    }

    // Start a transaction
    await client.query('BEGIN')

    try {
      // Check if username already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      )

      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Username already exists'
        }, { status: 400 })
      }

      // Hash password
      const passwordHash = await hash(password, 10)

      // Insert into users table
      const userResult = await client.query(
        `INSERT INTO users (username, password_hash, full_name, email, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, username, full_name, email, role, is_active, created_at`,
        [username, passwordHash, fullName, email || null, role, true]
      )

      const newUser = userResult.rows[0]

      // If role is driver, insert into drivers table
      if (role === 'driver') {
        await client.query(
          `INSERT INTO drivers (user_id, color, phone)
           VALUES ($1, $2, $3)`,
          [newUser.id, driverColor || '#000000', driverPhone || null]
        )
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'User created successfully',
        user: newUser
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create user'
    }, { status: 500 })
  }
}

// PUT /api/users - Update a user (admin only)
export async function PUT(request: Request) {
  const client = await getClient()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { id, username, password, fullName, email, role, isActive, driverColor, driverPhone } = await request.json()

    // Validate required fields
    if (!id || !username || !fullName || !role) {
      return NextResponse.json({
        success: false,
        error: 'ID, username, full name, and role are required'
      }, { status: 400 })
    }

    // Validate role
    if (!['admin', 'user', 'driver'].includes(role)) {
      return NextResponse.json({
        success: false,
        error: 'Role must be admin, user, or driver'
      }, { status: 400 })
    }

    // Start a transaction
    await client.query('BEGIN')

    try {
      // Check if username already exists (excluding current user)
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, id]
      )

      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Username already exists'
        }, { status: 400 })
      }

      // Update users table
      const userUpdateQuery = password
        ? `UPDATE users 
           SET username = $1, password_hash = $2, full_name = $3, email = $4, role = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
           WHERE id = $7
           RETURNING id, username, full_name, email, role, is_active, updated_at`
        : `UPDATE users 
           SET username = $1, full_name = $2, email = $3, role = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
           WHERE id = $6
           RETURNING id, username, full_name, email, role, is_active, updated_at`

      const userParams = password
        ? [username, await hash(password, 10), fullName, email || null, role, isActive, id]
        : [username, fullName, email || null, role, isActive, id]

      const userResult = await client.query(userUpdateQuery, userParams)

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 404 })
      }

      // Handle driver-specific updates
      if (role === 'driver') {
        // Check if driver record exists
        const driverExists = await client.query(
          'SELECT user_id FROM drivers WHERE user_id = $1',
          [id]
        )

        if (driverExists.rows.length > 0) {
          // Update existing driver record
          await client.query(
            `UPDATE drivers 
             SET color = $1, phone = $2
             WHERE user_id = $3`,
            [driverColor || '#000000', driverPhone || null, id]
          )
        } else {
          // Create new driver record
          await client.query(
            `INSERT INTO drivers (user_id, color, phone)
             VALUES ($1, $2, $3)`,
            [id, driverColor || '#000000', driverPhone || null]
          )
        }
      } else {
        // If role changed from driver to admin, remove driver record
        await client.query(
          'DELETE FROM drivers WHERE user_id = $1',
          [id]
        )
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'User updated successfully',
        user: userResult.rows[0]
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update user'
    }, { status: 500 })
  }
}

// DELETE /api/users - Delete a user (admin only)
export async function DELETE(request: Request) {
  const client = await getClient()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    // Prevent admin from deleting themselves
    if (parseInt(userId) === parseInt(session.user.id)) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete your own account'
      }, { status: 400 })
    }

    // Start a transaction
    await client.query('BEGIN')

    try {
      // Check if user exists
      const userExists = await client.query(
        'SELECT id, role FROM users WHERE id = $1',
        [userId]
      )

      if (userExists.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 404 })
      }

      // Delete from drivers table first (if exists)
      await client.query(
        'DELETE FROM drivers WHERE user_id = $1',
        [userId]
      )

      // Delete from users table
      await client.query(
        'DELETE FROM users WHERE id = $1',
        [userId]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'User deleted successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete user'
    }, { status: 500 })
  }
}
