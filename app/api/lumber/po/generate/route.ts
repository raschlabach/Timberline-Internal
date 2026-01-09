import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import PDFDocument from 'pdfkit'

// POST /api/lumber/po/generate - Generate PO PDF
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

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    // Collect PDF data
    doc.on('data', (chunk) => chunks.push(chunk))
    
    const poNumber = `R-${load.load_id}`
    const currentDate = new Date().toLocaleDateString()
    const deliveryMonth = load.estimated_delivery_date 
      ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'TBD'

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('PURCHASE ORDER', { align: 'center' })
    doc.moveDown(1)

    // PO Number and Dates
    doc.fontSize(11).font('Helvetica')
    doc.text(`PO Number: ${poNumber}`)
    doc.text(`Date: ${currentDate}`)
    doc.text(`Estimated Delivery: ${deliveryMonth}`)
    doc.moveDown(1)

    // Customer Info (RNR Enterprises)
    doc.fontSize(12).font('Helvetica-Bold')
    doc.text('CUSTOMER:')
    doc.fontSize(11).font('Helvetica')
    doc.text('RNR Enterprises')
    doc.text('1361 Co Rd')
    doc.text('Sugarcreek, OH 44681')
    doc.moveDown(1)

    // Supplier Info
    doc.fontSize(12).font('Helvetica-Bold')
    doc.text('SUPPLIER:')
    doc.fontSize(11).font('Helvetica')
    doc.text(load.supplier_name || 'N/A')
    if (load.location_name) doc.text(load.location_name)
    if (load.address) doc.text(load.address)
    if (load.city || load.state || load.zip_code) {
      doc.text(`${load.city || ''}, ${load.state || ''} ${load.zip_code || ''}`)
    }
    doc.moveDown(1.5)

    // Items Table
    const tableTop = doc.y
    const colPositions = {
      qty: 50,
      species: 120,
      grade: 220,
      thickness: 290,
      price: 360,
      pickup: 450
    }

    // Table Header
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('Qty (BF)', colPositions.qty, tableTop)
    doc.text('Species', colPositions.species, tableTop)
    doc.text('Grade', colPositions.grade, tableTop)
    doc.text('Thickness', colPositions.thickness, tableTop)
    doc.text('Price/BF', colPositions.price, tableTop)
    doc.text('Pickup/Del', colPositions.pickup, tableTop)
    
    // Line under header
    const lineY = tableTop + 15
    doc.moveTo(50, lineY).lineTo(550, lineY).stroke()
    
    // Items
    let itemY = lineY + 10
    doc.font('Helvetica')
    itemsResult.rows.forEach((item: any) => {
      if (itemY > 700) {
        doc.addPage()
        itemY = 50
      }
      
      doc.text((item.estimated_footage || 0).toLocaleString(), colPositions.qty, itemY, { width: 60 })
      doc.text(item.species || '', colPositions.species, itemY, { width: 90 })
      doc.text(item.grade || '', colPositions.grade, itemY, { width: 60 })
      doc.text(item.thickness?.toString() || '', colPositions.thickness, itemY, { width: 60 })
      doc.text(`$${(item.price || 0).toFixed(2)}`, colPositions.price, itemY, { width: 80 })
      doc.text(load.pickup_or_delivery === 'pickup' ? 'Pickup' : 'Delivery', colPositions.pickup, itemY)
      
      itemY += 25
    })

    // Line after items
    doc.moveTo(50, itemY).lineTo(550, itemY).stroke()
    itemY += 20

    // Comments
    if (load.comments) {
      doc.font('Helvetica-Bold').fontSize(11)
      doc.text('COMMENTS:', 50, itemY)
      itemY += 15
      doc.font('Helvetica').fontSize(10)
      doc.text(load.comments, 50, itemY, { width: 500 })
      itemY = doc.y + 20
    }

    // Important Notice
    doc.moveDown(2)
    doc.fontSize(16).font('Helvetica-Bold').fillColor('red')
    doc.text('PLEASE USE OUR PO NUMBER(S) ON ALL PAPERWORK', { align: 'center' })

    // Finalize PDF
    doc.end()

    // Wait for PDF to be generated
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    })

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PO-${poNumber}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error generating PO:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
