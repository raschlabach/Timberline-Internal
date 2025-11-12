import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/pricing-categories - List all pricing categories
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sqlQuery = `
      SELECT 
        id,
        name,
        description,
        color,
        sort_order,
        created_at,
        updated_at
      FROM pricing_categories
      ORDER BY sort_order ASC, name ASC
    `;

    const result = await query(sqlQuery);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching pricing categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing categories' },
      { status: 500 }
    );
  }
}

// POST /api/pricing-categories - Create a new pricing category
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, color, sort_order } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if category with same name already exists
    const existingCategory = await query(
      'SELECT id FROM pricing_categories WHERE name = $1',
      [name]
    );

    if (existingCategory.rows.length > 0) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 }
      );
    }

    // Create the category
    const result = await query(
      `INSERT INTO pricing_categories (name, description, color, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description || null, color || '#3B82F6', sort_order || 0]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating pricing category:', error);
    return NextResponse.json(
      { error: 'Failed to create pricing category' },
      { status: 500 }
    );
  }
}
