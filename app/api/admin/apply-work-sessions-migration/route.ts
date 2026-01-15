import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'database/migrations/add-operator-id-to-work-sessions.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement)
      }
    }

    return NextResponse.json({ success: true, message: 'Migration applied successfully' })
  } catch (error) {
    console.error('Error applying migration:', error)
    return NextResponse.json({ 
      error: 'Failed to apply migration', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
