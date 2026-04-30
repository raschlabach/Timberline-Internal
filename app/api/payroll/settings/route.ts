import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// Single-row settings table holding payroll-level config (right now,
// just the global fuel surcharge percentage used to compute the
// QuickBooks invoice total). Anyone authenticated can read; only
// admins can write.

interface PayrollSettings {
  fuelSurchargePercentage: number
}

async function readSettings(): Promise<PayrollSettings> {
  const result = await query(
    `SELECT fuel_surcharge_percentage FROM payroll_settings WHERE id = 1`
  )
  if (result.rows.length === 0) {
    return { fuelSurchargePercentage: 0 }
  }
  const raw = result.rows[0].fuel_surcharge_percentage
  return {
    fuelSurchargePercentage: parseFloat(String(raw)) || 0,
  }
}

// GET /api/payroll/settings — returns the current global payroll settings.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const settings = await readSettings()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Error reading payroll settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to read payroll settings' },
      { status: 500 }
    )
  }
}

// PATCH /api/payroll/settings — admin-only updates.
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  const { fuelSurchargePercentage } = body
  if (
    typeof fuelSurchargePercentage !== 'number' ||
    !Number.isFinite(fuelSurchargePercentage) ||
    fuelSurchargePercentage < 0 ||
    fuelSurchargePercentage > 100
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'fuelSurchargePercentage must be a number between 0 and 100',
      },
      { status: 400 }
    )
  }

  try {
    await query(
      `INSERT INTO payroll_settings (id, fuel_surcharge_percentage, updated_at)
       VALUES (1, $1, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE
       SET fuel_surcharge_percentage = EXCLUDED.fuel_surcharge_percentage,
           updated_at = CURRENT_TIMESTAMP`,
      [fuelSurchargePercentage]
    )
    const settings = await readSettings()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Error updating payroll settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update payroll settings' },
      { status: 500 }
    )
  }
}
