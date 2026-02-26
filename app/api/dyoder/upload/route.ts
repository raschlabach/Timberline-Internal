import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

interface ParsedRow {
  customerName: string
  specialTops: string
  totalBf: number
  linealTrailerFt: number
  linealSkidFt: number
  skidCount: number
  weight: number
  shipDate: Date | null
}

interface ParsedSheet {
  batchNumber: string
  shipFrom: string
  shipToState: string
  rows: ParsedRow[]
  totalWeight: number
}

function cleanNameForMatching(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function parseExcelDate(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569)
    return new Date(utcDays * 86400 * 1000)
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function parseSheet(ws: XLSX.WorkSheet): ParsedSheet {
  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  })

  let shipFrom = ''
  let shipToState = ''
  let batchNumber = ''

  // Row 1: Ship From and Ship to State
  if (data[1]) {
    const shipFromVal = data[1][2]
    if (typeof shipFromVal === 'string') {
      shipFrom = shipFromVal.split('\n')[0].replace('Ship From:', '').trim()
    }
    const stateVal = data[1][5]
    if (typeof stateVal === 'string') {
      shipToState = stateVal.replace('Ship to State:', '').trim()
    }
  }

  // Row 2: Batch number
  if (data[2]) {
    const batchVal = data[2][5]
    if (typeof batchVal === 'string') {
      const match = batchVal.match(/Batch:\s*(\d+)/)
      if (match) batchNumber = match[1]
    }
  }

  const rows: ParsedRow[] = []
  let totalWeight = 0

  // Row 4 is headers, data starts at row 5
  for (let i = 5; i < data.length; i++) {
    const row = data[i]
    if (!row) continue

    const customerName = row[0]
    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) continue

    // Skip totals rows
    const nameLower = customerName.toLowerCase()
    if (nameLower.includes('total')) continue

    const totalBfRaw = typeof row[2] === 'string' ? parseFloat(row[2].replace(/,/g, '')) : (typeof row[2] === 'number' ? row[2] : 0)
    const linealTrailerFtRaw = typeof row[3] === 'string' ? parseFloat(row[3].replace(/,/g, '')) : (typeof row[3] === 'number' ? row[3] : 0)
    const linealSkidFtRaw = typeof row[4] === 'string' ? parseFloat(row[4].replace(/,/g, '')) : (typeof row[4] === 'number' ? row[4] : 0)
    const weightRaw = typeof row[5] === 'string' ? parseFloat(row[5].replace(/,/g, '')) : (typeof row[5] === 'number' ? row[5] : 0)

    const totalBf = isNaN(totalBfRaw) ? 0 : totalBfRaw
    const linealTrailerFt = isNaN(linealTrailerFtRaw) ? 0 : linealTrailerFtRaw
    const linealSkidFt = isNaN(linealSkidFtRaw) ? 0 : linealSkidFtRaw
    const weight = isNaN(weightRaw) ? 0 : weightRaw

    // Round UP lineal trailer ft to get skid count
    const skidCount = linealTrailerFt > 0 ? Math.ceil(linealTrailerFt) : 0

    const specialTops = typeof row[1] === 'string' ? row[1].trim() : ''
    const shipDate = parseExcelDate(row[6])

    totalWeight += weight

    rows.push({
      customerName: customerName.trim(),
      specialTops,
      totalBf,
      linealTrailerFt,
      linealSkidFt,
      skidCount,
      weight,
      shipDate,
    })
  }

  return { batchNumber, shipFrom, shipToState, rows, totalWeight }
}

export async function POST(request: NextRequest) {
  const client = await getClient()

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      client.release()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      client.release()
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })

    // Check which batch numbers already exist
    const existingBatchesResult = await client.query(
      `SELECT DISTINCT batch_number FROM dyoder_imports WHERE batch_number IS NOT NULL`
    )
    const existingBatches = new Set(
      existingBatchesResult.rows.map((r: { batch_number: string }) => r.batch_number.trim())
    )

    // Load saved customer name → customer mappings
    const nameMapResult = await client.query(
      `SELECT dyoder_name, customer_id FROM dyoder_customer_map`
    )
    const savedNameMap = new Map<string, number>()
    for (const m of nameMapResult.rows) {
      savedNameMap.set(m.dyoder_name.trim().toLowerCase(), m.customer_id)
    }

    // Load all customers for fuzzy name matching
    const customersResult = await client.query(
      `SELECT id, customer_name FROM customers`
    )
    const customerNameMap = new Map<string, number>()
    for (const c of customersResult.rows) {
      customerNameMap.set(c.customer_name.toLowerCase().trim(), c.id)
    }

    const importResults: { importId: number; batchNumber: string; itemCount: number }[] = []
    const skippedSheets: string[] = []

    await client.query('BEGIN')

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const parsed = parseSheet(ws)

      if (parsed.rows.length === 0) continue

      // Skip if batch already imported
      if (parsed.batchNumber && existingBatches.has(parsed.batchNumber)) {
        skippedSheets.push(`Batch ${parsed.batchNumber}`)
        continue
      }

      const importResult = await client.query(
        `INSERT INTO dyoder_imports (
          file_name, batch_number, ship_from, ship_to_state,
          total_items, total_weight, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          file.name,
          parsed.batchNumber || null,
          parsed.shipFrom || 'D. Yoder Hardwoods',
          parsed.shipToState || null,
          parsed.rows.length,
          parsed.totalWeight,
          'active',
          session.user.id,
        ]
      )

      const importId = importResult.rows[0].id

      for (const row of parsed.rows) {
        let matchedCustomerId: number | null = null
        let customerMatched = false

        // Priority 1: Check saved D Yoder name mapping
        const cleanName = cleanNameForMatching(row.customerName)
        if (savedNameMap.has(cleanName)) {
          matchedCustomerId = savedNameMap.get(cleanName) || null
          customerMatched = true
        }

        // Priority 2: Exact match against customers table
        if (!customerMatched && customerNameMap.has(cleanName)) {
          matchedCustomerId = customerNameMap.get(cleanName) || null
          customerMatched = true
        }

        // Priority 3: Substring / first-two-word matching
        if (!customerMatched) {
          const shipWords = cleanName.split(' ').filter((w: string) => w.length > 1)
          const entries = Array.from(customerNameMap.entries())
          for (let ci = 0; ci < entries.length; ci++) {
            const custName = entries[ci][0]
            const custId = entries[ci][1]
            if (custName.includes(cleanName) || cleanName.includes(custName)) {
              matchedCustomerId = custId
              customerMatched = true
              break
            }
            if (shipWords.length >= 2) {
              const custWords = custName.split(' ').filter((w: string) => w.length > 1)
              if (custWords.length >= 2 &&
                  custWords[0] === shipWords[0] &&
                  custWords[1] === shipWords[1]) {
                matchedCustomerId = custId
                customerMatched = true
                break
              }
            }
          }
        }

        await client.query(
          `INSERT INTO dyoder_import_items (
            import_id, customer_name, special_tops, total_bf,
            lineal_trailer_ft, lineal_skid_ft, skid_count,
            weight, ship_date, freight_quote,
            customer_matched, matched_customer_id, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            importId,
            row.customerName,
            row.specialTops || null,
            row.totalBf,
            row.linealTrailerFt,
            row.linealSkidFt,
            row.skidCount,
            row.weight,
            row.shipDate,
            0,
            customerMatched,
            matchedCustomerId,
            'pending',
          ]
        )
      }

      importResults.push({
        importId,
        batchNumber: parsed.batchNumber,
        itemCount: parsed.rows.length,
      })
    }

    await client.query('COMMIT')

    const parts: string[] = []
    if (importResults.length > 0) {
      parts.push(`Imported ${importResults.length} batch(es) with ${importResults.reduce((s, i) => s + i.itemCount, 0)} items`)
    }
    if (skippedSheets.length > 0) {
      parts.push(`Skipped ${skippedSheets.length} already-imported batch(es)`)
    }
    if (importResults.length === 0 && skippedSheets.length > 0) {
      parts.push('All batches in this file have already been imported')
    }

    return NextResponse.json({
      success: true,
      imports: importResults,
      skippedSheets,
      message: parts.join('. '),
    })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Error uploading D Yoder file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process upload' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
