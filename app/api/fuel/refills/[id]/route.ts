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
    const { refill_date, gallons, notes } = body;

    if (!refill_date || !gallons || gallons <= 0) {
      return NextResponse.json({ error: 'Date and gallons are required' }, { status: 400 });
    }

    const result = await query(
      `UPDATE fuel_tank_refills SET refill_date = $1, gallons = $2, notes = $3
       WHERE id = $4
       RETURNING id, refill_date, gallons, notes`,
      [refill_date, gallons, notes || null, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Refill not found' }, { status: 404 });
    }

    return NextResponse.json({ refill: result.rows[0] });
  } catch (error) {
    console.error('Error updating refill:', error);
    return NextResponse.json({ error: 'Failed to update refill' }, { status: 500 });
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
      `DELETE FROM fuel_tank_refills WHERE id = $1 RETURNING id`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Refill not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting refill:', error);
    return NextResponse.json({ error: 'Failed to delete refill' }, { status: 500 });
  }
}
