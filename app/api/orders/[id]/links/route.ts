import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/orders/[id]/links - Get all links for an order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    
    // Check if order exists
    const orderCheck = await query(
      'SELECT id FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    // Get all links for the order
    const result = await query(
      `SELECT id, url, description, created_at, updated_at
       FROM order_links
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId]
    );
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching order links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order links' },
      { status: 500 }
    );
  }
}

// POST /api/orders/[id]/links - Add a new link to an order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await request.json();
    
    // Validate required fields
    if (!body.url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
        { status: 400 }
      );
    }
    
    // Check if order exists
    const orderCheck = await query(
      'SELECT id FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    // Create the link
    const result = await query(
      `INSERT INTO order_links (
        order_id,
        url,
        description
      ) VALUES ($1, $2, $3) RETURNING *`,
      [
        orderId,
        body.url,
        body.description || null
      ]
    );
    
    await query(
      `INSERT INTO notifications (
        type,
        title,
        message,
        order_id
      ) VALUES ($1, $2, $3, $4)`,
      [
        'order_link',
        'Order Link Added',
        `A new link (${body.description || body.url}) was added to order #${orderId}`,
        orderId
      ]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating order link:', error);
    return NextResponse.json(
      { error: 'Failed to create order link' },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id]/links - Delete all links for an order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    
    // Check if order exists
    const orderCheck = await query(
      'SELECT id FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    // Delete all links for the order
    await query(
      'DELETE FROM order_links WHERE order_id = $1',
      [orderId]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order links:', error);
    return NextResponse.json(
      { error: 'Failed to delete order links' },
      { status: 500 }
    );
  }
} 