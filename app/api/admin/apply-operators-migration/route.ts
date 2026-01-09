import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create lumber_operators table
    await query(`
      CREATE TABLE IF NOT EXISTS lumber_operators (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Add unique constraint
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS lumber_operators_name_unique ON lumber_operators(name);
    `)

    // Create trigger function
    await query(`
      CREATE OR REPLACE FUNCTION update_lumber_operators_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    // Create trigger
    await query(`
      DROP TRIGGER IF EXISTS lumber_operators_updated_at ON lumber_operators;
    `)

    await query(`
      CREATE TRIGGER lumber_operators_updated_at
        BEFORE UPDATE ON lumber_operators
        FOR EACH ROW
        EXECUTE FUNCTION update_lumber_operators_updated_at();
    `)

    return NextResponse.json({ 
      success: true, 
      message: 'Lumber operators table created successfully' 
    })

  } catch (error: any) {
    console.error('Error applying operators migration:', error)
    return NextResponse.json({ 
      error: 'Failed to apply migration', 
      details: error.message 
    }, { status: 500 })
  }
}
