import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { UpdatePresetRequest, PresetResponse } from '@/types/presets';

// PUT /api/presets/:id - Update a preset
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<PresetResponse>> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data: UpdatePresetRequest = await request.json();
    const presetId = parseInt(params.id);

    if (isNaN(presetId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid preset ID' },
        { status: 400 }
      );
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Update the preset
      await query(
        `UPDATE order_presets SET
          name = $1,
          color = $2,
          pickup_customer_id = $3,
          delivery_customer_id = $4,
          paying_customer_id = $5,
          freight_type = $6,
          footage = $7,
          comments = $8,
          freight_quote = $9,
          is_rush = $10,
          needs_attention = $11,
          oh_to_in = $12,
          backhaul = $13,
          local_semi = $14,
          local_flatbed = $15,
          rr_order = $16,
          middlefield = $17,
          pa_ny = $18,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $19`,
        [
          data.name,
          data.color,
          data.pickupCustomer?.id || null,
          data.deliveryCustomer?.id || null,
          data.payingCustomer?.id || null,
          data.freightType,
          data.footage,
          data.comments,
          data.freightQuote ? parseFloat(data.freightQuote) : null,
          data.statusFlags?.rushOrder || false,
          data.statusFlags?.needsAttention || false,
          data.filters?.ohioToIndiana || false,
          data.filters?.backhaul || false,
          data.filters?.localSemi || false,
          data.filters?.localFlatbed || false,
          data.filters?.rrOrder || false,
          data.filters?.middlefield || false,
          data.filters?.paNy || false,
          presetId
        ]
      );

      // Delete existing skids/vinyl, links, and hand bundles
      await query('DELETE FROM preset_skids WHERE preset_id = $1', [presetId]);
      await query('DELETE FROM preset_links WHERE preset_id = $1', [presetId]);
      await query('DELETE FROM preset_hand_bundles WHERE preset_id = $1', [presetId]);

      // Insert new skids/vinyl if present
      if (data.freightType === 'skidsVinyl' && data.skidsVinyl?.length > 0) {
        for (const item of data.skidsVinyl) {
          await query(
            `INSERT INTO preset_skids (
              preset_id,
              type,
              width,
              length,
              square_footage,
              number
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              presetId,
              item.type,
              item.width,
              item.length,
              item.footage,
              item.number
            ]
          );
        }
      }

      // Insert new hand bundles if present
      if (data.handBundles?.length > 0) {
        for (const handBundle of data.handBundles) {
          await query(
            `INSERT INTO preset_hand_bundles (
              preset_id,
              quantity,
              description
            ) VALUES ($1, $2, $3)`,
            [
              presetId,
              handBundle.quantity,
              handBundle.description
            ]
          );
        }
      }

      // Insert new links if present
      if (data.links?.length > 0) {
        for (const link of data.links) {
          await query(
            `INSERT INTO preset_links (
              preset_id,
              url,
              description
            ) VALUES ($1, $2, $3)`,
            [presetId, link.url, link.description]
          );
        }
      }

      // Commit the transaction
      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Preset updated successfully'
      });

    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating preset:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update preset' },
      { status: 500 }
    );
  }
}

// DELETE /api/presets/:id - Delete a preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<PresetResponse>> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const presetId = parseInt(params.id);

    if (isNaN(presetId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid preset ID' },
        { status: 400 }
      );
    }

    // Delete the preset (related records will be cascade deleted automatically)
    const result = await query('DELETE FROM order_presets WHERE id = $1 RETURNING id', [presetId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Preset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting preset:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to delete preset' 
      },
      { status: 500 }
    );
  }
}

