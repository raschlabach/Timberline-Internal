import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface ReorderRequest {
  presetIds: number[];
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data: ReorderRequest = await request.json();
    
    if (!data.presetIds || !Array.isArray(data.presetIds)) {
      return NextResponse.json({ error: 'Invalid preset IDs' }, { status: 400 });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Update display_order for each preset
      for (let i = 0; i < data.presetIds.length; i++) {
        await query(
          'UPDATE order_presets SET display_order = $1 WHERE id = $2',
          [i + 1, data.presetIds[i]]
        );
      }

      // Commit transaction
      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Presets reordered successfully'
      });

    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error reordering presets:', error);
    return NextResponse.json(
      { error: 'Failed to reorder presets' },
      { status: 500 }
    );
  }
}
