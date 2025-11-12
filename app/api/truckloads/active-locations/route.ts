import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function geocodeAddress(address: string, city: string, state: string): Promise<{lat: number, lng: number} | null> {
  try {
    const fullAddress = `${address}, ${city}, ${state}`;
    console.log(`🌍 Geocoding address: ${fullAddress}`);
    
    const encodedAddress = encodeURIComponent(fullAddress);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === 'OK' && data.results[0]?.geometry?.location) {
      console.log(`✅ Geocoding successful:`, data.results[0].geometry.location);
      return data.results[0].geometry.location;
    }
    console.log(`❌ Geocoding failed:`, data);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching unassigned load locations...');
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // First, get all unassigned orders and their locations
    const result = await query(
      `WITH unassigned_orders AS (
        SELECT o.id as order_id,
          o.pickup_customer_id,
          o.delivery_customer_id,
          'pickup' as type
        FROM orders o
        LEFT JOIN truckload_order_assignments toa ON o.id = toa.order_id
        WHERE toa.id IS NULL
          AND o.status != 'completed'
        UNION ALL
        SELECT o.id as order_id,
          o.pickup_customer_id,
          o.delivery_customer_id,
          'delivery' as type
        FROM orders o
        LEFT JOIN truckload_order_assignments toa ON o.id = toa.order_id
        WHERE toa.id IS NULL
          AND o.status != 'completed'
      )
      SELECT 
        uo.order_id as id,
        uo.type,
        CASE 
          WHEN uo.type = 'pickup' THEN pc.customer_name
          ELSE dc.customer_name
        END as customer_name,
        CASE 
          WHEN uo.type = 'pickup' THEN pl.id
          ELSE dl.id
        END as location_id,
        CASE 
          WHEN uo.type = 'pickup' THEN pl.latitude
          ELSE dl.latitude
        END as lat,
        CASE 
          WHEN uo.type = 'pickup' THEN pl.longitude
          ELSE dl.longitude
        END as lng,
        CASE 
          WHEN uo.type = 'pickup' THEN pl.address
          ELSE dl.address
        END as address,
        CASE 
          WHEN uo.type = 'pickup' THEN pl.city
          ELSE dl.city
        END as city,
        CASE 
          WHEN uo.type = 'pickup' THEN pl.state
          ELSE dl.state
        END as state
      FROM unassigned_orders uo
      JOIN customers pc ON uo.pickup_customer_id = pc.id
      JOIN customers dc ON uo.delivery_customer_id = dc.id
      JOIN locations pl ON pc.location_id = pl.id
      JOIN locations dl ON dc.location_id = dl.id
      ORDER BY uo.order_id`,
      []
    );

    console.log(`📊 Found ${result.rows.length} unassigned orders`);

    // Process results and geocode if needed
    const processedLoads = [];
    for (const row of result.rows) {
      let { lat, lng } = row;
      
      // Convert string coordinates to numbers
      lat = parseFloat(lat);
      lng = parseFloat(lng);
      
      // If coordinates are missing or invalid, geocode
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.log(`🌍 Missing coordinates for ${row.customer_name}, geocoding...`);
        const coords = await geocodeAddress(row.address, row.city, row.state);
        
        if (coords) {
          // Update the location in the database
          await query(
            `UPDATE locations 
             SET latitude = $1, longitude = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [coords.lat, coords.lng, row.location_id]
          );
          
          lat = coords.lat;
          lng = coords.lng;
          console.log(`✅ Updated coordinates for ${row.customer_name}: ${lat}, ${lng}`);
        } else {
          console.log(`⚠️ Could not geocode address for ${row.customer_name}`);
          continue; // Skip this location if geocoding failed
        }
      }

      processedLoads.push({
        id: row.id,
        lat,
        lng,
        type: row.type,
        customerName: row.customer_name
      });
    }

    console.log(`✅ Processed ${processedLoads.length} locations`);
    console.log('First few loads:', processedLoads.slice(0, 3));

    return NextResponse.json({
      success: true,
      loads: processedLoads
    });
  } catch (error) {
    console.error('❌ Error fetching unassigned load locations:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
} 