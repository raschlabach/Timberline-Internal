import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting price precision migration...')

    // Read the safe migration file (handles views)
    const migrationPath = path.join(process.cwd(), 'database/migrations/change-price-precision-safe.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // Execute the migration
    await query(sql)

    console.log('Price precision migration completed successfully')

    return NextResponse.json({ 
      success: true, 
      message: 'Price precision updated to 3 decimal places' 
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('Error applying price precision migration:', err)
    return NextResponse.json(
      { error: 'Failed to apply migration', details: err.message },
      { status: 500 }
    )
  }
}
