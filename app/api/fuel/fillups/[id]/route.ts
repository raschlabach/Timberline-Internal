import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      `UPDATE fuel_truck_fillups
       SET fillup_date = $1, truck_id = $2, driver_id = $3, mileage = $4, gallons = $5, notes = $6
       WHERE id = $7
       RETURNING id, fillup_date, truck_id, driver_id, mileage, gallons, notes`,
      [fillup_date, truck_id, driver_id || null, mileage, gallons, notes || null, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Fillup not found' }, { status: 404 });
    }

    return NextResponse.json({ fillup: result.rows[0] });
  } catch (error) {
    console.error('Error updating fillup:', error);
    return NextResponse.json({ error: 'Failed to update fillup' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query(
      `DELETE FROM fuel_truck_fillups WHERE id = $1 RETURNING id`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Fillup not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting fillup:', error);
    return NextResponse.json({ error: 'Failed to delete fillup' }, { status: 500 });
  }
}
