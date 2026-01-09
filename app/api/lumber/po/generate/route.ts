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
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
    const deliveryMonth = load.estimated_delivery_date 
      ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'TBD'

    const pageWidth = 612
    const pageHeight = 792
    const margin = 40
    const blueColor = rgb(0.2, 0.4, 0.8) // Professional blue

    let yPos = pageHeight - margin

    // Header with blue background
    page.drawRectangle({
      x: 0,
      y: yPos - 60,
      width: pageWidth,
      height: 60,
      color: blueColor
    })

    // Title
    const titleText = 'PURCHASE ORDER'
    page.drawText(titleText, {
      x: margin,
      y: yPos - 35,
      size: 24,
      font: fontBold,
      color: rgb(1, 1, 1)
    })

    // PO Number in header
    page.drawText(`PO #: ${poNumber}`, {
      x: pageWidth - margin - fontBold.widthOfTextAtSize(`PO #: ${poNumber}`, 14),
      y: yPos - 35,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1)
    })

    yPos -= 80

    // Date and Delivery Info Box
    page.drawRectangle({
      x: pageWidth - margin - 180,
      y: yPos - 70,
      width: 180,
      height: 70,
      color: rgb(0.95, 0.97, 1),
      borderColor: blueColor,
      borderWidth: 1
    })

    page.drawText('ORDER DETAILS', {
      x: pageWidth - margin - 170,
      y: yPos - 20,
      size: 9,
      font: fontBold,
      color: blueColor
    })

    page.drawText(`Date: ${currentDate}`, {
      x: pageWidth - margin - 170,
      y: yPos - 38,
      size: 9,
      font
    })

    page.drawText(`Delivery: ${deliveryMonth}`, {
      x: pageWidth - margin - 170,
      y: yPos - 54,
      size: 9,
      font
    })

    // Customer Section
    page.drawText('CUSTOMER', {
      x: margin,
      y: yPos - 20,
      size: 10,
      font: fontBold,
      color: blueColor
    })

    yPos -= 38
    page.drawText('RNR Enterprises', { x: margin, y: yPos, size: 11, font: fontBold })
    yPos -= 14
    page.drawText('1361 County Road 108', { x: margin, y: yPos, size: 10, font })
    yPos -= 13
    page.drawText('Sugarcreek, OH 44681', { x: margin, y: yPos, size: 10, font })
    yPos -= 30

    // Supplier Section
    page.drawText('VENDOR', {
      x: margin,
      y: yPos,
      size: 10,
      font: fontBold,
      color: blueColor
    })

    yPos -= 18
    page.drawText(load.supplier_name || 'N/A', { x: margin, y: yPos, size: 11, font: fontBold })
    yPos -= 14
    if (load.location_name) {
      page.drawText(load.location_name, { x: margin, y: yPos, size: 10, font })
      yPos -= 13
    }
    if (load.address) {
      page.drawText(load.address, { x: margin, y: yPos, size: 10, font })
      yPos -= 13
    }
    if (load.city || load.state || load.zip_code) {
      page.drawText(`${load.city || ''}, ${load.state || ''} ${load.zip_code || ''}`, { x: margin, y: yPos, size: 10, font })
      yPos -= 13
    }
    yPos -= 25

    // Items Table
    const tableTop = yPos
    const tableHeaderHeight = 25
    const rowHeight = 22

    // Table header background
    page.drawRectangle({
      x: margin,
      y: tableTop - tableHeaderHeight,
      width: pageWidth - (2 * margin),
      height: tableHeaderHeight,
      color: rgb(0.95, 0.97, 1)
    })

    // Table header border
    page.drawRectangle({
      x: margin,
      y: tableTop - tableHeaderHeight,
      width: pageWidth - (2 * margin),
      height: tableHeaderHeight,
      borderColor: blueColor,
      borderWidth: 1.5
    })

    // Column headers
    const cols = {
      qty: margin + 5,
      species: margin + 75,
      grade: margin + 175,
      thickness: margin + 250,
      price: margin + 330,
      pickup: margin + 420
    }

    page.drawText('QTY (BF)', { x: cols.qty, y: tableTop - 17, size: 9, font: fontBold, color: blueColor })
    page.drawText('SPECIES', { x: cols.species, y: tableTop - 17, size: 9, font: fontBold, color: blueColor })
    page.drawText('GRADE', { x: cols.grade, y: tableTop - 17, size: 9, font: fontBold, color: blueColor })
    page.drawText('THICK', { x: cols.thickness, y: tableTop - 17, size: 9, font: fontBold, color: blueColor })
    page.drawText('PRICE/BF', { x: cols.price, y: tableTop - 17, size: 9, font: fontBold, color: blueColor })
    page.drawText('TYPE', { x: cols.pickup, y: tableTop - 17, size: 9, font: fontBold, color: blueColor })

    yPos = tableTop - tableHeaderHeight - 5

    // Store the starting position for side borders
    const tableContentTop = tableTop - tableHeaderHeight

    // Table rows with alternating colors
    itemsResult.rows.forEach((item: any, index: number) => {
      const price = Number(item.price) || 0
      const footage = Number(item.estimated_footage) || 0
      const thickness = item.thickness ? String(item.thickness) : ''
      
      // Alternating row background
      if (index % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: yPos - rowHeight + 5,
          width: pageWidth - (2 * margin),
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98)
        })
      }

      yPos -= 15
      page.drawText(footage.toLocaleString(), { x: cols.qty, y: yPos, size: 10, font })
      page.drawText(item.species || '', { x: cols.species, y: yPos, size: 10, font })
      page.drawText(item.grade || '', { x: cols.grade, y: yPos, size: 10, font })
      page.drawText(thickness, { x: cols.thickness, y: yPos, size: 10, font })
      page.drawText(`$${price.toFixed(2)}`, { x: cols.price, y: yPos, size: 10, font })
      page.drawText(load.pickup_or_delivery === 'pickup' ? 'Pickup' : 'Delivered', { x: cols.pickup, y: yPos, size: 10, font })
      yPos -= 7
    })

    // Table bottom border
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: pageWidth - margin, y: yPos },
      thickness: 1.5,
      color: blueColor
    })

    // Left and right table borders
    const tableContentBottom = yPos
    page.drawLine({
      start: { x: margin, y: tableContentTop },
      end: { x: margin, y: tableContentBottom },
      thickness: 1.5,
      color: blueColor
    })
    page.drawLine({
      start: { x: pageWidth - margin, y: tableContentTop },
      end: { x: pageWidth - margin, y: tableContentBottom },
      thickness: 1.5,
      color: blueColor
    })

    yPos -= 25

    // Comments Section
    if (load.comments) {
      page.drawText('COMMENTS', {
        x: margin,
        y: yPos,
        size: 10,
        font: fontBold,
        color: blueColor
      })
      yPos -= 15

      // Comments box
      const commentsBoxHeight = 60
      page.drawRectangle({
        x: margin,
        y: yPos - commentsBoxHeight + 10,
        width: pageWidth - (2 * margin),
        height: commentsBoxHeight,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1
      })

      yPos -= 10
      const commentLines = load.comments.split('\n')
      commentLines.forEach((line: string) => {
        const maxWidth = pageWidth - (2 * margin) - 20
        const words = line.split(' ')
        let currentLine = ''
        
        words.forEach((word: string) => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word
          const width = font.widthOfTextAtSize(testLine, 9)
          
          if (width > maxWidth && currentLine) {
            page.drawText(currentLine, { x: margin + 10, y: yPos, size: 9, font })
            yPos -= 12
            currentLine = word
          } else {
            currentLine = testLine
          }
        })
        
        if (currentLine) {
          page.drawText(currentLine, { x: margin + 10, y: yPos, size: 9, font })
          yPos -= 12
        }
      })
      yPos -= 20
    }

    // Important Notice at Bottom
    const bottomY = 60
    const noticeText = 'Please use our PO number(s) on all paperwork'
    const noticeWidth = font.widthOfTextAtSize(noticeText, 10)
    page.drawText(noticeText, {
      x: (pageWidth - noticeWidth) / 2,
      y: bottomY,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3)
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
