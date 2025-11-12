import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/pricing-notes/[id] - Get a specific pricing note
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const noteId = params.id;

    const result = await query(
      `SELECT 
        pn.id,
        pn.title,
        pn.category_id,
        pn.content,
        pn.tags,
        pn.is_active,
        pn.created_by,
        pn.created_at,
        pn.updated_at,
        -- Category information
        json_build_object(
          'id', pc.id,
          'name', pc.name,
          'description', pc.description,
          'color', pc.color,
          'sort_order', pc.sort_order
        ) as category,
        -- Creator information
        json_build_object(
          'id', u.id,
          'full_name', u.full_name
        ) as created_by_user,
        -- Linked customers
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', c.id,
                'customer_name', c.customer_name
              )
            )
            FROM pricing_note_customers pnc
            JOIN customers c ON pnc.customer_id = c.id
            WHERE pnc.pricing_note_id = pn.id
          ),
          '[]'::json
        ) as linked_customers
      FROM pricing_notes pn
      LEFT JOIN pricing_categories pc ON pn.category_id = pc.id
      LEFT JOIN users u ON pn.created_by = u.id
      WHERE pn.id = $1`,
      [noteId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pricing note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching pricing note:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing note' },
      { status: 500 }
    );
  }
}

// PUT /api/pricing-notes/[id] - Update a pricing note
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const noteId = params.id;
    const body = await request.json();
    const { title, category_id, content, tags, is_active, linked_customer_ids } = body;

    // Validate required fields
    if (!title || !category_id || !content) {
      return NextResponse.json(
        { error: 'Title, category_id, and content are required' },
        { status: 400 }
      );
    }

    // Check if note exists
    const existingNote = await query(
      'SELECT id FROM pricing_notes WHERE id = $1',
      [noteId]
    );

    if (existingNote.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pricing note not found' },
        { status: 404 }
      );
    }

    // Check if category exists
    const categoryCheck = await query(
      'SELECT id FROM pricing_categories WHERE id = $1',
      [category_id]
    );

    if (categoryCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pricing category not found' },
        { status: 404 }
      );
    }

    // Start a transaction
    await query('BEGIN');

    try {
      // Update the pricing note
      await query(
        `UPDATE pricing_notes 
         SET title = $1, category_id = $2, content = $3, tags = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [title, category_id, content, tags || [], is_active !== false, noteId]
      );

      // Update customer links
      // First, remove existing links
      await query(
        'DELETE FROM pricing_note_customers WHERE pricing_note_id = $1',
        [noteId]
      );

      // Then add new links
      if (linked_customer_ids && linked_customer_ids.length > 0) {
        for (const customerId of linked_customer_ids) {
          // Verify customer exists
          const customerCheck = await query(
            'SELECT id FROM customers WHERE id = $1',
            [customerId]
          );

          if (customerCheck.rows.length > 0) {
            await query(
              'INSERT INTO pricing_note_customers (pricing_note_id, customer_id) VALUES ($1, $2)',
              [noteId, customerId]
            );
          }
        }
      }

      await query('COMMIT');

      // Fetch the updated note with all relationships
      const updatedNote = await query(
        `SELECT 
          pn.id,
          pn.title,
          pn.category_id,
          pn.content,
          pn.tags,
          pn.is_active,
          pn.created_by,
          pn.created_at,
          pn.updated_at,
          -- Category information
          json_build_object(
            'id', pc.id,
            'name', pc.name,
            'description', pc.description,
            'color', pc.color,
            'sort_order', pc.sort_order
          ) as category,
          -- Creator information
          json_build_object(
            'id', u.id,
            'full_name', u.full_name
          ) as created_by_user,
          -- Linked customers
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', c.id,
                  'customer_name', c.customer_name
                )
              )
              FROM pricing_note_customers pnc
              JOIN customers c ON pnc.customer_id = c.id
              WHERE pnc.pricing_note_id = pn.id
            ),
            '[]'::json
          ) as linked_customers
        FROM pricing_notes pn
        LEFT JOIN pricing_categories pc ON pn.category_id = pc.id
        LEFT JOIN users u ON pn.created_by = u.id
        WHERE pn.id = $1`,
        [noteId]
      );

      return NextResponse.json(updatedNote.rows[0]);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating pricing note:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing note' },
      { status: 500 }
    );
  }
}

// DELETE /api/pricing-notes/[id] - Delete a pricing note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const noteId = params.id;

    // Check if note exists
    const existingNote = await query(
      'SELECT id FROM pricing_notes WHERE id = $1',
      [noteId]
    );

    if (existingNote.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pricing note not found' },
        { status: 404 }
      );
    }

    // Delete the note (cascade will handle related records)
    await query('DELETE FROM pricing_notes WHERE id = $1', [noteId]);

    return NextResponse.json({ message: 'Pricing note deleted successfully' });
  } catch (error) {
    console.error('Error deleting pricing note:', error);
    return NextResponse.json(
      { error: 'Failed to delete pricing note' },
      { status: 500 }
    );
  }
}
