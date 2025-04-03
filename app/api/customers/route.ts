import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/customers - List all customers
export async function GET(request: NextRequest) {
  try {
    console.log("Fetching customers from database...");
    
    // Add a timeout to the query to prevent long-running queries
    const result = await Promise.race([
      query(
        `SELECT 
          c.id, 
          c.customer_name, 
          l.address, 
          l.city, 
          l.state, 
          l.county, 
          l.zip_code,
          c.phone_number_1, 
          c.phone_number_2, 
          c.notes,
          c.quotes
        FROM 
          customers c
        JOIN 
          locations l ON c.location_id = l.id
        ORDER BY 
          c.customer_name ASC`
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      )
    ]) as any;
    
    console.log(`Successfully fetched ${result.rows.length} customers`);
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching customers:', error)
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
      
    // Return a more detailed error response
    return NextResponse.json(
      { 
        error: 'Failed to fetch customers',
        message: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // First create the location
    const locationResult = await query(
      `INSERT INTO locations (
        name, 
        address, 
        city, 
        state, 
        county, 
        zip_code, 
        latitude, 
        longitude
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        body.customer_name,
        body.address,
        body.city,
        body.state,
        body.county,
        body.zip_code,
        body.latitude || null,
        body.longitude || null
      ]
    )
    
    const locationId = locationResult.rows[0].id
    
    // Then create the customer with reference to the location
    const customerResult = await query(
      `INSERT INTO customers (
        customer_name, 
        location_id, 
        phone_number_1, 
        phone_number_2,
        quotes, 
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        body.customer_name,
        locationId,
        body.phone_number_1,
        body.phone_number_2 || null,
        body.quotes || null,
        body.notes || null
      ]
    )
    
    const customerId = customerResult.rows[0].id
    
    // Return the complete customer data
    const result = await query(
      `SELECT 
        c.id, 
        c.customer_name, 
        l.address, 
        l.city, 
        l.state, 
        l.county, 
        l.zip_code,
        c.phone_number_1, 
        c.phone_number_2,
        c.quotes, 
        c.notes
      FROM 
        customers c
      JOIN 
        locations l ON c.location_id = l.id
      WHERE 
        c.id = $1`,
      [customerId]
    )
    
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
      
    return NextResponse.json(
      { 
        error: 'Failed to create customer',
        message: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 