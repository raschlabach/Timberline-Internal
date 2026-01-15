import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST /api/admin/seed-vendor-locations - Add vendor locations
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Define the vendors and their locations
    const vendorData = [
      { vendor: 'Baillie', location: 'Clearlake NY', phone: '814 657 6571' },
      { vendor: 'Baillie', location: 'Smyrna NY', phone: '607 627 6225' },
      { vendor: 'Baillie', location: 'Titusville PA', phone: '814 827 1877' },
      { vendor: 'Baillie', location: 'Leitchfield KY', phone: '270 259 3104' },
      { vendor: 'Baillie', location: 'Haessly OH', phone: '740 373 6681' },
      { vendor: 'Baillie', location: 'Galion OH', phone: '419 462 2000' },
      { vendor: 'Bingaman Lumber', location: '22 Brown Ave Clarendon PA', phone: '570-374-1108' },
      { vendor: 'Bridgewell Resources', location: 'Tunkhannock PA', phone: '570 836 1133' },
      { vendor: 'Central States Forest Products', location: 'Bradford PA (Danzer)', phone: '814 368 3701' },
      { vendor: 'Double Aught', location: 'Cayuta NY', phone: '607 659 4339' },
      { vendor: 'Gutchess Hardwoods', location: 'Latrobe PA', phone: '724 537 6447' },
      { vendor: 'Northwest', location: 'Ridgeway PA', phone: '814 776 1743' },
      { vendor: 'Northwest', location: 'Marienville PA', phone: '814 927 2226' },
      { vendor: 'Northwest', location: 'Endeavor PA', phone: '814 463 7701' },
      { vendor: 'Northwest', location: 'Loudenville OH', phone: '419 994 4302' },
      { vendor: 'Penn-sylvan', location: 'Spartansburg PA', phone: '814 694 2311' },
      { vendor: 'Tioga Hardwoods', location: 'Berkshire NY', phone: '607 657 8686' },
      { vendor: 'Wagner', location: 'Latrobe PA', phone: '607 594 3321' },
    ]

    const results = {
      suppliersCreated: 0,
      locationsCreated: 0,
      errors: [] as string[]
    }

    // Get unique vendor names
    const uniqueVendors = Array.from(new Set(vendorData.map(v => v.vendor)))

    // Create or get supplier IDs
    const supplierIds: Record<string, number> = {}

    for (const vendorName of uniqueVendors) {
      // Check if supplier exists
      const existingSupplier = await query(
        `SELECT id FROM lumber_suppliers WHERE name = $1`,
        [vendorName]
      )

      if (existingSupplier.rows.length > 0) {
        supplierIds[vendorName] = existingSupplier.rows[0].id
      } else {
        // Create the supplier
        const newSupplier = await query(
          `INSERT INTO lumber_suppliers (name, is_active) VALUES ($1, TRUE) RETURNING id`,
          [vendorName]
        )
        supplierIds[vendorName] = newSupplier.rows[0].id
        results.suppliersCreated++
      }
    }

    // Create locations
    for (const data of vendorData) {
      const supplierId = supplierIds[data.vendor]
      
      // Check if location already exists
      const existingLocation = await query(
        `SELECT id FROM lumber_supplier_locations 
         WHERE supplier_id = $1 AND location_name = $2`,
        [supplierId, data.location]
      )

      if (existingLocation.rows.length === 0) {
        try {
          await query(
            `INSERT INTO lumber_supplier_locations (
              supplier_id, location_name, phone_number_1
            ) VALUES ($1, $2, $3)`,
            [supplierId, data.location, data.phone]
          )
          results.locationsCreated++
        } catch (err) {
          results.errors.push(`Failed to create location ${data.location} for ${data.vendor}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${results.suppliersCreated} suppliers and ${results.locationsCreated} locations`,
      ...results
    })
  } catch (error) {
    console.error('Error seeding vendor locations:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
