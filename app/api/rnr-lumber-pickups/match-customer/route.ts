import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const client = await getClient()

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      client.release()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { supplierId, customerId, plantId } = body as {
      supplierId: number
      customerId: number
      plantId?: number | null
    }

    if (!supplierId || !customerId) {
      client.release()
      return NextResponse.json(
        { error: 'Supplier ID and customer ID are required' },
        { status: 400 }
      )
    }

    const existingResult = await client.query(
      plantId
        ? `SELECT id FROM rnr_supplier_customer_map WHERE supplier_id = $1 AND plant_id = $2`
        : `SELECT id FROM rnr_supplier_customer_map WHERE supplier_id = $1 AND plant_id IS NULL`,
      plantId ? [supplierId, plantId] : [supplierId]
    )

    if (existingResult.rows.length > 0) {
      await client.query(
        `UPDATE rnr_supplier_customer_map SET customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [customerId, existingResult.rows[0].id]
      )
    } else {
      await client.query(
        `INSERT INTO rnr_supplier_customer_map (supplier_id, customer_id, plant_id) VALUES ($1, $2, $3)`,
        [supplierId, customerId, plantId || null]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error matching RNR supplier to customer:', error)
    return NextResponse.json(
      { error: 'Failed to match customer' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
