import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerName, isFavorite }: { customerName: string; isFavorite: boolean } = await request.json();

    if (typeof customerName !== 'string' || typeof isFavorite !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (isFavorite) {
      // Add to favorites
      await query(
        `INSERT INTO favorite_customer_groups (user_id, customer_name)
         VALUES ($1, $2)
         ON CONFLICT (user_id, customer_name) DO NOTHING`,
        [session.user.id, customerName]
      );
    } else {
      // Remove from favorites
      await query(
        'DELETE FROM favorite_customer_groups WHERE user_id = $1 AND customer_name = $2',
        [session.user.id, customerName]
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Customer group ${isFavorite ? 'added to' : 'removed from'} favorites` 
    });

  } catch (error) {
    console.error('Error toggling group favorite:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update favorite status' },
      { status: 500 }
    );
  }
}

