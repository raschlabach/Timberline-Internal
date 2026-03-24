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
        ft.id,
        ft.name,
        ft.driver_id,
        ft.is_active,
        ft.voyager_vehicle_description,
        ft.created_at,
        u.full_name as driver_name
      FROM fuel_trucks ft
      LEFT JOIN users u ON ft.driver_id = u.id
      ORDER BY ft.is_active DESC, ft.name ASC
    `);

    return NextResponse.json({ trucks: result.rows });
  } catch (error) {
    console.error('Error fetching fuel trucks:', error);
    return NextResponse.json({ error: 'Failed to fetch trucks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
      `INSERT INTO fuel_trucks (name, driver_id, voyager_vehicle_description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, driver_id, is_active, voyager_vehicle_description, created_at`,
      [name.trim(), driver_id || null, voyager_vehicle_description?.trim() || null, session.user.id]
    );

    return NextResponse.json({ truck: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating fuel truck:', error);
    return NextResponse.json({ error: 'Failed to create truck' }, { status: 500 });
  }
}
