import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CreatePresetRequest, UpdatePresetRequest, PresetResponse, PresetCustomer } from '@/types/presets';

// GET /api/presets - List all presets
export async function GET(): Promise<NextResponse<PresetResponse>> {
  try {
    console.log('Fetching presets...');
    
    // First, try a simple query to test the connection
    try {
      const testResult = await query('SELECT NOW()');
      console.log('Database connection test successful');
    } catch (dbError) {
      console.error('Database connection test failed:', dbError);
      throw new Error('Database connection failed');
    }

    // Then try a simpler version of the presets query first
    try {
      const result = await query(`
        SELECT 
          p.*,
          pc.id as pickup_customer_id,
          pc.customer_name as pickup_customer_name,
          pl.address as pickup_customer_address,
          dc.id as delivery_customer_id,
          dc.customer_name as delivery_customer_name,
          dl.address as delivery_customer_address,
          payc.id as paying_customer_id,
          payc.customer_name as paying_customer_name,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', s.id,
                  'type', s.type,
                  'width', s.width,
                  'length', s.length,
                  'footage', s.square_footage,
                  'number', s.number,
                  'isNew', false,
                  'isEditing', false
                )
              )
              FROM preset_skids s
              WHERE s.preset_id = p.id
            ),
            '[]'::json
          ) as skids_vinyl,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'url', l.url,
                  'description', l.description
                )
              )
              FROM preset_links l
              WHERE l.preset_id = p.id
            ),
            '[]'::json
          ) as links
        FROM order_presets p
        LEFT JOIN customers pc ON p.pickup_customer_id = pc.id
        LEFT JOIN locations pl ON pc.location_id = pl.id
        LEFT JOIN customers dc ON p.delivery_customer_id = dc.id
        LEFT JOIN locations dl ON dc.location_id = dl.id
        LEFT JOIN customers payc ON p.paying_customer_id = payc.id
        ORDER BY p.name ASC
      `);

      console.log('Raw database result:', result.rows);

      const presets = result.rows.map(row => {
        try {
          console.log('Processing row:', row);
          
          // Parse JSON strings if they're strings
          const skidsVinyl = typeof row.skids_vinyl === 'string' ? JSON.parse(row.skids_vinyl) : row.skids_vinyl;
          const links = typeof row.links === 'string' ? JSON.parse(row.links) : row.links;
          
          return {
            id: row.id,
            name: row.name,
            color: row.color || '#808080',
            pickupCustomer: row.pickup_customer_id ? {
              id: row.pickup_customer_id,
              customer_name: row.pickup_customer_name,
              address: row.pickup_customer_address
            } as PresetCustomer : null,
            deliveryCustomer: row.delivery_customer_id ? {
              id: row.delivery_customer_id,
              customer_name: row.delivery_customer_name,
              address: row.delivery_customer_address
            } as PresetCustomer : null,
            payingCustomer: row.paying_customer_id ? {
              id: row.paying_customer_id,
              customer_name: row.paying_customer_name
            } as PresetCustomer : null,
            filters: {
              ohioToIndiana: row.oh_to_in || false,
              backhaul: row.backhaul || false,
              localFlatbed: row.local_flatbed || false,
              rrOrder: row.rr_order || false,
              localSemi: row.local_semi || false,
              middlefield: row.middlefield || false,
              paNy: row.pa_ny || false
            },
            freightType: row.freight_type || 'skidsVinyl',
            skidsVinyl: Array.isArray(skidsVinyl) ? skidsVinyl : [],
            footage: row.footage || 0,
            comments: row.comments || '',
            freightQuote: row.freight_quote?.toString() || '',
            statusFlags: {
              rushOrder: row.is_rush || false,
              needsAttention: row.needs_attention || false
            },
            links: Array.isArray(links) ? links : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        } catch (err) {
          console.error('Error processing row:', err);
          console.error('Problematic row:', row);
          throw err;
        }
      });

      console.log('Processed presets:', presets);

      return NextResponse.json({
        success: true,
        message: 'Presets retrieved successfully',
        presets
      } as PresetResponse);

    } catch (dbError: unknown) {
      console.error('Presets query failed:', dbError);
      throw new Error('Failed to query presets data: ' + (dbError instanceof Error ? dbError.message : String(dbError)));
    }

  } catch (error) {
    console.error('Error fetching presets:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
      console.error('Error details:', error.message);
    }
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch presets',
        error: error instanceof Error ? error.stack : 'Unknown error'
      } as PresetResponse,
      { status: 500 }
    );
  }
}

// POST /api/presets - Create a new preset
export async function POST(request: NextRequest): Promise<NextResponse<PresetResponse>> {
  try {
    const session = await getSession();
    const data: CreatePresetRequest = await request.json();

    console.log('Creating preset with data:', {
      ...data,
      pickupCustomer: data.pickupCustomer?.id,
      deliveryCustomer: data.deliveryCustomer?.id,
      payingCustomer: data.payingCustomer?.id,
    });

    // Start transaction
    await query('BEGIN');

    try {
      // Insert the preset
      const presetResult = await query(
        `INSERT INTO order_presets (
          name,
          color,
          pickup_customer_id,
          delivery_customer_id,
          paying_customer_id,
          freight_type,
          footage,
          comments,
          freight_quote,
          is_rush,
          needs_attention,
          oh_to_in,
          backhaul,
          local_semi,
          local_flatbed,
          rr_order,
          middlefield,
          pa_ny,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id`,
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
          session.user.id
        ]
      );

      const presetId = presetResult.rows[0].id;
      console.log('Created preset with ID:', presetId);

      // Insert skids/vinyl if present
      if (data.freightType === 'skidsVinyl' && data.skidsVinyl?.length > 0) {
        console.log('Adding skids/vinyl:', data.skidsVinyl);
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

      // Insert links if present
      if (data.links?.length > 0) {
        console.log('Adding links:', data.links);
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
      console.log('Transaction committed successfully');

      return NextResponse.json({
        success: true,
        message: 'Preset created successfully',
        preset: {
          id: presetId,
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      console.error('Database error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error creating preset:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to create preset',
        error: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// PUT /api/presets/:id - Update a preset
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<PresetResponse>> {
  try {
    const data: UpdatePresetRequest = await request.json();
    const presetId = parseInt(params.id);

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
          pa_ny = $18
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

      // Delete existing skids/vinyl and links
      await query('DELETE FROM preset_skids WHERE preset_id = $1', [presetId]);
      await query('DELETE FROM preset_links WHERE preset_id = $1', [presetId]);

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
    const presetId = parseInt(params.id);
    await query('DELETE FROM order_presets WHERE id = $1', [presetId]);

    return NextResponse.json({
      success: true,
      message: 'Preset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting preset:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete preset' },
      { status: 500 }
    );
  }
} 