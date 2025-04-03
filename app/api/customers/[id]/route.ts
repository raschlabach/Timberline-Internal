import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/customers/[id] - Get a specific customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
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
        c.notes,
        c.quotes
      FROM 
        customers c
      JOIN 
        locations l ON c.location_id = l.id
      WHERE 
        c.id = $1`,
      [id]
    )
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

// PUT /api/customers/[id] - Update a customer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()
    
    // First get the customer to obtain the location_id
    const customerResult = await query(
      'SELECT location_id FROM customers WHERE id = $1',
      [id]
    )
    
    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }
    
    const locationId = customerResult.rows[0].location_id
    
    // Update the location
    await query(
      `UPDATE locations SET
        name = $1,
        address = $2,
        city = $3,
        state = $4,
        county = $5,
        zip_code = $6,
        latitude = $7,
        longitude = $8,
        updated_at = NOW()
      WHERE id = $9`,
      [
        body.customer_name,
        body.address,
        body.city,
        body.state,
        body.county,
        body.zip_code,
        body.latitude || null,
        body.longitude || null,
        locationId
      ]
    )
    
    // Update the customer
    await query(
      `UPDATE customers SET
        customer_name = $1,
        phone_number_1 = $2,
        phone_number_2 = $3,
        notes = $4,
        quotes = $5,
        updated_at = NOW()
      WHERE id = $6`,
      [
        body.customer_name,
        body.phone_number_1,
        body.phone_number_2 || null,
        body.notes || null,
        body.quotes || null,
        id
      ]
    )
    
    // Return the updated customer data
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
        c.notes,
        c.quotes
      FROM 
        customers c
      JOIN 
        locations l ON c.location_id = l.id
      WHERE 
        c.id = $1`,
      [id]
    )
    
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

// DELETE /api/customers/[id] - Delete a customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    // Check if the customer is being used in any orders
    const orderCheck = await query(
      `SELECT id FROM orders 
       WHERE pickup_customer_id = $1 
       OR delivery_customer_id = $1 
       OR paying_customer_id = $1 
       LIMIT 1`,
      [id]
    )
    
    if (orderCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete customer: Customer is referenced by existing orders' },
        { status: 400 }
      )
    }
    
    // Get customer's location_id before deleting
    const customerResult = await query(
      'SELECT location_id FROM customers WHERE id = $1',
      [id]
    )
    
    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }
    
    const locationId = customerResult.rows[0].location_id
    
    // Delete customer
    await query('DELETE FROM customers WHERE id = $1', [id])
    
    // Delete associated location
    await query('DELETE FROM locations WHERE id = $1', [locationId])
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
} 