import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Query to find customers with orders but missing addresses
    const result = await query(
      `
        WITH current_orders AS (
          SELECT 
            o.id as order_id,
            o.customer_id,
            o.pickup_location_id,
            o.delivery_location_id,
            o.status
          FROM orders o
          WHERE o.status IN ('pending', 'in_progress')
        )
        SELECT DISTINCT
          c.id as customer_id,
          c.name as customer_name,
          co.order_id,
          CASE 
            WHEN pl.id IS NULL THEN 'pickup'
            WHEN dl.id IS NULL THEN 'delivery'
          END as missing_type
        FROM current_orders co
        JOIN customers c ON c.id = co.customer_id
        LEFT JOIN locations pl ON pl.id = co.pickup_location_id
        LEFT JOIN locations dl ON dl.id = co.delivery_location_id
        WHERE (pl.id IS NULL OR dl.id IS NULL)
        ORDER BY c.name, co.order_id
      `,
      []
    )

    const customers = result.rows.map(row => ({
      id: row.customer_id,
      name: row.customer_name,
      orderId: row.order_id,
      type: row.missing_type
    }))

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('Error fetching customers without addresses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers without addresses' },
      { status: 500 }
    )
  }
} 