import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS rnr_customer_parse_hints (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  hint_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id)
);
CREATE INDEX IF NOT EXISTS idx_rnr_parse_hints_customer ON rnr_customer_parse_hints(customer_id);
`

async function ensureTable() {
  await query(ENSURE_TABLE)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureTable()
    const customerId = request.nextUrl.searchParams.get('customer_id')

    if (customerId) {
      const result = await query(
        `SELECT h.id, h.customer_id, c.customer_name, h.hint_text, h.created_at, h.updated_at
         FROM rnr_customer_parse_hints h
         JOIN customers c ON c.id = h.customer_id
         WHERE h.customer_id = $1`,
        [customerId],
      )
      return NextResponse.json(result.rows[0] || null)
    }

    const result = await query(
      `SELECT h.id, h.customer_id, c.customer_name, h.hint_text, h.created_at, h.updated_at
       FROM rnr_customer_parse_hints h
       JOIN customers c ON c.id = h.customer_id
       ORDER BY c.customer_name`,
    )
    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error fetching parse hints:', error)
    return NextResponse.json(
      { error: 'Failed to fetch parse hints', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customer_id, hint_text } = body

    if (!customer_id || !hint_text?.trim()) {
      return NextResponse.json({ error: 'customer_id and hint_text are required' }, { status: 400 })
    }

    await ensureTable()
    const result = await query(
      `INSERT INTO rnr_customer_parse_hints (customer_id, hint_text)
       VALUES ($1, $2)
       ON CONFLICT (customer_id) DO UPDATE SET hint_text = $2, updated_at = NOW()
       RETURNING id, customer_id, hint_text, created_at, updated_at`,
      [customer_id, hint_text.trim()],
    )

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    console.error('Error saving parse hint:', error)
    return NextResponse.json(
      { error: 'Failed to save parse hint', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = request.nextUrl.searchParams.get('customer_id')
    if (!customerId) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
    }

    await ensureTable()
    await query(`DELETE FROM rnr_customer_parse_hints WHERE customer_id = $1`, [customerId])
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting parse hint:', error)
    return NextResponse.json(
      { error: 'Failed to delete parse hint', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
