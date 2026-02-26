import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
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
      `UPDATE vinyl_tech_import_items
       SET matched_customer_id = $1,
           customer_matched = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [customerId, itemId]
    )

    // Get the VT code and ship_to_name for this item to save the mapping
    const itemResult = await client.query(
      `SELECT vt_code, ship_to_name FROM vinyl_tech_import_items WHERE id = $1`,
      [itemId]
    )

    if (itemResult.rows.length > 0 && itemResult.rows[0].vt_code) {
      const vtCode = itemResult.rows[0].vt_code.trim()
      const shipToName = itemResult.rows[0].ship_to_name

      if (vtCode) {
        // Upsert the mapping so future imports auto-match this VT code
        await client.query(
          `INSERT INTO vinyl_tech_customer_map (vt_code, customer_id, ship_to_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (vt_code)
           DO UPDATE SET customer_id = $2, ship_to_name = $3, updated_at = CURRENT_TIMESTAMP`,
          [vtCode, customerId, shipToName]
        )
      }
    }

    // Also update any other pending items in ANY import with the same VT code
    const vtCode = itemResult.rows[0]?.vt_code?.trim()
    if (vtCode) {
      await client.query(
        `UPDATE vinyl_tech_import_items
         SET matched_customer_id = $1,
             customer_matched = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE vt_code = $2
           AND status = 'pending'
           AND id != $3`,
        [customerId, vtCode, itemId]
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
