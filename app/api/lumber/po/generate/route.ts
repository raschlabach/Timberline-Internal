import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST /api/lumber/po/generate - Generate PO PDF (stub for now)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { load_id } = body

    if (!load_id) {
      return NextResponse.json({ error: 'Load ID is required' }, { status: 400 })
    }

    // Get load details
    const loadResult = await query(
      `SELECT l.*, s.name as supplier_name, sl.location_name, sl.address, sl.city, sl.state, sl.zip_code
       FROM lumber_loads l
       JOIN lumber_suppliers s ON l.supplier_id = s.id
       LEFT JOIN lumber_supplier_locations sl ON l.supplier_location_id = sl.id
       WHERE l.id = $1`,
      [load_id]
    )

    if (loadResult.rows.length === 0) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 })
    }

    const load = loadResult.rows[0]

    // Get load items
    const itemsResult = await query(
      'SELECT * FROM lumber_load_items WHERE load_id = $1 ORDER BY id',
      [load_id]
    )

    // Mark PO as generated
    await query(
      'UPDATE lumber_loads SET po_generated = TRUE, po_generated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [load_id]
    )

    // TODO: Implement actual PDF generation using a library like pdfkit or puppeteer
    // For now, return a simple text response that can be used to generate a PO
    const poText = `
PURCHASE ORDER
--------------
PO Number: PO-${load.load_id}
Date: ${new Date().toLocaleDateString()}

SUPPLIER:
${load.supplier_name}
${load.location_name || ''}
${load.address || ''}
${load.city || ''}, ${load.state || ''} ${load.zip_code || ''}

ITEMS:
${itemsResult.rows.map((item, idx) => `
${idx + 1}. ${item.species} - ${item.grade} (${item.thickness})
   Estimated Footage: ${item.estimated_footage?.toLocaleString() || 'TBD'} BF
   Price: $${item.price?.toFixed(2) || 'TBD'} per BF
   Subtotal: $${((item.estimated_footage || 0) * (item.price || 0)).toFixed(2)}
`).join('\n')}

TOTAL: $${itemsResult.rows.reduce((sum, item) => sum + ((item.estimated_footage || 0) * (item.price || 0)), 0).toFixed(2)}

Estimated Delivery: ${load.estimated_delivery_date ? new Date(load.estimated_delivery_date).toLocaleDateString() : 'TBD'}
Type: ${load.lumber_type || 'N/A'}
Pickup/Delivery: ${load.pickup_or_delivery || 'N/A'}

Comments:
${load.comments || 'None'}
`

    // Return as text/plain for now - in production this would be a PDF
    return new NextResponse(poText, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="PO-${load.load_id}.txt"`
      }
    })
  } catch (error) {
    console.error('Error generating PO:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
