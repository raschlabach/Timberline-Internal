import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/pricing-categories/[id] - Get a specific pricing category
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

    const categoryId = params.id;

    const result = await query(
      'SELECT * FROM pricing_categories WHERE id = $1',
      [categoryId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pricing category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching pricing category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing category' },
      { status: 500 }
    );
  }
}

// PUT /api/pricing-categories/[id] - Update a pricing category
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

    const categoryId = params.id;
    const body = await request.json();
    const { name, description, color, sort_order } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if category exists
    const existingCategory = await query(
      'SELECT id FROM pricing_categories WHERE id = $1',
      [categoryId]
    );

    if (existingCategory.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pricing category not found' },
        { status: 404 }
      );
    }

    // Check if another category with same name exists
    const duplicateCategory = await query(
      'SELECT id FROM pricing_categories WHERE name = $1 AND id != $2',
      [name, categoryId]
    );

    if (duplicateCategory.rows.length > 0) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 }
      );
    }

    // Update the category
    const result = await query(
      `UPDATE pricing_categories 
       SET name = $1, description = $2, color = $3, sort_order = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [name, description || null, color || '#3B82F6', sort_order || 0, categoryId]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating pricing category:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing category' },
      { status: 500 }
    );
  }
}

// DELETE /api/pricing-categories/[id] - Delete a pricing category
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

    const categoryId = params.id;

    // Check if category exists
    const existingCategory = await query(
      'SELECT id FROM pricing_categories WHERE id = $1',
      [categoryId]
    );

    if (existingCategory.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pricing category not found' },
        { status: 404 }
      );
    }

    // Check if category is being used by any pricing notes or templates
    const notesUsingCategory = await query(
      'SELECT COUNT(*) as count FROM pricing_notes WHERE category_id = $1',
      [categoryId]
    );

    const templatesUsingCategory = await query(
      'SELECT COUNT(*) as count FROM pricing_templates WHERE category_id = $1',
      [categoryId]
    );

    const totalUsage = parseInt(notesUsingCategory.rows[0].count) + parseInt(templatesUsingCategory.rows[0].count);

    if (totalUsage > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete category. It is being used by ${totalUsage} pricing note(s) or template(s). Please reassign or delete them first.` 
        },
        { status: 409 }
      );
    }

    // Delete the category
    await query('DELETE FROM pricing_categories WHERE id = $1', [categoryId]);

    return NextResponse.json({ message: 'Pricing category deleted successfully' });
  } catch (error) {
    console.error('Error deleting pricing category:', error);
    return NextResponse.json(
      { error: 'Failed to delete pricing category' },
      { status: 500 }
    );
  }
}
