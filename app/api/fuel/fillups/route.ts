import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const countResult = await query(
      `SELECT COUNT(*) as total FROM fuel_truck_fillups`
    );
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const result = await query(
      `SELECT
        f.id,
        f.fillup_date,
        f.truck_id,
        f.driver_id,
        f.mileage,
        f.gallons,
        f.notes,
        f.created_at,
        ft.name as truck_name,
        u.full_name as driver_name
      FROM fuel_truck_fillups f
      JOIN fuel_trucks ft ON f.truck_id = ft.id
      LEFT JOIN users u ON f.driver_id = u.id
      ORDER BY f.fillup_date DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return NextResponse.json({ fillups: result.rows, totalCount });
  } catch (error) {
    console.error('Error fetching fillups:', error);
    return NextResponse.json({ error: 'Failed to fetch fillups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fillup_date, truck_id, driver_id, mileage, gallons, notes } = body;

    if (!fillup_date || !truck_id || !mileage || !gallons || gallons <= 0) {
      return NextResponse.json(
        { error: 'Date, truck, mileage, and gallons are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO fuel_truck_fillups (fillup_date, truck_id, driver_id, mileage, gallons, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, fillup_date, truck_id, driver_id, mileage, gallons, notes, created_at`,
      [fillup_date, truck_id, driver_id || null, mileage, gallons, notes || null, session.user.id]
    );

    return NextResponse.json({ fillup: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating fillup:', error);
    return NextResponse.json({ error: 'Failed to create fillup' }, { status: 500 });
  }
}
