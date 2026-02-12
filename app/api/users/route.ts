import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'
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

    // Check if user exists
    const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [id])
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Use a transaction to clean up all foreign key references before deleting
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // SET NULL on nullable foreign key references across the system
      // Lumber packs - operator and stacker references
      await client.query('UPDATE lumber_packs SET operator_id = NULL WHERE operator_id = $1', [id]).catch(() => {})
      await client.query('UPDATE lumber_packs SET stacker_1_id = NULL WHERE stacker_1_id = $1', [id]).catch(() => {})
      await client.query('UPDATE lumber_packs SET stacker_2_id = NULL WHERE stacker_2_id = $1', [id]).catch(() => {})
      await client.query('UPDATE lumber_packs SET stacker_3_id = NULL WHERE stacker_3_id = $1', [id]).catch(() => {})
      await client.query('UPDATE lumber_packs SET stacker_4_id = NULL WHERE stacker_4_id = $1', [id]).catch(() => {})

      // Lumber work sessions
      await client.query('UPDATE lumber_work_sessions SET user_id = NULL WHERE user_id = $1', [id]).catch(() => {})

      // Lumber loads - created_by
      await client.query('UPDATE lumber_loads SET created_by = NULL WHERE created_by = $1', [id]).catch(() => {})

      // Lumber load documents - uploaded_by
      await client.query('UPDATE lumber_load_documents SET uploaded_by = NULL WHERE uploaded_by = $1', [id]).catch(() => {})

      // Lumber load presets - created_by
      await client.query('UPDATE lumber_load_presets SET created_by = NULL WHERE created_by = $1', [id]).catch(() => {})

      // Document attachments - uploaded_by
      await client.query('UPDATE document_attachments SET uploaded_by = NULL WHERE uploaded_by = $1', [id]).catch(() => {})

      // Notifications - dismissed_by
      await client.query('UPDATE notifications SET dismissed_by = NULL WHERE dismissed_by = $1', [id]).catch(() => {})

      // Planner notes - created_by
      await client.query('UPDATE planner_notes SET created_by = NULL WHERE created_by = $1', [id]).catch(() => {})

      // Orders - created_by, last_edited_by
      await client.query('UPDATE orders SET created_by = NULL WHERE created_by = $1', [id]).catch(() => {})
      await client.query('UPDATE orders SET last_edited_by = NULL WHERE last_edited_by = $1', [id]).catch(() => {})

      // Dismissed quality warnings
      await client.query('UPDATE dismissed_quality_warnings SET dismissed_by = NULL WHERE dismissed_by = $1', [id]).catch(() => {})

      // Delete owned child records (these only make sense tied to this user)
      // Driver schedule events
      await client.query('DELETE FROM driver_schedule_events WHERE driver_id = $1', [id]).catch(() => {})

      // Driver customer notes
      await client.query('DELETE FROM driver_customer_notes WHERE driver_id = $1', [id]).catch(() => {})

      // Cross driver freight deductions referencing truckloads owned by this driver
      await client.query(`
        DELETE FROM cross_driver_freight_deductions 
        WHERE truckload_id IN (SELECT id FROM truckloads WHERE driver_id = $1)
      `, [id]).catch(() => {})

      // Truckload order assignments for this driver's truckloads
      await client.query(`
        DELETE FROM truckload_order_assignments 
        WHERE truckload_id IN (SELECT id FROM truckloads WHERE driver_id = $1)
      `, [id]).catch(() => {})

      // Route stops for this driver's truckloads
      await client.query(`
        DELETE FROM route_stops 
        WHERE truckload_id IN (SELECT id FROM truckloads WHERE driver_id = $1)
      `, [id]).catch(() => {})

      // Trailer layout items for this driver's truckloads
      await client.query(`
        DELETE FROM trailer_layout_items 
        WHERE trailer_layout_id IN (
          SELECT id FROM trailer_layouts WHERE truckload_id IN (SELECT id FROM truckloads WHERE driver_id = $1)
        )
      `, [id]).catch(() => {})

      // Trailer layouts for this driver's truckloads
      await client.query(`
        DELETE FROM trailer_layouts 
        WHERE truckload_id IN (SELECT id FROM truckloads WHERE driver_id = $1)
      `, [id]).catch(() => {})

      // Split loads referencing this driver's truckload assignments
      await client.query(`
        DELETE FROM split_loads 
        WHERE order_id IN (
          SELECT order_id FROM truckload_order_assignments 
          WHERE truckload_id IN (SELECT id FROM truckloads WHERE driver_id = $1)
        )
      `, [id]).catch(() => {})

      // Truckloads owned by this driver
      await client.query('DELETE FROM truckloads WHERE driver_id = $1', [id]).catch(() => {})

      // Driver pay settings and hours (ON DELETE CASCADE should handle, but be explicit)
      await client.query('DELETE FROM driver_pay_settings WHERE driver_id = $1', [id]).catch(() => {})
      await client.query('DELETE FROM driver_hours WHERE driver_id = $1', [id]).catch(() => {})

      // User price trend selections and favorite customer groups (ON DELETE CASCADE should handle)
      await client.query('DELETE FROM user_price_trend_selections WHERE user_id = $1', [id]).catch(() => {})
      await client.query('DELETE FROM favorite_customer_groups WHERE user_id = $1', [id]).catch(() => {})

      // Drivers table
      await client.query('DELETE FROM drivers WHERE user_id = $1', [id]).catch(() => {})

      // Finally, delete the user
      const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id])

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }

      await client.query('COMMIT')
      return NextResponse.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
