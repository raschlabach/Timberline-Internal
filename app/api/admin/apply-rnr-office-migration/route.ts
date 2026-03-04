import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const migrationPath = path.join(process.cwd(), 'database/migrations/20260304_add_rnr_office.sql')
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8')

    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      await query(statement)
    }

    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'rnr_%'
      ORDER BY table_name
    `)

    return NextResponse.json({
      success: true,
      message: 'RNR Office migration applied successfully',
      tables: tables.rows.map((t: { table_name: string }) => t.table_name)
    })
  } catch (error: unknown) {
    console.error('Error applying RNR Office migration:', error)
    return NextResponse.json({
      error: 'Failed to apply migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
