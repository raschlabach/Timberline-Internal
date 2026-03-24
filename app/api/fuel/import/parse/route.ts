import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { parseFuelReport } from '@/lib/fuel-report-parser'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file || !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const pdfData = await pdfParse(buffer)
    const parsed = parseFuelReport(pdfData.text)

    if (parsed.vehicles.length === 0) {
      return NextResponse.json({ error: 'No vehicle data found in this PDF' }, { status: 400 })
    }

    const trucksResult = await query(`
      SELECT id, name, voyager_vehicle_description
      FROM fuel_trucks
      WHERE voyager_vehicle_description IS NOT NULL AND is_active = true
    `)

    const truckMap = new Map<string, { id: number; name: string }>()
    for (const row of trucksResult.rows) {
      truckMap.set(row.voyager_vehicle_description, { id: row.id, name: row.name })
    }

    const vehicles = parsed.vehicles.map((v) => {
      const match = truckMap.get(v.vehicleDescription)
      return {
        ...v,
        matchedTruckId: match?.id || null,
        matchedTruckName: match?.name || null,
      }
    })

    return NextResponse.json({
      filename: file.name,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      vehicles,
    })
  } catch (error) {
    console.error('Error parsing fuel report:', error)
    return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 })
  }
}
