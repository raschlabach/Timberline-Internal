import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Seeds initial polygon zones based on historical delivery cluster analysis.
 * Creates polygon zones for common delivery areas found in completed truckloads.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await query('SELECT COUNT(*) as count FROM load_suggestion_polygons')
    if (parseInt(existing.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'Polygons already exist. Delete them first if you want to re-seed.',
      })
    }

    const seedPolygons = [
      {
        name: 'Indiana Core (Delivery)',
        color: '#3B82F6',
        matchOn: 'delivery',
        coordinates: [
          { lat: 41.85, lng: -86.30 },
          { lat: 41.85, lng: -85.20 },
          { lat: 41.30, lng: -85.20 },
          { lat: 41.30, lng: -86.30 },
        ],
      },
      {
        name: 'Indiana Core (Backhaul Pickup)',
        color: '#F59E0B',
        matchOn: 'pickup',
        coordinates: [
          { lat: 41.85, lng: -86.30 },
          { lat: 41.85, lng: -85.20 },
          { lat: 41.30, lng: -85.20 },
          { lat: 41.30, lng: -86.30 },
        ],
      },
      {
        name: 'Michigan (Caledonia)',
        color: '#10B981',
        matchOn: 'delivery',
        coordinates: [
          { lat: 43.10, lng: -85.90 },
          { lat: 43.10, lng: -85.30 },
          { lat: 42.60, lng: -85.30 },
          { lat: 42.60, lng: -85.90 },
        ],
      },
      {
        name: 'Southern Indiana (Odon)',
        color: '#8B5CF6',
        matchOn: 'delivery',
        coordinates: [
          { lat: 39.10, lng: -87.20 },
          { lat: 39.10, lng: -86.60 },
          { lat: 38.70, lng: -86.60 },
          { lat: 38.70, lng: -87.20 },
        ],
      },
      {
        name: 'PA/NY Corridor',
        color: '#EC4899',
        matchOn: 'delivery',
        coordinates: [
          { lat: 42.50, lng: -79.80 },
          { lat: 42.50, lng: -78.00 },
          { lat: 41.20, lng: -78.00 },
          { lat: 41.20, lng: -79.80 },
        ],
      },
      {
        name: 'Middlefield Area',
        color: '#06B6D4',
        matchOn: 'delivery',
        coordinates: [
          { lat: 41.60, lng: -81.30 },
          { lat: 41.60, lng: -80.90 },
          { lat: 41.30, lng: -80.90 },
          { lat: 41.30, lng: -81.30 },
        ],
      },
      {
        name: 'Local OH (Pickup Zone)',
        color: '#F97316',
        matchOn: 'pickup',
        coordinates: [
          { lat: 40.85, lng: -82.00 },
          { lat: 40.85, lng: -81.50 },
          { lat: 40.35, lng: -81.50 },
          { lat: 40.35, lng: -82.00 },
        ],
      },
    ]

    const created = []
    for (const poly of seedPolygons) {
      const result = await query(
        `INSERT INTO load_suggestion_polygons (name, coordinates, color, match_on, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name`,
        [
          poly.name,
          JSON.stringify(poly.coordinates),
          poly.color,
          poly.matchOn,
          (session.user as any).id,
        ]
      )
      created.push(result.rows[0])
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${created.length} polygon zones`,
      polygons: created,
    })
  } catch (error) {
    console.error('Error seeding polygons:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
