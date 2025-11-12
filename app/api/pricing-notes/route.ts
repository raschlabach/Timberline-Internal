import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/pricing-notes - List pricing notes with optional filtering
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const categoryId = searchParams.get('category_id');
    const tags = searchParams.get('tags');
    const isActive = searchParams.get('is_active');
    const customerId = searchParams.get('customer_id');

    // Build the query with filters
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(pn.title ILIKE $${paramIndex} OR pn.content ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (categoryId) {
      whereConditions.push(`pn.category_id = $${paramIndex}`);
      queryParams.push(categoryId);
      paramIndex++;
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      whereConditions.push(`pn.tags && $${paramIndex}`);
      queryParams.push(tagArray);
      paramIndex++;
    }

    if (isActive !== null && isActive !== undefined) {
      whereConditions.push(`pn.is_active = $${paramIndex}`);
      queryParams.push(isActive === 'true');
      paramIndex++;
    }

    if (customerId) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM pricing_note_customers pnc 
        WHERE pnc.pricing_note_id = pn.id AND pnc.customer_id = $${paramIndex}
      )`);
      queryParams.push(customerId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT 
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
      ${whereClause}
      ORDER BY pn.updated_at DESC, pn.created_at DESC
    `;

    const result = await query(sqlQuery, queryParams);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching pricing notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing notes' },
      { status: 500 }
    );
  }
}

// POST /api/pricing-notes - Create a new pricing note
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, category_id, content, tags, is_active, linked_customer_ids } = body;

    // Validate required fields
    if (!title || !category_id || !content) {
      return NextResponse.json(
        { error: 'Title, category_id, and content are required' },
        { status: 400 }
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
      // Create the pricing note
      const noteResult = await query(
        `INSERT INTO pricing_notes (title, category_id, content, tags, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          title,
          category_id,
          content,
          tags || [],
          is_active !== false, // Default to true
          session.user.id
        ]
      );

      const note = noteResult.rows[0];

      // Link customers if provided
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
              [note.id, customerId]
            );
          }
        }
      }

      await query('COMMIT');

      // Fetch the complete note with all relationships
      const completeNote = await query(
        `SELECT 
          pn.*,
          json_build_object(
            'id', pc.id,
            'name', pc.name,
            'description', pc.description,
            'color', pc.color,
            'sort_order', pc.sort_order
          ) as category,
          json_build_object(
            'id', u.id,
            'full_name', u.full_name
          ) as created_by_user,
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
        [note.id]
      );

      return NextResponse.json(completeNote.rows[0], { status: 201 });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating pricing note:', error);
    return NextResponse.json(
      { error: 'Failed to create pricing note' },
      { status: 500 }
    );
  }
}
