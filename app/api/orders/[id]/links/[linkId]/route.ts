import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/orders/[id]/links/[linkId] - Get a specific link
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string, linkId: string } }
) {
  try {
    const { id: orderId, linkId } = params;
    
    // Get the specific link
    const result = await query(
      `SELECT id, order_id, url, description, created_at, updated_at
       FROM order_links
       WHERE id = $1 AND order_id = $2`,
      [linkId, orderId]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching order link:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order link' },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[id]/links/[linkId] - Update a specific link
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string, linkId: string } }
) {
  try {
    const { id: orderId, linkId } = params;
    const body = await request.json();
    
    // Validate required fields
    if (!body.url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
        { status: 400 }
      );
    }
    
    // Check if link exists
    const linkCheck = await query(
      'SELECT id FROM order_links WHERE id = $1 AND order_id = $2',
      [linkId, orderId]
    );
    
    if (linkCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }
    
    // Update the link
    const result = await query(
      `UPDATE order_links
       SET url = $1, description = $2
       WHERE id = $3 AND order_id = $4
       RETURNING *`,
      [
        body.url,
        body.description || null,
        linkId,
        orderId
      ]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order link:', error);
    return NextResponse.json(
      { error: 'Failed to update order link' },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id]/links/[linkId] - Delete a specific link
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, linkId: string } }
) {
  try {
    const { id: orderId, linkId } = params;
    
    // Check if link exists
    const linkCheck = await query(
      'SELECT id FROM order_links WHERE id = $1 AND order_id = $2',
      [linkId, orderId]
    );
    
    if (linkCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }
    
    // Delete the link
    await query(
      'DELETE FROM order_links WHERE id = $1 AND order_id = $2',
      [linkId, orderId]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order link:', error);
    return NextResponse.json(
      { error: 'Failed to delete order link' },
      { status: 500 }
    );
  }
} 