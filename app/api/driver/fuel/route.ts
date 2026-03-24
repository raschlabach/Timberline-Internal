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

    const driverId = session.user.id;

    const [tankResult, trucksResult, assignedResult] = await Promise.all([
      query(`
        SELECT
          COALESCE((SELECT SUM(gallons) FROM fuel_tank_refills), 0) as total_refilled,
          COALESCE((SELECT SUM(gallons) FROM fuel_truck_fillups), 0) as total_used
      `),
      query(`
        SELECT id, name, driver_id
        FROM fuel_trucks
        WHERE is_active = true
        ORDER BY name ASC
      `),
      query(`
        SELECT id, name
        FROM fuel_trucks
        WHERE driver_id = $1 AND is_active = true
        LIMIT 1
      `, [driverId]),
    ]);

    const totalRefilled = parseFloat(tankResult.rows[0].total_refilled) || 0;
    const totalUsed = parseFloat(tankResult.rows[0].total_used) || 0;
    const currentLevel = Math.max(0, totalRefilled - totalUsed);

    return NextResponse.json({
      currentLevel,
      trucks: trucksResult.rows,
      assignedTruck: assignedResult.rows[0] || null,
    });
  } catch (error) {
    console.error('Error fetching driver fuel data:', error);
    return NextResponse.json({ error: 'Failed to fetch fuel data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fillup_date, truck_id, mileage, gallons, notes } = body;

    if (!fillup_date || !truck_id || !mileage || !gallons || gallons <= 0) {
      return NextResponse.json(
        { error: 'Date, truck, mileage, and gallons are required' },
        { status: 400 }
      );
    }

    const driverId = session.user.id;

    const result = await query(
      `INSERT INTO fuel_truck_fillups (fillup_date, truck_id, driver_id, mileage, gallons, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, fillup_date, truck_id, driver_id, mileage, gallons, notes, created_at`,
      [fillup_date, truck_id, driverId, mileage, gallons, notes || null, driverId]
    );

    return NextResponse.json({ fillup: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating driver fillup:', error);
    return NextResponse.json({ error: 'Failed to submit fillup' }, { status: 500 });
  }
}
