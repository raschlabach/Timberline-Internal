import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

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

    console.log('Starting PDF generation for load:', load.load_id)

    // Generate PDF using pdf-lib
    const pdfDoc = await PDFDocument.create()
    console.log('PDF document created')
    const page = pdfDoc.addPage([612, 792]) // Letter size
    console.log('Page added')
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    console.log('Helvetica font embedded')
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    console.log('Helvetica-Bold font embedded')
    
    const poNumber = `R-${load.load_id}`
    const currentDate = new Date().toLocaleDateString()
    const deliveryMonth = load.estimated_delivery_date 
      ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'TBD'

    let yPos = 750

    // Header
    page.drawText('PURCHASE ORDER', {
      x: 306 - (fontBold.widthOfTextAtSize('PURCHASE ORDER', 24) / 2),
      y: yPos,
      size: 24,
      font: fontBold,
      color: rgb(0, 0, 0)
    })
    yPos -= 40

    // PO Number and Dates
    page.drawText(`PO Number: ${poNumber}`, { x: 50, y: yPos, size: 11, font })
    yPos -= 15
    page.drawText(`Date: ${currentDate}`, { x: 50, y: yPos, size: 11, font })
    yPos -= 15
    page.drawText(`Estimated Delivery: ${deliveryMonth}`, { x: 50, y: yPos, size: 11, font })
    yPos -= 30

    // Customer Info
    page.drawText('CUSTOMER:', { x: 50, y: yPos, size: 12, font: fontBold })
    yPos -= 15
    page.drawText('RNR Enterprises', { x: 50, y: yPos, size: 11, font })
    yPos -= 14
    page.drawText('1361 Co Rd', { x: 50, y: yPos, size: 11, font })
    yPos -= 14
    page.drawText('Sugarcreek, OH 44681', { x: 50, y: yPos, size: 11, font })
    yPos -= 30

    // Supplier Info
    page.drawText('SUPPLIER:', { x: 50, y: yPos, size: 12, font: fontBold })
    yPos -= 15
    page.drawText(load.supplier_name || 'N/A', { x: 50, y: yPos, size: 11, font })
    yPos -= 14
    if (load.location_name) {
      page.drawText(load.location_name, { x: 50, y: yPos, size: 11, font })
      yPos -= 14
    }
    if (load.address) {
      page.drawText(load.address, { x: 50, y: yPos, size: 11, font })
      yPos -= 14
    }
    if (load.city || load.state || load.zip_code) {
      page.drawText(`${load.city || ''}, ${load.state || ''} ${load.zip_code || ''}`, { x: 50, y: yPos, size: 11, font })
      yPos -= 14
    }
    yPos -= 20

    // Table Header
    page.drawText('Qty (BF)', { x: 50, y: yPos, size: 10, font: fontBold })
    page.drawText('Species', { x: 120, y: yPos, size: 10, font: fontBold })
    page.drawText('Grade', { x: 220, y: yPos, size: 10, font: fontBold })
    page.drawText('Thickness', { x: 290, y: yPos, size: 10, font: fontBold })
    page.drawText('Price/BF', { x: 370, y: yPos, size: 10, font: fontBold })
    page.drawText('Pickup/Del', { x: 460, y: yPos, size: 10, font: fontBold })
    yPos -= 5
    
    // Line under header
    page.drawLine({
      start: { x: 50, y: yPos },
      end: { x: 550, y: yPos },
      thickness: 1,
      color: rgb(0, 0, 0)
    })
    yPos -= 15

    // Items
    itemsResult.rows.forEach((item: any) => {
      page.drawText((item.estimated_footage || 0).toLocaleString(), { x: 50, y: yPos, size: 10, font })
      page.drawText(item.species || '', { x: 120, y: yPos, size: 10, font })
      page.drawText(item.grade || '', { x: 220, y: yPos, size: 10, font })
      page.drawText(item.thickness?.toString() || '', { x: 290, y: yPos, size: 10, font })
      page.drawText(`$${(item.price || 0).toFixed(2)}`, { x: 370, y: yPos, size: 10, font })
      page.drawText(load.pickup_or_delivery === 'pickup' ? 'Pickup' : 'Delivery', { x: 460, y: yPos, size: 10, font })
      yPos -= 20
    })

    yPos -= 5
    // Line after items
    page.drawLine({
      start: { x: 50, y: yPos },
      end: { x: 550, y: yPos },
      thickness: 1,
      color: rgb(0, 0, 0)
    })
    yPos -= 20

    // Comments
    if (load.comments) {
      page.drawText('COMMENTS:', { x: 50, y: yPos, size: 11, font: fontBold })
      yPos -= 15
      const commentLines = load.comments.split('\n')
      commentLines.forEach((line: string) => {
        // Wrap long lines
        const maxWidth = 500
        const words = line.split(' ')
        let currentLine = ''
        
        words.forEach((word: string) => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word
          const width = font.widthOfTextAtSize(testLine, 10)
          
          if (width > maxWidth && currentLine) {
            page.drawText(currentLine, { x: 50, y: yPos, size: 10, font })
            yPos -= 14
            currentLine = word
          } else {
            currentLine = testLine
          }
        })
        
        if (currentLine) {
          page.drawText(currentLine, { x: 50, y: yPos, size: 10, font })
          yPos -= 14
        }
      })
      yPos -= 10
    }

    // Important Notice
    yPos -= 20
    const noticeText = 'PLEASE USE OUR PO NUMBER(S) ON ALL PAPERWORK'
    const noticeWidth = fontBold.widthOfTextAtSize(noticeText, 16)
    page.drawText(noticeText, {
      x: 306 - (noticeWidth / 2),
      y: yPos,
      size: 16,
      font: fontBold,
      color: rgb(1, 0, 0) // Red
    })

    // Generate PDF buffer
    console.log('Generating PDF bytes...')
    const pdfBytes = await pdfDoc.save()
    console.log('PDF bytes generated, size:', pdfBytes.length)
    const pdfBuffer = Buffer.from(pdfBytes)
    console.log('PDF buffer created')

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PO-${poNumber}.pdf"`
      }
    })
  } catch (error: any) {
    console.error('Error generating PO:', error)
    console.error('Error stack:', error.stack)
    console.error('Error message:', error.message)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
