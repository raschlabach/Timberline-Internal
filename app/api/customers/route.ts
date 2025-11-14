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
          c.phone_number_1_ext,
          c.phone_number_2, 
          c.phone_number_2_ext,
          c.notes,
          c.quotes,
          -- Order counts
          COALESCE(current_orders.current_count, 0) as current_orders,
          COALESCE(total_orders.total_count, 0) as total_orders
        FROM 
          customers c
        JOIN 
          locations l ON c.location_id = l.id
        LEFT JOIN (
          -- Count current/active orders (unassigned, assigned, in_progress)
          SELECT 
            customer_id,
            SUM(order_count) as current_count
          FROM (
            SELECT 
              pickup_customer_id as customer_id,
              COUNT(*) as order_count
            FROM orders 
            WHERE status IN ('unassigned', 'assigned', 'in_progress')
            GROUP BY pickup_customer_id
            
            UNION ALL
            
            SELECT 
              delivery_customer_id as customer_id,
              COUNT(*) as order_count
            FROM orders 
            WHERE status IN ('unassigned', 'assigned', 'in_progress')
            GROUP BY delivery_customer_id
          ) current_union
          GROUP BY customer_id
        ) current_orders ON c.id = current_orders.customer_id
        LEFT JOIN (
          -- Count total orders (all statuses)
          SELECT 
            customer_id,
            SUM(order_count) as total_count
          FROM (
            SELECT 
              pickup_customer_id as customer_id,
              COUNT(*) as order_count
            FROM orders 
            GROUP BY pickup_customer_id
            
            UNION ALL
            
            SELECT 
              delivery_customer_id as customer_id,
              COUNT(*) as order_count
            FROM orders 
            GROUP BY delivery_customer_id
          ) total_union
          GROUP BY customer_id
        ) total_orders ON c.id = total_orders.customer_id
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
        phone_number_1_ext,
        phone_number_2,
        phone_number_2_ext,
        quotes, 
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        body.customer_name,
        locationId,
        body.phone_number_1,
        body.phone_number_1_ext || null,
        body.phone_number_2 || null,
        body.phone_number_2_ext || null,
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
        c.phone_number_1_ext,
        c.phone_number_2,
        c.phone_number_2_ext,
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