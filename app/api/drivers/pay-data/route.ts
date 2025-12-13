import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// GET /api/drivers/pay-data - Get truckloads, orders, quotes, and deductions for drivers in date range
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 })
    }

    // Check if tables exist, if not, apply migrations automatically
    try {
      const tableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('driver_pay_settings', 'driver_hours')
      `)
      const existingTables = tableCheck.rows.map((row: any) => row.table_name)
      if (!existingTables.includes('driver_pay_settings') || !existingTables.includes('driver_hours')) {
        // Tables don't exist, apply migrations
        console.log('Driver pay tables not found, applying migrations...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          
          if (!existingTables.includes('driver_pay_settings')) {
            const paySettingsSql = fs.readFileSync(
              path.join(migrationsDir, 'add-driver-pay-settings-table.sql'),
              'utf8'
            )
            await client.query(paySettingsSql)
            console.log('Created driver_pay_settings table')
          }

          if (!existingTables.includes('driver_hours')) {
            const driverHoursSql = fs.readFileSync(
              path.join(migrationsDir, 'add-driver-hours-table.sql'),
              'utf8'
            )
            await client.query(driverHoursSql)
            console.log('Created driver_hours table')
          }

          await client.query('COMMIT')
          console.log('Migrations applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying migrations:', migrationError)
          // Continue anyway - the error handling below will catch if tables are missing
        } finally {
          client.release()
        }
      }

      // Check if columns exist for the new rate structure
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'driver_pay_settings'
        AND column_name IN ('misc_driving_rate', 'maintenance_rate')
      `)
      const existingColumns = columnCheck.rows.map((row: any) => row.column_name)
      if (!existingColumns.includes('misc_driving_rate') || !existingColumns.includes('maintenance_rate')) {
        console.log('Driver pay rate columns not found, applying migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const ratesSql = fs.readFileSync(
            path.join(migrationsDir, 'update-driver-pay-settings-rates.sql'),
            'utf8'
          )
          await client.query(ratesSql)
          await client.query('COMMIT')
          console.log('Rate columns migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying rate columns migration:', migrationError)
        } finally {
          client.release()
        }
      }

      // Check if type column exists in driver_hours
      const hoursColumnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'driver_hours'
        AND column_name = 'type'
      `)
      if (hoursColumnCheck.rows.length === 0) {
        console.log('Driver hours type column not found, applying migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const typeSql = fs.readFileSync(
            path.join(migrationsDir, 'add-driver-hours-type.sql'),
            'utf8'
          )
          await client.query(typeSql)
          await client.query('COMMIT')
          console.log('Driver hours type column migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying driver hours type migration:', migrationError)
        } finally {
          client.release()
        }
      }
    } catch (migrationError) {
      console.error('Error checking/applying migrations:', migrationError)
      // Continue anyway - the error handling below will catch if tables are missing
    }

    // Get all truckloads for drivers in the date range
    const truckloadsResult = await query(`
      SELECT 
        t.id,
        t.driver_id as "driverId",
        TO_CHAR(t.start_date, 'YYYY-MM-DD') as "startDate",
        TO_CHAR(t.end_date, 'YYYY-MM-DD') as "endDate",
        t.bill_of_lading_number as "billOfLadingNumber",
        t.description,
        u.full_name as "driverName",
        d.color as "driverColor",
        COALESCE(t.pay_calculation_method, 'automatic') as "payCalculationMethod",
        t.pay_hours as "payHours",
        t.pay_manual_amount as "payManualAmount"
      FROM truckloads t
      LEFT JOIN users u ON t.driver_id = u.id
      LEFT JOIN drivers d ON u.id = d.user_id
      WHERE t.driver_id IS NOT NULL
        AND (
          (t.start_date >= $1::date AND t.start_date <= $2::date)
          OR (t.end_date >= $1::date AND t.end_date <= $2::date)
          OR (t.start_date <= $1::date AND t.end_date >= $2::date)
        )
      ORDER BY t.driver_id, t.start_date
    `, [startDate, endDate])

    // Check if pay calculation columns exist, if not, apply migration automatically
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'truckloads'
        AND column_name IN ('pay_calculation_method', 'pay_hours', 'pay_manual_amount')
      `)
      const existingColumns = columnCheck.rows.map((row: any) => row.column_name)
      if (!existingColumns.includes('pay_calculation_method') || !existingColumns.includes('pay_hours') || !existingColumns.includes('pay_manual_amount')) {
        console.log('Pay calculation columns not found, applying migration...')
        const client = await getClient()
        try {
          await client.query('BEGIN')
          const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, 'add-truckload-pay-calculation-fields.sql'),
            'utf8'
          )
          await client.query(migrationSql)
          await client.query('COMMIT')
          console.log('Pay calculation columns migration applied successfully')
        } catch (migrationError) {
          await client.query('ROLLBACK')
          console.error('Error applying pay calculation migration:', migrationError)
        } finally {
          client.release()
        }
      }
    } catch (migrationCheckError) {
      console.error('Error checking pay calculation columns:', migrationCheckError)
      // Continue anyway
    }

    const truckloads = truckloadsResult.rows
    const truckloadIds = truckloads.map(t => t.id)

    if (truckloadIds.length === 0) {
      return NextResponse.json({
        success: true,
        drivers: []
      })
    }

    // Get all orders for these truckloads
    const ordersResult = await query(`
      SELECT 
        o.id as "orderId",
        toa.truckload_id as "truckloadId",
        toa.assignment_type as "assignmentType",
        o.freight_quote as "freightQuote",
        COALESCE(
          (SELECT SUM(s.width * s.length * s.quantity) FROM skids s WHERE s.order_id = o.id),
          0
        ) + COALESCE(
          (SELECT SUM(v.width * v.length * v.quantity) FROM vinyl v WHERE v.order_id = o.id),
          0
        ) as footage,
        pc.customer_name as "pickupCustomerName",
        dc.customer_name as "deliveryCustomerName",
        COALESCE(o.middlefield, false) as "middlefield"
      FROM truckload_order_assignments toa
      JOIN orders o ON toa.order_id = o.id
      LEFT JOIN customers pc ON o.pickup_customer_id = pc.id
      LEFT JOIN customers dc ON o.delivery_customer_id = dc.id
      WHERE toa.truckload_id = ANY($1::int[])
      ORDER BY toa.truckload_id, toa.sequence_number
    `, [truckloadIds])

    // Get cross-driver freight deductions for these truckloads
    let deductionsResult
    try {
      deductionsResult = await query(`
        SELECT 
          id,
          truckload_id as "truckloadId",
          driver_name as "driverName",
          TO_CHAR(date, 'YYYY-MM-DD') as date,
          action,
          footage,
          dimensions,
          deduction,
          is_manual as "isManual",
          comment
        FROM cross_driver_freight_deductions
        WHERE truckload_id = ANY($1::int[])
        ORDER BY truckload_id, date
      `, [truckloadIds])
    } catch (err: any) {
      // If table doesn't exist, return empty result
      if (err?.message?.includes('does not exist') || err?.code === '42P01') {
        deductionsResult = { rows: [] }
      } else {
        throw err
      }
    }

    // Get driver pay settings for all drivers
    // Check if driver_pay_settings table exists first
    let driversResult
    try {
      driversResult = await query(`
        SELECT DISTINCT
          t.driver_id as "driverId",
          u.full_name as "driverName",
          d.color as "driverColor",
        COALESCE(dps.load_percentage, 30.00) as "loadPercentage",
        COALESCE(dps.misc_driving_rate, dps.hourly_rate, 30.00) as "miscDrivingRate",
        COALESCE(dps.maintenance_rate, 30.00) as "maintenanceRate"
        FROM truckloads t
        LEFT JOIN users u ON t.driver_id = u.id
        LEFT JOIN drivers d ON u.id = d.user_id
        LEFT JOIN driver_pay_settings dps ON t.driver_id = dps.driver_id
        WHERE t.driver_id IS NOT NULL
          AND (
            (t.start_date >= $1::date AND t.start_date <= $2::date)
            OR (t.end_date >= $1::date AND t.end_date <= $2::date)
            OR (t.start_date <= $1::date AND t.end_date >= $2::date)
          )
        ORDER BY u.full_name
      `, [startDate, endDate])
    } catch (err: any) {
      // If table doesn't exist, query without the join
      if (err?.message?.includes('does not exist') || err?.code === '42P01') {
        driversResult = await query(`
          SELECT DISTINCT
            t.driver_id as "driverId",
            u.full_name as "driverName",
            d.color as "driverColor",
            30.00 as "loadPercentage",
            30.00 as "hourlyRate"
          FROM truckloads t
          LEFT JOIN users u ON t.driver_id = u.id
          LEFT JOIN drivers d ON u.id = d.user_id
          WHERE t.driver_id IS NOT NULL
            AND (
              (t.start_date >= $1::date AND t.start_date <= $2::date)
              OR (t.end_date >= $1::date AND t.end_date <= $2::date)
              OR (t.start_date <= $1::date AND t.end_date >= $2::date)
            )
          ORDER BY u.full_name
        `, [startDate, endDate])
      } else {
        throw err
      }
    }

    // Get driver hours for all drivers in date range
    const driverIds = driversResult.rows.map(d => d.driverId)
    let driverHoursResult: { rows: any[] } = { rows: [] }
    if (driverIds.length > 0) {
      try {
        driverHoursResult = await query(`
        SELECT 
          id,
          driver_id as "driverId",
          TO_CHAR(date, 'YYYY-MM-DD') as date,
          description,
          hours,
          type
        FROM driver_hours
          WHERE driver_id = ANY($1::int[])
            AND date >= $2::date
            AND date <= $3::date
          ORDER BY driver_id, date, id
        `, [driverIds, startDate, endDate])
      } catch (err: any) {
        // If table doesn't exist, return empty array
        if (err?.message?.includes('does not exist') || err?.code === '42P01') {
          driverHoursResult = { rows: [] }
        } else {
          throw err
        }
      }
    }

    // Organize data by driver
    const driversMap = new Map()
    
    // Initialize drivers
    driversResult.rows.forEach(driver => {
      driversMap.set(driver.driverId, {
        driverId: driver.driverId,
        driverName: driver.driverName,
        driverColor: driver.driverColor,
        loadPercentage: parseFloat(driver.loadPercentage),
        miscDrivingRate: parseFloat(driver.miscDrivingRate || driver.hourlyRate || 30.00),
        maintenanceRate: parseFloat(driver.maintenanceRate || 30.00),
        truckloads: [],
        hours: []
      })
    })

    // Add truckloads to drivers
    truckloads.forEach(truckload => {
      const driver = driversMap.get(truckload.driverId)
      if (driver) {
        driver.truckloads.push({
          id: truckload.id,
          startDate: truckload.startDate,
          endDate: truckload.endDate,
          billOfLadingNumber: truckload.billOfLadingNumber,
          description: truckload.description,
          orders: [],
          deductions: [],
          payCalculationMethod: truckload.payCalculationMethod || 'automatic',
          payHours: truckload.payHours ? parseFloat(truckload.payHours) : null,
          payManualAmount: truckload.payManualAmount ? parseFloat(truckload.payManualAmount) : null
        })
      }
    })

    // Add orders to truckloads
    ordersResult.rows.forEach((order: any) => {
      const driver = driversMap.get(
        truckloads.find((t: any) => t.id === order.truckloadId)?.driverId
      )
      if (driver) {
        const truckload = driver.truckloads.find((t: any) => t.id === order.truckloadId)
        if (truckload) {
          truckload.orders.push({
            orderId: order.orderId,
            assignmentType: order.assignmentType,
            freightQuote: order.freightQuote ? parseFloat(order.freightQuote) : null,
            footage: parseFloat(order.footage) || 0,
            pickupCustomerName: order.pickupCustomerName,
            deliveryCustomerName: order.deliveryCustomerName,
            middlefield: order.middlefield || false
          })
        }
      }
    })

    // Add deductions to truckloads
    deductionsResult.rows.forEach((deduction: any) => {
      const driver = driversMap.get(
        truckloads.find((t: any) => t.id === deduction.truckloadId)?.driverId
      )
      if (driver) {
        const truckload = driver.truckloads.find((t: any) => t.id === deduction.truckloadId)
        if (truckload) {
          truckload.deductions.push({
            id: deduction.id,
            driverName: deduction.driverName,
            date: deduction.date,
            action: deduction.action,
            footage: parseFloat(deduction.footage) || 0,
            dimensions: deduction.dimensions,
            deduction: parseFloat(deduction.deduction) || 0,
            isManual: deduction.isManual,
            comment: deduction.comment,
            isAddition: deduction.isAddition || false
          })
        }
      }
    })

    // Add driver hours
    driverHoursResult.rows.forEach((hour: any) => {
      const driver = driversMap.get(hour.driverId)
      if (driver) {
        driver.hours.push({
          id: hour.id,
          date: hour.date,
          description: hour.description,
          hours: parseFloat(hour.hours) || 0,
          type: hour.type || 'misc_driving'
        })
      }
    })

    return NextResponse.json({
      success: true,
      drivers: Array.from(driversMap.values())
    })
  } catch (error) {
    console.error('Error fetching driver pay data:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch driver pay data',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}

