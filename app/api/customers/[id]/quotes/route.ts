import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/customers/[id]/quotes - Get all quotes for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    
    // First check if customer exists
    const customerCheck = await query(
      'SELECT id FROM customers WHERE id = $1',
      [customerId]
    );
    
    if (customerCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }
    
    const result = await query(
      `SELECT 
        id, 
        description, 
        price, 
        quote_date, 
        created_at, 
        updated_at
      FROM 
        quotes
      WHERE 
        customer_id = $1
      ORDER BY 
        quote_date DESC`,
      [customerId]
    );
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}

// POST /api/customers/[id]/quotes - Create a new quote for a customer
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const body = await request.json();
    
    // Validate required fields
    if (!body.description || !body.price || !body.quote_date) {
      return NextResponse.json(
        { error: 'Missing required fields: description, price, and quote_date are required' },
        { status: 400 }
      );
    }
    
    // Check if customer exists
    const customerCheck = await query(
      'SELECT id FROM customers WHERE id = $1',
      [customerId]
    );
    
    if (customerCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }
    
    // Create the quote
    const result = await query(
      `INSERT INTO quotes (
        customer_id, 
        description, 
        price, 
        quote_date
      ) VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        customerId,
        body.description,
        body.price,
        body.quote_date
      ]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating quote:', error);
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    );
  }
} 