import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { promises as fs } from 'fs'
import path from 'path'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const migrationFilePath = path.join(process.cwd(), 'database', 'migrations', 'fix-pack-operator-references.sql')
    const migrationSql = await fs.readFile(migrationFilePath, 'utf-8')

    // Execute each statement separately
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 100) + '...')
      await query(statement)
    }

    return NextResponse.json({ success: true, message: 'Pack operator references migration applied successfully.' })
  } catch (error: any) {
    console.error('Error applying pack operators migration:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to apply migration', 
      details: error.message 
    }, { status: 500 })
  }
}
