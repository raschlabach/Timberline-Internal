import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { jsPDF } from 'jspdf'

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
    const doc = new jsPDF()
    
    const poNumber = `R-${load.load_id}`
    const currentDate = new Date().toLocaleDateString()
    const deliveryMonth = load.estimated_delivery_date 
      ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'TBD'

    let yPos = 20

    // Header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('PURCHASE ORDER', 105, yPos, { align: 'center' })
    yPos += 15

    // PO Number and Dates
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`PO Number: ${poNumber}`, 20, yPos)
    yPos += 7
    doc.text(`Date: ${currentDate}`, 20, yPos)
    yPos += 7
    doc.text(`Estimated Delivery: ${deliveryMonth}`, 20, yPos)
    yPos += 15

    // Customer Info (RNR Enterprises)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('CUSTOMER:', 20, yPos)
    yPos += 7
    doc.setFont('helvetica', 'normal')
    doc.text('RNR Enterprises', 20, yPos)
    yPos += 6
    doc.text('1361 Co Rd', 20, yPos)
    yPos += 6
    doc.text('Sugarcreek, OH 44681', 20, yPos)
    yPos += 15

    // Supplier Info
    doc.setFont('helvetica', 'bold')
    doc.text('SUPPLIER:', 20, yPos)
    yPos += 7
    doc.setFont('helvetica', 'normal')
    doc.text(load.supplier_name || 'N/A', 20, yPos)
    yPos += 6
    if (load.location_name) {
      doc.text(load.location_name, 20, yPos)
      yPos += 6
    }
    if (load.address) {
      doc.text(load.address, 20, yPos)
      yPos += 6
    }
    if (load.city || load.state || load.zip_code) {
      doc.text(`${load.city || ''}, ${load.state || ''} ${load.zip_code || ''}`, 20, yPos)
      yPos += 6
    }
    yPos += 10

    // Items Table Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Qty (BF)', 20, yPos)
    doc.text('Species', 45, yPos)
    doc.text('Grade', 75, yPos)
    doc.text('Thickness', 100, yPos)
    doc.text('Price/BF', 130, yPos)
    doc.text('Pickup/Del', 160, yPos)
    yPos += 2
    doc.line(20, yPos, 190, yPos) // Line under header
    yPos += 6

    // Items
    doc.setFont('helvetica', 'normal')
    itemsResult.rows.forEach((item: any) => {
      if (yPos > 250) { // New page if needed
        doc.addPage()
        yPos = 20
      }
      
      doc.text((item.estimated_footage || 0).toLocaleString(), 20, yPos)
      doc.text(item.species || '', 45, yPos)
      doc.text(item.grade || '', 75, yPos)
      doc.text(item.thickness?.toString() || '', 100, yPos)
      doc.text(`$${(item.price || 0).toFixed(2)}`, 130, yPos)
      doc.text(load.pickup_or_delivery === 'pickup' ? 'Pickup' : 'Delivery', 160, yPos)
      yPos += 7
    })

    yPos += 5
    doc.line(20, yPos, 190, yPos) // Line after items
    yPos += 10

    // Comments
    if (load.comments) {
      doc.setFont('helvetica', 'bold')
      doc.text('COMMENTS:', 20, yPos)
      yPos += 7
      doc.setFont('helvetica', 'normal')
      const splitComments = doc.splitTextToSize(load.comments, 170)
      doc.text(splitComments, 20, yPos)
      yPos += (splitComments.length * 6) + 10
    }

    // Important Notice
    yPos += 5
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 0, 0) // Red text
    const noticeText = 'PLEASE USE OUR PO NUMBER(S) ON ALL PAPERWORK'
    doc.text(noticeText, 105, yPos, { align: 'center' })

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

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
