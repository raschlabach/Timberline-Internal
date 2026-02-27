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
    const { supplierId, customerId } = body as {
      supplierId: number
      customerId: number
    }

    if (!supplierId || !customerId) {
      client.release()
      return NextResponse.json(
        { error: 'Supplier ID and customer ID are required' },
        { status: 400 }
      )
    }

    await client.query(
      `INSERT INTO rnr_supplier_customer_map (supplier_id, customer_id)
       VALUES ($1, $2)
       ON CONFLICT (supplier_id)
       DO UPDATE SET customer_id = $2, updated_at = CURRENT_TIMESTAMP`,
      [supplierId, customerId]
    )

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
