import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const result = await query(
      `SELECT u.id, u.username, u.full_name, u.email, u.role, u.is_active, u.created_at, u.updated_at,
              d.color as driver_color, d.phone as driver_phone
       FROM users u
       LEFT JOIN drivers d ON u.id = d.user_id
       ORDER BY u.full_name`
    )

    return NextResponse.json({ success: true, users: result.rows })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { username, password, fullName, email, role, isActive, driverColor, driverPhone } = body

    if (!username || !password || !fullName || !role) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Check if username already exists
    const existingUser = await query('SELECT id FROM users WHERE username = $1', [username])
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Username already exists' }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, email, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, full_name, email, role, is_active, created_at`,
      [username, hashedPassword, fullName, email || null, role, isActive !== false]
    )

    const newUser = result.rows[0]

    // If role is driver, also create driver record
    if (role === 'driver' && (driverColor || driverPhone)) {
      await query(
        `INSERT INTO drivers (user_id, color, phone) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET color = $2, phone = $3`,
        [newUser.id, driverColor || '#000000', driverPhone || null]
      )
    }

    return NextResponse.json({ success: true, user: newUser })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/users - Update a user
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, username, password, fullName, email, role, isActive, driverColor, driverPhone } = body

    if (!id || !username || !fullName || !role) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Check if username already exists for different user
    const existingUser = await query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id])
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Username already exists' }, { status: 400 })
    }

    let result
    if (password) {
      // Update with new password
      const hashedPassword = await bcrypt.hash(password, 10)
      result = await query(
        `UPDATE users 
         SET username = $1, password_hash = $2, full_name = $3, email = $4, role = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING id, username, full_name, email, role, is_active`,
        [username, hashedPassword, fullName, email || null, role, isActive !== false, id]
      )
    } else {
      // Update without changing password
      result = await query(
        `UPDATE users 
         SET username = $1, full_name = $2, email = $3, role = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id, username, full_name, email, role, is_active`,
        [username, fullName, email || null, role, isActive !== false, id]
      )
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Handle driver record
    if (role === 'driver') {
      // Upsert driver record
      await query(
        `INSERT INTO drivers (user_id, color, phone) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET color = $2, phone = $3`,
        [id, driverColor || '#000000', driverPhone || null]
      )
    } else {
      // Remove driver record if user is no longer a driver
      await query('DELETE FROM drivers WHERE user_id = $1', [id])
    }

    return NextResponse.json({ success: true, user: result.rows[0] })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/users - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 })
    }

    // Prevent deleting yourself
    if (id === String(session.user.id)) {
      return NextResponse.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 })
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
