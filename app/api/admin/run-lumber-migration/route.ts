import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import fs from 'fs'
import path from 'path'

// POST /api/admin/run-lumber-migration - Run the lumber system migration (ADMIN ONLY)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'database/migrations/VERIFIED-lumber-complete-system.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Check existing tables
    const existingTables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'lumber_%'
      ORDER BY table_name
    `)

    // Run migration
    await query(migrationSQL)

    // Verify tables
    const newTables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'lumber_%'
      ORDER BY table_name
    `)

    // Check constraint
    const constraints = await query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'lumber_packs'
      AND constraint_type = 'UNIQUE'
    `)

    return NextResponse.json({
      success: true,
      message: 'Lumber system migration completed successfully',
      existingTables: existingTables.rows.length,
      tablesCreated: newTables.rows.length,
      tables: newTables.rows.map(t => t.table_name),
      constraints: constraints.rows.map(c => c.constraint_name)
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error.message,
      code: error.code
    }, { status: 500 })
  }
}
