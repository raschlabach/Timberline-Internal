import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/customers/[id]/quotes/[quoteId] - Get a specific quote
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; quoteId: string } }
) {
  try {
    const { id: customerId, quoteId } = params;
    
    const result = await query(
      `SELECT 
        id, 
        customer_id,
        description, 
        price, 
        quote_date, 
        created_at, 
        updated_at
      FROM 
        quotes
      WHERE 
        id = $1 AND customer_id = $2`,
      [quoteId, customerId]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id]/quotes/[quoteId] - Update a specific quote
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; quoteId: string } }
) {
  try {
    const { id: customerId, quoteId } = params;
    const body = await request.json();
    
    // Validate required fields
    if (!body.description || body.price === undefined || !body.quote_date) {
      return NextResponse.json(
        { error: 'Missing required fields: description, price, and quote_date are required' },
        { status: 400 }
      );
    }
    
    // Check if quote exists and belongs to the customer
    const quoteCheck = await query(
      'SELECT id FROM quotes WHERE id = $1 AND customer_id = $2',
      [quoteId, customerId]
    );
    
    if (quoteCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Quote not found or does not belong to this customer' },
        { status: 404 }
      );
    }
    
    // Update the quote
    const result = await query(
      `UPDATE quotes SET
        description = $1,
        price = $2,
        quote_date = $3,
        updated_at = NOW()
      WHERE 
        id = $4 AND customer_id = $5
      RETURNING *`,
      [
        body.description,
        body.price,
        body.quote_date,
        quoteId,
        customerId
      ]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating quote:', error);
    return NextResponse.json(
      { error: 'Failed to update quote' },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id]/quotes/[quoteId] - Delete a specific quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; quoteId: string } }
) {
  try {
    const { id: customerId, quoteId } = params;
    
    // Check if quote exists and belongs to the customer
    const quoteCheck = await query(
      'SELECT id FROM quotes WHERE id = $1 AND customer_id = $2',
      [quoteId, customerId]
    );
    
    if (quoteCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Quote not found or does not belong to this customer' },
        { status: 404 }
      );
    }
    
    // Delete the quote
    await query(
      'DELETE FROM quotes WHERE id = $1 AND customer_id = $2',
      [quoteId, customerId]
    );
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting quote:', error);
    return NextResponse.json(
      { error: 'Failed to delete quote' },
      { status: 500 }
    );
  }
} 