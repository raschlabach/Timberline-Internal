import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query(
      'SELECT customer_name FROM favorite_customer_groups WHERE user_id = $1',
      [session.user.id]
    );

    const favoriteGroups = result.rows.map(row => row.customer_name);

    return NextResponse.json({ 
      success: true, 
      favoriteGroups 
    });

  } catch (error) {
    console.error('Error fetching favorite groups:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch favorite groups' },
      { status: 500 }
    );
  }
}

