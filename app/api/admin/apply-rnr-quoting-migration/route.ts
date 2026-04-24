import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const migrationPath = path.join(process.cwd(), 'database/migrations/20260424_rnr_quoting_module.sql')
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8')

    await query(migrationSql)

    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'rnr_machines', 'rnr_product_templates', 'rnr_product_machine_steps',
        'rnr_yield_defaults', 'rnr_quote_defaults', 'rnr_quotes', 'rnr_quote_machine_steps'
      )
      ORDER BY table_name
    `)

    return NextResponse.json({
      success: true,
      message: 'RNR Quoting Module migration applied successfully',
      tables: tables.rows.map((t: { table_name: string }) => t.table_name)
    })
  } catch (error: unknown) {
    console.error('Error applying RNR Quoting migration:', error)
    return NextResponse.json({
      error: 'Failed to apply migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
