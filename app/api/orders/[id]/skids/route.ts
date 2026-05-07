import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, query } from '@/lib/db'

interface DimensionInput {
  width: number
  length: number
  quantity: number
}

// PATCH /api/orders/[id]/skids
//
// Replaces the skids and vinyl rows for an order in one transaction.
// The legacy /api/orders/[id] PATCH performs a full-order update that
// would clobber other fields (quote, comments, etc.) when called with
// a partial body — this narrow endpoint exists so the payroll page can
// edit skid / vinyl details without touching anything else.
//
// Body shape:
// { skidsData: [{ width, length, quantity }, ...],
//   vinylData: [{ width, length, quantity }, ...] }
//
// Both arrays are required; pass an empty array to clear that side.
// Footage on each row is computed server-side as width * length so the
// client can't drift out of sync.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const orderId = parseInt(params.id, 10)
  if (Number.isNaN(orderId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid order ID' },
      { status: 400 }
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

  const skidsData = sanitizeDimensions(body?.skidsData)
  const vinylData = sanitizeDimensions(body?.vinylData)

  if (!skidsData || !vinylData) {
    return NextResponse.json(
      {
        success: false,
        error:
          'skidsData and vinylData must be arrays of { width, length, quantity }',
      },
      { status: 400 }
    )
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const exists = await client.query('SELECT id FROM orders WHERE id = $1', [
      orderId,
    ])
    if (exists.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    await client.query('DELETE FROM skids WHERE order_id = $1', [orderId])
    for (const skid of skidsData) {
      const footage = skid.width * skid.length
      await client.query(
        `INSERT INTO skids (order_id, width, length, square_footage, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, skid.width, skid.length, footage, skid.quantity]
      )
    }

    await client.query('DELETE FROM vinyl WHERE order_id = $1', [orderId])
    for (const vinyl of vinylData) {
      const footage = vinyl.width * vinyl.length
      await client.query(
        `INSERT INTO vinyl (order_id, width, length, square_footage, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, vinyl.width, vinyl.length, footage, vinyl.quantity]
      )
    }

    await client.query(
      `UPDATE orders
         SET updated_at = NOW(),
             last_edited_by = $1,
             last_edited_at = NOW()
       WHERE id = $2`,
      [session.user.id, orderId]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating skids/vinyl:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update freight' },
      { status: 500 }
    )
  } finally {
    client.release()
  }

  // Recompute totals AFTER the transaction commits so the caller can
  // patch its local state (footage / skid count) without a full refetch.
  const totalsRow = await query(
    `SELECT
       COALESCE((SELECT SUM(square_footage * quantity) FROM skids WHERE order_id = $1), 0) AS skid_footage,
       COALESCE((SELECT SUM(quantity) FROM skids WHERE order_id = $1), 0) AS skid_count,
       COALESCE((SELECT SUM(square_footage * quantity) FROM vinyl WHERE order_id = $1), 0) AS vinyl_footage`,
    [orderId]
  )

  const skidFootage = parseFloat(String(totalsRow.rows[0].skid_footage)) || 0
  const vinylFootage = parseFloat(String(totalsRow.rows[0].vinyl_footage)) || 0
  const skidCount = parseInt(String(totalsRow.rows[0].skid_count), 10) || 0

  return NextResponse.json({
    success: true,
    skidsData,
    vinylData,
    footage: skidFootage + vinylFootage,
    skidCount,
  })
}

function sanitizeDimensions(raw: unknown): DimensionInput[] | null {
  if (!Array.isArray(raw)) return null
  const out: DimensionInput[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const width = Number((entry as any).width)
    const length = Number((entry as any).length)
    const quantity = Number((entry as any).quantity)
    if (!Number.isFinite(width) || width < 0) return null
    if (!Number.isFinite(length) || length < 0) return null
    if (!Number.isFinite(quantity) || quantity < 0) return null
    // Drop zero-quantity rows — clients shouldn't send these but be
    // defensive so a stray empty row in the editor doesn't pollute the
    // DB with phantom skids.
    if (quantity === 0) continue
    out.push({ width, length, quantity })
  }
  return out
}
