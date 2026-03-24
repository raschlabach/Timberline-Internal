import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { withTransaction } from '@/lib/db'
import type { PoolClient } from 'pg'

interface TransactionInput {
  transactionDate: string
  merchantName: string
  merchantCity: string
  state: string
  invoiceNumber: string
  odometer: number
  productCode: string
  quantity: number
  unitCost: number
  transAmount: number
}

interface VehicleInput {
  vehicleDescription: string
  matchedTruckId: number | null
  transactions: TransactionInput[]
}

interface SaveBody {
  filename: string
  dateFrom: string
  dateTo: string
  vehicles: VehicleInput[]
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SaveBody = await request.json()
    const { filename, dateFrom, dateTo, vehicles } = body

    if (!filename || !dateFrom || !dateTo || !vehicles?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const totalTransactions = vehicles.reduce((sum, v) => sum + v.transactions.length, 0)

    const result = await withTransaction(async (client: PoolClient) => {
      const importResult = await client.query(
        `INSERT INTO fuel_report_imports (filename, date_from, date_to, total_transactions, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [filename, dateFrom, dateTo, totalTransactions, session.user.id]
      )
      const importId = importResult.rows[0].id

      let imported = 0
      let skipped = 0

      for (const vehicle of vehicles) {
        for (const txn of vehicle.transactions) {
          try {
            await client.query(
              `INSERT INTO fuel_external_transactions
                (import_id, truck_id, transaction_date, merchant_name, merchant_city, state,
                 invoice_number, odometer, product_code, quantity, unit_cost, trans_amount, vehicle_description)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                importId,
                vehicle.matchedTruckId,
                txn.transactionDate,
                txn.merchantName,
                txn.merchantCity,
                txn.state,
                txn.invoiceNumber,
                txn.odometer || null,
                txn.productCode,
                txn.quantity,
                txn.unitCost,
                txn.transAmount,
                vehicle.vehicleDescription,
              ]
            )
            imported++
          } catch (err: unknown) {
            const pgErr = err as { code?: string }
            if (pgErr.code === '23505') {
              skipped++
            } else {
              throw err
            }
          }
        }
      }

      return { importId, imported, skipped }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error saving fuel import:', error)
    return NextResponse.json({ error: 'Failed to save import' }, { status: 500 })
  }
}
