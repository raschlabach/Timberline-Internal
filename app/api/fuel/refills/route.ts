import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query(`
      SELECT
        r.id,
        r.refill_date,
        r.gallons,
        r.notes,
        r.created_at,
        u.full_name as created_by_name
      FROM fuel_tank_refills r
      LEFT JOIN users u ON r.created_by = u.id
      ORDER BY r.refill_date DESC
    `);

    return NextResponse.json({ refills: result.rows });
  } catch (error) {
    console.error('Error fetching tank refills:', error);
    return NextResponse.json({ error: 'Failed to fetch refills' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { refill_date, gallons, notes } = body;

    if (!refill_date || !gallons || gallons <= 0) {
      return NextResponse.json({ error: 'Date and gallons are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO fuel_tank_refills (refill_date, gallons, notes, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, refill_date, gallons, notes, created_at`,
      [refill_date, gallons, notes || null, session.user.id]
    );

    return NextResponse.json({ refill: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating tank refill:', error);
    return NextResponse.json({ error: 'Failed to create refill' }, { status: 500 });
  }
}
