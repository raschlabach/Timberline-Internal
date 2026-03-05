import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS rnr_customer_settings (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  calendar_color TEXT NOT NULL DEFAULT '#3B82F6',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id)
);
CREATE INDEX IF NOT EXISTS idx_rnr_customer_settings_customer ON rnr_customer_settings(customer_id);
ALTER TABLE rnr_customer_settings ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
`

async function ensureTable() {
  await query(ENSURE_TABLE)
}

const DEFAULT_PALETTE = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  '#E11D48', '#84CC16', '#0EA5E9', '#A855F7', '#D946EF',
  '#FB923C', '#2DD4BF', '#4ADE80', '#FACC15', '#38BDF8',
]

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
        `SELECT s.id, s.customer_id, c.customer_name, s.calendar_color, s.created_at, s.updated_at
         FROM rnr_customer_settings s
         JOIN customers c ON c.id = s.customer_id
         WHERE s.customer_id = $1`,
        [customerId],
      )
      return NextResponse.json(result.rows[0] || null)
    }

    // Return all customers with their settings
    const result = await query(
      `SELECT c.id as customer_id, c.customer_name,
              s.calendar_color, s.id as settings_id,
              COALESCE(s.is_favorite, false) as is_favorite,
              h.hint_text,
              (SELECT COUNT(*) FROM rnr_parts p WHERE p.customer_id = c.id) as part_count
       FROM customers c
       LEFT JOIN rnr_customer_settings s ON s.customer_id = c.id
       LEFT JOIN rnr_customer_parse_hints h ON h.customer_id = c.id
       ORDER BY c.customer_name`,
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error fetching customer settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer settings', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const { customer_id, calendar_color, is_favorite } = body

    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
    }

    await ensureTable()

    if (typeof is_favorite === 'boolean' && calendar_color === undefined) {
      const result = await query(
        `INSERT INTO rnr_customer_settings (customer_id, is_favorite)
         VALUES ($1, $2)
         ON CONFLICT (customer_id) DO UPDATE SET is_favorite = $2, updated_at = NOW()
         RETURNING id, customer_id, calendar_color, is_favorite, created_at, updated_at`,
        [customer_id, is_favorite],
      )
      return NextResponse.json(result.rows[0])
    }

    const color = calendar_color || DEFAULT_PALETTE[customer_id % DEFAULT_PALETTE.length]

    const result = await query(
      `INSERT INTO rnr_customer_settings (customer_id, calendar_color)
       VALUES ($1, $2)
       ON CONFLICT (customer_id) DO UPDATE SET calendar_color = $2, updated_at = NOW()
       RETURNING id, customer_id, calendar_color, is_favorite, created_at, updated_at`,
      [customer_id, color],
    )

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    console.error('Error saving customer settings:', error)
    return NextResponse.json(
      { error: 'Failed to save customer settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
