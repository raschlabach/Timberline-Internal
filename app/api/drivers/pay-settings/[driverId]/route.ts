import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/drivers/pay-settings/[driverId] - Get driver's pay settings
export async function GET(
  request: NextRequest,
  { params }: { params: { driverId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(params.driverId)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid driver ID' }, { status: 400 })
    }

    const result = await query(`
      SELECT 
        driver_id as "driverId",
        load_percentage as "loadPercentage",
        COALESCE(misc_driving_rate, hourly_rate, 30.00) as "miscDrivingRate",
        COALESCE(maintenance_rate, 30.00) as "maintenanceRate"
      FROM driver_pay_settings
      WHERE driver_id = $1
    `, [driverId])

    if (result.rows.length === 0) {
      // Return default values if no settings exist
      return NextResponse.json({
        success: true,
        settings: {
          driverId,
          loadPercentage: 30.00,
          miscDrivingRate: 30.00,
          maintenanceRate: 30.00
        }
      })
    }

    return NextResponse.json({
      success: true,
      settings: result.rows[0]
    })
  } catch (error) {
    console.error('Error fetching driver pay settings:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch driver pay settings'
    }, { status: 500 })
  }
}

// PATCH /api/drivers/pay-settings/[driverId] - Update driver's pay settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: { driverId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const driverId = parseInt(params.driverId)
    if (isNaN(driverId)) {
      return NextResponse.json({ success: false, error: 'Invalid driver ID' }, { status: 400 })
    }

    const { loadPercentage, miscDrivingRate, maintenanceRate } = await request.json()

    if (loadPercentage === undefined || miscDrivingRate === undefined || maintenanceRate === undefined) {
      return NextResponse.json({ success: false, error: 'loadPercentage, miscDrivingRate, and maintenanceRate are required' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Check if settings exist
      const checkResult = await client.query(`
        SELECT driver_id FROM driver_pay_settings WHERE driver_id = $1
      `, [driverId])

      if (checkResult.rows.length === 0) {
        // Insert new settings
        await client.query(`
          INSERT INTO driver_pay_settings (driver_id, load_percentage, misc_driving_rate, maintenance_rate)
          VALUES ($1, $2, $3, $4)
        `, [driverId, loadPercentage, miscDrivingRate, maintenanceRate])
      } else {
        // Update existing settings
        await client.query(`
          UPDATE driver_pay_settings
          SET load_percentage = $1, misc_driving_rate = $2, maintenance_rate = $3, updated_at = CURRENT_TIMESTAMP
          WHERE driver_id = $4
        `, [loadPercentage, miscDrivingRate, maintenanceRate, driverId])
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        settings: {
          driverId,
          loadPercentage,
          miscDrivingRate,
          maintenanceRate
        }
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating driver pay settings:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update driver pay settings'
    }, { status: 500 })
  }
}

