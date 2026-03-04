import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preview = await query(
      `SELECT p.id, p.rnr_part_number, p.customer_part_number, c.customer_name
       FROM rnr_parts p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE c.customer_name ILIKE '%archbold%'
         AND (p.rnr_part_number LIKE 'AF-%' OR p.customer_part_number LIKE 'AF-%')
       ORDER BY p.rnr_part_number
       LIMIT 50`,
    )

    return NextResponse.json({
      count: preview.rows.length,
      preview: preview.rows,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rnrResult = await query(
      `UPDATE rnr_parts
       SET rnr_part_number = REPLACE(rnr_part_number, 'AF-', ''),
           updated_at = NOW()
       FROM customers c
       WHERE c.id = rnr_parts.customer_id
         AND c.customer_name ILIKE '%archbold%'
         AND rnr_parts.rnr_part_number LIKE 'AF-%'`,
    )

    const custResult = await query(
      `UPDATE rnr_parts
       SET customer_part_number = REPLACE(customer_part_number, 'AF-', ''),
           updated_at = NOW()
       FROM customers c
       WHERE c.id = rnr_parts.customer_id
         AND c.customer_name ILIKE '%archbold%'
         AND rnr_parts.customer_part_number LIKE 'AF-%'`,
    )

    return NextResponse.json({
      success: true,
      rnr_part_numbers_fixed: rnrResult.rowCount,
      customer_part_numbers_fixed: custResult.rowCount,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
