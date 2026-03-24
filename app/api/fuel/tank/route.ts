import { NextResponse } from 'next/server';
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
        COALESCE((SELECT SUM(gallons) FROM fuel_tank_refills), 0) as total_refilled,
        COALESCE((SELECT SUM(gallons) FROM fuel_truck_fillups), 0) as total_used
    `);

    const totalRefilled = parseFloat(result.rows[0].total_refilled) || 0;
    const totalUsed = parseFloat(result.rows[0].total_used) || 0;
    const currentLevel = totalRefilled - totalUsed;

    return NextResponse.json({
      currentLevel: Math.max(0, currentLevel),
      totalRefilled,
      totalUsed,
    });
  } catch (error) {
    console.error('Error fetching tank level:', error);
    return NextResponse.json({ error: 'Failed to fetch tank level' }, { status: 500 });
  }
}
