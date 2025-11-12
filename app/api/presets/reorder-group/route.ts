import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupKey, presetUpdates }: { 
      groupKey: string, 
      presetUpdates: Array<{ id: number, display_order: number }> 
    } = await request.json();

    if (!Array.isArray(presetUpdates) || !groupKey) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    await query('BEGIN');

    try {
      // Update display_order for each preset in the group
      for (const update of presetUpdates) {
        await query(
          `UPDATE order_presets SET display_order = $1 WHERE id = $2`,
          [update.display_order, update.id]
        );
      }
      
      await query('COMMIT');
      return NextResponse.json({ 
        success: true, 
        message: `Presets reordered successfully in group: ${groupKey}` 
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error reordering presets in group:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to reorder presets in group' },
      { status: 500 }
    );
  }
}
