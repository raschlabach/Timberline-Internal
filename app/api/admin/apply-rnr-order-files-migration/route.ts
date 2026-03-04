import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

const migrationSql = `
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS in_quickbooks BOOLEAN DEFAULT false;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS in_quickbooks_at TIMESTAMP;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS sent_to_shop BOOLEAN DEFAULT false;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS sent_to_shop_at TIMESTAMP;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS original_file_url TEXT;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS original_file_name TEXT;

CREATE TABLE IF NOT EXISTS rnr_order_files (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES rnr_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rnr_order_files_order ON rnr_order_files(order_id);
`

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await query(migrationSql)
    return NextResponse.json({ success: true, message: 'Migration applied successfully' })
  } catch (error: unknown) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Failed to apply migration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
