import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { presetId, isFavorite }: { presetId: number; isFavorite: boolean } = await request.json();

    if (typeof presetId !== 'number' || typeof isFavorite !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Update the favorite status
    await query(
      'UPDATE order_presets SET is_favorite = $1 WHERE id = $2',
      [isFavorite, presetId]
    );

    return NextResponse.json({ 
      success: true, 
      message: `Preset ${isFavorite ? 'added to' : 'removed from'} favorites` 
    });

  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update favorite status' },
      { status: 500 }
    );
  }
}
