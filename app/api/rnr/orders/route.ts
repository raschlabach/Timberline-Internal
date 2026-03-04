import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const customerId = searchParams.get('customer_id')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let whereClause = 'WHERE 1=1'
    const params: (string | number | boolean)[] = []
    let paramIdx = 1

    if (search) {
      whereClause += ` AND (o.order_number ILIKE $${paramIdx} OR o.po_number ILIKE $${paramIdx} OR c.customer_name ILIKE $${paramIdx})`
      params.push(`%${search}%`)
      paramIdx++
    }

    if (customerId) {
      whereClause += ` AND o.customer_id = $${paramIdx}`
      params.push(parseInt(customerId))
      paramIdx++
    }

    if (status) {
      whereClause += ` AND o.status = $${paramIdx}`
      params.push(status)
      paramIdx++
    }

    if (dateFrom) {
      whereClause += ` AND o.order_date >= $${paramIdx}`
      params.push(dateFrom)
      paramIdx++
    }

    if (dateTo) {
      whereClause += ` AND o.order_date <= $${paramIdx}`
      params.push(dateTo)
      paramIdx++
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM rnr_orders o LEFT JOIN customers c ON c.id = o.customer_id ${whereClause}`,
      params
    )

    const ordersResult = await query(
      `SELECT
        o.id, o.order_number, o.po_number, o.order_date, o.due_date,
        o.status, o.is_rush, o.notes, o.total_price, o.source,
        o.created_at, o.updated_at, o.customer_id,
        c.customer_name,
        (SELECT COUNT(*) FROM rnr_order_items oi WHERE oi.order_id = o.id) as item_count
      FROM rnr_orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    )

    return NextResponse.json({
      orders: ordersResult.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
    })
  } catch (error: unknown) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

async function generateOrderNumber(): Promise<string> {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = (now.getMonth() + 1).toString().padStart(2, '0')
  const dd = now.getDate().toString().padStart(2, '0')
  const prefix = `RNR-${yy}${mm}${dd}-`

  const result = await query(
    `SELECT order_number FROM rnr_orders WHERE order_number LIKE $1 ORDER BY order_number DESC LIMIT 1`,
    [`${prefix}%`]
  )

  let seq = 1
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].order_number as string
    const lastSeq = parseInt(lastNum.split('-').pop() || '0')
    seq = lastSeq + 1
  }

  return `${prefix}${seq.toString().padStart(3, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customer_id, po_number, order_date, due_date, is_rush, notes, items, source } = body

    if (!customer_id || !order_date) {
      return NextResponse.json({ error: 'Customer and order date are required' }, { status: 400 })
    }

    const orderNumber = await generateOrderNumber()

    let totalPrice = 0
    if (items && Array.isArray(items)) {
      for (const item of items) {
        totalPrice += parseFloat(item.line_total || '0')
      }
    }

    const orderResult = await query(
      `INSERT INTO rnr_orders (customer_id, po_number, order_number, order_date, due_date, is_rush, notes, total_price, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [customer_id, po_number || null, orderNumber, order_date, due_date || null, is_rush || false, notes || null, totalPrice, source || 'manual']
    )

    const order = orderResult.rows[0]

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await query(
          `INSERT INTO rnr_order_items (order_id, part_id, customer_part_number, description, quantity_ordered, price_per_unit, price_unit, line_total, is_new_part, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            order.id,
            item.part_id || null,
            item.customer_part_number || null,
            item.description || null,
            item.quantity_ordered || 0,
            item.price_per_unit || null,
            item.price_unit || 'BF',
            item.line_total || 0,
            item.is_new_part || false,
            item.notes || null,
          ]
        )
      }
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
