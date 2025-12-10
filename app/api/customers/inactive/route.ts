import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/customers/inactive - Get customers with no orders in the last year
export async function GET(request: NextRequest) {
  try {
    console.log("Fetching inactive customers from database...");
    
    // Calculate date one year ago
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoString = oneYearAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Check if extension columns exist
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name IN ('phone_number_1_ext', 'phone_number_2_ext')
    `);
    const hasExtensions = columnCheck.rows.length > 0;
    
    // Build query with or without extension columns
    const extensionFields = hasExtensions 
      ? `c.phone_number_1_ext,
          c.phone_number_2_ext,`
      : `NULL::VARCHAR as phone_number_1_ext,
          NULL::VARCHAR as phone_number_2_ext,`;
    
    const result = await query(
      `WITH customer_order_dates AS (
        -- Get the most recent order date for each customer from all order types
        SELECT 
          c.id as customer_id,
          GREATEST(
            COALESCE(MAX(pickup_orders.pickup_date), '1900-01-01'::date),
            COALESCE(MAX(delivery_orders.pickup_date), '1900-01-01'::date),
            COALESCE(MAX(paying_orders.pickup_date), '1900-01-01'::date)
          ) as last_order_date
        FROM 
          customers c
        LEFT JOIN (
          SELECT pickup_customer_id as customer_id, MAX(pickup_date) as pickup_date
          FROM orders
          GROUP BY pickup_customer_id
        ) pickup_orders ON c.id = pickup_orders.customer_id
        LEFT JOIN (
          SELECT delivery_customer_id as customer_id, MAX(pickup_date) as pickup_date
          FROM orders
          GROUP BY delivery_customer_id
        ) delivery_orders ON c.id = delivery_orders.customer_id
        LEFT JOIN (
          SELECT paying_customer_id as customer_id, MAX(pickup_date) as pickup_date
          FROM orders
          WHERE paying_customer_id IS NOT NULL
          GROUP BY paying_customer_id
        ) paying_orders ON c.id = paying_orders.customer_id
        GROUP BY c.id
      )
      SELECT 
        c.id, 
        c.customer_name, 
        l.address, 
        l.city, 
        l.state, 
        l.county, 
        l.zip_code,
        c.phone_number_1, 
        ${extensionFields}
        c.phone_number_2, 
        c.notes,
        c.quotes,
        -- Last order date (NULL if never had an order, otherwise the date)
        CASE 
          WHEN cod.last_order_date = '1900-01-01'::date THEN NULL
          ELSE cod.last_order_date
        END as last_order_date,
        -- Total order count
        COALESCE(
          (SELECT COUNT(*) FROM orders WHERE pickup_customer_id = c.id) +
          (SELECT COUNT(*) FROM orders WHERE delivery_customer_id = c.id) +
          (SELECT COUNT(*) FROM orders WHERE paying_customer_id = c.id),
          0
        ) as total_orders
      FROM 
        customers c
      JOIN 
        locations l ON c.location_id = l.id
      LEFT JOIN 
        customer_order_dates cod ON c.id = cod.customer_id
      WHERE 
        -- Customer has no orders at all, OR last order was more than a year ago
        (
          cod.last_order_date IS NULL 
          OR cod.last_order_date = '1900-01-01'::date
          OR cod.last_order_date < $1::date
        )
      ORDER BY 
        cod.last_order_date ASC NULLS LAST,
        c.customer_name ASC`,
      [oneYearAgoString]
    );
    
    console.log(`Successfully fetched ${result.rows.length} inactive customers`);
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching inactive customers:', error)
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
      
    return NextResponse.json(
      { 
        error: 'Failed to fetch inactive customers',
        message: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

