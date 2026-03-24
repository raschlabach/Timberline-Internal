import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const result = await query(`
      SELECT
        fet.id,
        fet.transaction_date,
        fet.merchant_name,
        fet.merchant_city,
        fet.state,
        fet.invoice_number,
        fet.odometer,
        fet.product_code,
        fet.quantity,
        fet.unit_cost,
        fet.trans_amount,
        fet.vehicle_description,
        fet.truck_id,
        ft.name as truck_name
      FROM fuel_external_transactions fet
      LEFT JOIN fuel_trucks ft ON fet.truck_id = ft.id
      WHERE fet.transaction_date >= $1 AND fet.transaction_date <= $2
      ORDER BY ft.name ASC, fet.transaction_date ASC
    `, [startDate, endDate])

    const totalAmount = result.rows.reduce(
      (sum: number, r: { trans_amount: string }) => sum + (parseFloat(r.trans_amount) || 0),
      0
    )
    const totalQuantity = result.rows.reduce(
      (sum: number, r: { quantity: string }) => sum + (parseFloat(r.quantity) || 0),
      0
    )

    return NextResponse.json({
      transactions: result.rows,
      totalAmount,
      totalQuantity,
    })
  } catch (error) {
    console.error('Error fetching external transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch external transactions' }, { status: 500 })
  }
}
