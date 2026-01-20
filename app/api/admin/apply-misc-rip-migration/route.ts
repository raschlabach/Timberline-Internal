import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'database/migrations/add-misc-rip-system.sql')
    const migrationSql = fs.readFileSync(migrationPath, 'utf8')

    // Execute the migration
    await query(migrationSql)

    return NextResponse.json({ success: true, message: 'Misc rip migration applied successfully' })
  } catch (error: any) {
    console.error('Error applying misc rip migration:', error)
    return NextResponse.json({ 
      error: 'Failed to apply migration', 
      details: error?.message 
    }, { status: 500 })
  }
}
