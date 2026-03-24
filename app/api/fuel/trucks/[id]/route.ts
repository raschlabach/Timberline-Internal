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
    const { name, driver_id, voyager_vehicle_description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Truck name is required' }, { status: 400 });
    }

    const result = await query(
      `UPDATE fuel_trucks SET name = $1, driver_id = $2, voyager_vehicle_description = $3 WHERE id = $4
       RETURNING id, name, driver_id, is_active, voyager_vehicle_description`,
      [name.trim(), driver_id || null, voyager_vehicle_description?.trim() || null, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Truck not found' }, { status: 404 });
    }

    return NextResponse.json({ truck: result.rows[0] });
  } catch (error) {
    console.error('Error updating fuel truck:', error);
    return NextResponse.json({ error: 'Failed to update truck' }, { status: 500 });
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
      `UPDATE fuel_trucks SET is_active = false WHERE id = $1 RETURNING id`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Truck not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deactivating fuel truck:', error);
    return NextResponse.json({ error: 'Failed to deactivate truck' }, { status: 500 });
  }
}
