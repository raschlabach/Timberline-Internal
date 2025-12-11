import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'
import fs from 'fs'
import path from 'path'

/**
 * Migration endpoint to create driver_pay_settings and driver_hours tables
 * This will be called automatically if tables don't exist
 * 
 * Usage: POST /api/migrations/apply-driver-pay-tables
 * Requires: Authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Applying driver pay tables migration...')

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Check if tables already exist
      const checkResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('driver_pay_settings', 'driver_hours')
      `)

      const existingTables = checkResult.rows.map((row: any) => row.table_name)
      const allTablesExist = ['driver_pay_settings', 'driver_hours'].every(
        table => existingTables.includes(table)
      )

      if (allTablesExist) {
        await client.query('COMMIT')
        return NextResponse.json({
          success: true,
          message: 'Migration already applied - all tables exist',
          existingTables
        })
      }

      // Read and apply migrations
      const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
      
      // Apply driver_pay_settings migration
      if (!existingTables.includes('driver_pay_settings')) {
        const paySettingsSql = fs.readFileSync(
          path.join(migrationsDir, 'add-driver-pay-settings-table.sql'),
          'utf8'
        )
        await client.query(paySettingsSql)
        console.log('Created driver_pay_settings table')
      }

      // Apply driver_hours migration
      if (!existingTables.includes('driver_hours')) {
        const driverHoursSql = fs.readFileSync(
          path.join(migrationsDir, 'add-driver-hours-table.sql'),
          'utf8'
        )
        await client.query(driverHoursSql)
        console.log('Created driver_hours table')
      }

      await client.query('COMMIT')
      console.log('Migration applied successfully')

      return NextResponse.json({
        success: true,
        message: 'Migration applied successfully',
        createdTables: ['driver_pay_settings', 'driver_hours'].filter(
          table => !existingTables.includes(table)
        )
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error applying migration:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to apply migration'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

