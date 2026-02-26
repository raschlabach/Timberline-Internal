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
    const { itemId, customerId } = body as {
      itemId: number
      customerId: number
    }

    if (!itemId || !customerId) {
      client.release()
      return NextResponse.json(
        { error: 'Item ID and customer ID are required' },
        { status: 400 }
      )
    }

    await client.query('BEGIN')

    // Update the item's matched customer
    await client.query(
      `UPDATE dyoder_import_items
       SET matched_customer_id = $1,
           customer_matched = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [customerId, itemId]
    )

    // Get the customer_name for this item to save the mapping
    const itemResult = await client.query(
      `SELECT customer_name FROM dyoder_import_items WHERE id = $1`,
      [itemId]
    )

    if (itemResult.rows.length > 0) {
      const dyoderName = itemResult.rows[0].customer_name.trim()

      if (dyoderName) {
        // Upsert the mapping so future imports auto-match this name
        await client.query(
          `INSERT INTO dyoder_customer_map (dyoder_name, customer_id)
           VALUES ($1, $2)
           ON CONFLICT (dyoder_name)
           DO UPDATE SET customer_id = $2, updated_at = CURRENT_TIMESTAMP`,
          [dyoderName, customerId]
        )
      }
    }

    // Also update any other pending items in ANY import with the same customer name
    const customerName = itemResult.rows[0]?.customer_name?.trim()
    if (customerName) {
      await client.query(
        `UPDATE dyoder_import_items
         SET matched_customer_id = $1,
             customer_matched = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE customer_name = $2
           AND status = 'pending'
           AND id != $3`,
        [customerId, customerName, itemId]
      )
    }

    await client.query('COMMIT')

    return NextResponse.json({ success: true })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Error matching customer:', error)
    return NextResponse.json(
      { error: 'Failed to match customer' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
