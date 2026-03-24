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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const result = await query(
      `SELECT
        f.id,
        f.fillup_date,
        f.mileage,
        f.gallons,
        f.notes,
        ft.name as truck_name,
        u.full_name as driver_name
      FROM fuel_truck_fillups f
      JOIN fuel_trucks ft ON f.truck_id = ft.id
      LEFT JOIN users u ON f.driver_id = u.id
      WHERE f.fillup_date >= $1::timestamp
        AND f.fillup_date < ($2::timestamp + interval '1 day')
      ORDER BY f.fillup_date DESC`,
      [startDate, endDate]
    );

    const totalGallons = result.rows.reduce(
      (sum: number, row: { gallons: string | number }) => sum + (parseFloat(String(row.gallons)) || 0),
      0
    );

    return NextResponse.json({
      fillups: result.rows,
      totalGallons,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching fuel report:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
