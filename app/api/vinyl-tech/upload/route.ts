import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

interface ParsedRow {
  vtCode: string
  shipToName: string
  skid16ft: number
  skid12ft: number
  skid4x8: number
  misc: number
  weight: number
  notesOnSkids: string
  additionalNotes: string
  scheduleNotes: string
}

interface ParsedSheet {
  weekLabel: string
  weekDate: Date | null
  sheetStatus: string
  rows: ParsedRow[]
  totalWeight: number
}

function excelDateToJSDate(serial: number): Date | null {
  if (!serial || typeof serial !== 'number') return null
  const utcDays = Math.floor(serial - 25569)
  return new Date(utcDays * 86400 * 1000)
}

function parseSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedSheet {
  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  })

  const weekLabel = sheetName
  let weekDate: Date | null = null
  let sheetStatus = ''

  if (data[5]) {
    const dateVal = data[5][5]
    if (typeof dateVal === 'number') {
      weekDate = excelDateToJSDate(dateVal)
    }
    const statusVal = data[5][8]
    if (typeof statusVal === 'string') {
      sheetStatus = statusVal.trim()
    }
  }

  const rows: ParsedRow[] = []
  let totalWeight = 0

  for (let i = 12; i < data.length; i++) {
    const row = data[i]
    if (!row) continue

    const colC = row[2]
    if (typeof colC === 'string' && colC.trim().toLowerCase() === 'total') break

    const vtCode = row[1]
    const shipToName = row[2]

    if (!shipToName || typeof shipToName !== 'string' || !shipToName.trim()) continue

    const skid16ft = typeof row[3] === 'number' ? row[3] : 0
    const skid12ft = typeof row[4] === 'number' ? row[4] : 0
    const skid4x8 = typeof row[5] === 'number' ? row[5] : 0
    const misc = typeof row[6] === 'number' ? row[6] : 0
    const weight = typeof row[7] === 'number' ? row[7] : 0
    const notesOnSkids = typeof row[8] === 'string' ? row[8].trim() : ''
    const additionalNotes = typeof row[9] === 'string' ? row[9].trim() : ''

    const schedParts: string[] = []
    if (typeof row[10] === 'string' && row[10].trim()) schedParts.push(row[10].trim())
    if (typeof row[11] === 'string' && row[11].trim()) schedParts.push(row[11].trim())
    const scheduleNotes = schedParts.join(', ')

    totalWeight += weight

    rows.push({
      vtCode: typeof vtCode === 'string' ? vtCode.trim() : '',
      shipToName: shipToName.trim(),
      skid16ft,
      skid12ft,
      skid4x8,
      misc,
      weight,
      notesOnSkids,
      additionalNotes,
      scheduleNotes,
    })
  }

  return { weekLabel, weekDate, sheetStatus, rows, totalWeight }
}

function cleanNameForMatching(name: string): string {
  return name
    .replace(/\*+/g, '')
    .replace(/\*?NEW\*?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function matchCustomer(
  row: ParsedRow,
  vtCodeMap: Map<string, number>,
  customerNameMap: Map<string, number>
): { matchedCustomerId: number | null; customerMatched: boolean } {
  if (row.vtCode) {
    const vtKey = row.vtCode.trim().toUpperCase()
    if (vtCodeMap.has(vtKey)) {
      return { matchedCustomerId: vtCodeMap.get(vtKey) || null, customerMatched: true }
    }
  }

  const cleanName = cleanNameForMatching(row.shipToName)

  if (customerNameMap.has(cleanName)) {
    return { matchedCustomerId: customerNameMap.get(cleanName) || null, customerMatched: true }
  }

  const shipWords = cleanName.split(' ').filter((w: string) => w.length > 1)
  const entries = Array.from(customerNameMap.entries())
  for (let ci = 0; ci < entries.length; ci++) {
    const custName = entries[ci][0]
    const custId = entries[ci][1]
    if (custName.includes(cleanName) || cleanName.includes(custName)) {
      return { matchedCustomerId: custId, customerMatched: true }
    }
    if (shipWords.length >= 2) {
      const custWords = custName.split(' ').filter((w: string) => w.length > 1)
      if (custWords.length >= 2 &&
          custWords[0] === shipWords[0] &&
          custWords[1] === shipWords[1]) {
        return { matchedCustomerId: custId, customerMatched: true }
      }
    }
  }

  return { matchedCustomerId: null, customerMatched: false }
}

function calcFreightQuote(row: ParsedRow): number {
  const totalVinyl = row.skid16ft + row.skid12ft + row.skid4x8 + row.misc
  if (totalVinyl === 1) return 100
  if (totalVinyl >= 2) return totalVinyl * 75
  return 0
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

    // Check which week_labels already exist so we can detect new rows
    const existingImportsResult = await client.query(
      `SELECT id, week_label, status FROM vinyl_tech_imports`
    )
    const existingImportsByLabel = new Map<string, { id: number; status: string }>()
    for (const r of existingImportsResult.rows) {
      existingImportsByLabel.set(r.week_label.trim().toLowerCase(), { id: r.id, status: r.status })
    }

    // Load saved VT code → customer mappings
    const vtMapResult = await client.query(
      `SELECT vt_code, customer_id FROM vinyl_tech_customer_map`
    )
    const vtCodeMap = new Map<string, number>()
    for (const m of vtMapResult.rows) {
      vtCodeMap.set(m.vt_code.trim().toUpperCase(), m.customer_id)
    }

    // Load all customers for name matching
    const customersResult = await client.query(
      `SELECT id, customer_name FROM customers`
    )
    const customerNameMap = new Map<string, number>()
    for (const c of customersResult.rows) {
      customerNameMap.set(c.customer_name.toLowerCase().trim(), c.id)
    }

    const importResults: { importId: number; weekLabel: string; itemCount: number }[] = []
    const updatedResults: { importId: number; weekLabel: string; newItemCount: number }[] = []
    const skippedSheets: string[] = []

    await client.query('BEGIN')

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const parsed = parseSheet(ws, sheetName)

      if (parsed.rows.length === 0) continue

      const labelKey = sheetName.trim().toLowerCase()
      const existing = existingImportsByLabel.get(labelKey)

      if (existing) {
        // Sheet already imported — check for new rows to add
        const existingItemsResult = await client.query(
          `SELECT LOWER(TRIM(vt_code)) as vt_code, LOWER(TRIM(ship_to_name)) as ship_to_name
           FROM vinyl_tech_import_items WHERE import_id = $1`,
          [existing.id]
        )
        const existingKeys = new Set(
          existingItemsResult.rows.map((r: any) => `${r.vt_code || ''}||${r.ship_to_name}`)
        )

        const newRows = parsed.rows.filter(row => {
          const key = `${(row.vtCode || '').trim().toLowerCase()}||${row.shipToName.trim().toLowerCase()}`
          return !existingKeys.has(key)
        })

        if (newRows.length === 0) {
          skippedSheets.push(sheetName)
          continue
        }

        for (const row of newRows) {
          const { matchedCustomerId, customerMatched } = matchCustomer(row, vtCodeMap, customerNameMap)
          const hasFreight = row.skid16ft + row.skid12ft + row.skid4x8 + row.misc > 0
          const freightQuote = calcFreightQuote(row)

          await client.query(
            `INSERT INTO vinyl_tech_import_items (
              import_id, vt_code, ship_to_name,
              skid_16ft, skid_12ft, skid_4x8, misc,
              weight, notes_on_skids, additional_notes, schedule_notes,
              has_freight, customer_matched, matched_customer_id, freight_quote, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              existing.id,
              row.vtCode, row.shipToName,
              row.skid16ft, row.skid12ft, row.skid4x8, row.misc,
              row.weight, row.notesOnSkids, row.additionalNotes, row.scheduleNotes,
              hasFreight, customerMatched, matchedCustomerId, freightQuote,
              hasFreight ? 'pending' : 'skipped',
            ]
          )
        }

        // Recalculate totals for the existing import
        await client.query(
          `UPDATE vinyl_tech_imports
           SET total_items = (SELECT COUNT(*) FROM vinyl_tech_import_items WHERE import_id = $1),
               items_with_freight = (SELECT COUNT(*) FROM vinyl_tech_import_items WHERE import_id = $1 AND has_freight = true),
               total_weight = (SELECT COALESCE(SUM(weight), 0) FROM vinyl_tech_import_items WHERE import_id = $1),
               status = CASE WHEN status = 'completed' THEN 'active' ELSE status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [existing.id]
        )

        updatedResults.push({
          importId: existing.id,
          weekLabel: sheetName,
          newItemCount: newRows.length,
        })
      } else {
        // Brand-new sheet
        const importResult = await client.query(
          `INSERT INTO vinyl_tech_imports (
            file_name, week_label, week_date, sheet_status,
            total_items, items_with_freight, total_weight,
            status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id`,
          [
            file.name,
            parsed.weekLabel,
            parsed.weekDate,
            parsed.sheetStatus,
            parsed.rows.length,
            parsed.rows.filter(r => r.skid16ft + r.skid12ft + r.skid4x8 + r.misc > 0).length,
            parsed.totalWeight,
            'active',
            session.user.id,
          ]
        )

        const importId = importResult.rows[0].id

        for (const row of parsed.rows) {
          const { matchedCustomerId, customerMatched } = matchCustomer(row, vtCodeMap, customerNameMap)
          const hasFreight = row.skid16ft + row.skid12ft + row.skid4x8 + row.misc > 0
          const freightQuote = calcFreightQuote(row)

          await client.query(
            `INSERT INTO vinyl_tech_import_items (
              import_id, vt_code, ship_to_name,
              skid_16ft, skid_12ft, skid_4x8, misc,
              weight, notes_on_skids, additional_notes, schedule_notes,
              has_freight, customer_matched, matched_customer_id, freight_quote, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              importId,
              row.vtCode, row.shipToName,
              row.skid16ft, row.skid12ft, row.skid4x8, row.misc,
              row.weight, row.notesOnSkids, row.additionalNotes, row.scheduleNotes,
              hasFreight, customerMatched, matchedCustomerId, freightQuote,
              hasFreight ? 'pending' : 'skipped',
            ]
          )
        }

        importResults.push({
          importId,
          weekLabel: parsed.weekLabel,
          itemCount: parsed.rows.length,
        })
      }
    }

    await client.query('COMMIT')

    const parts: string[] = []
    if (importResults.length > 0) {
      parts.push(`Imported ${importResults.length} new week(s) with ${importResults.reduce((s, i) => s + i.itemCount, 0)} items`)
    }
    if (updatedResults.length > 0) {
      parts.push(`Added ${updatedResults.reduce((s, u) => s + u.newItemCount, 0)} new item(s) to ${updatedResults.length} existing week(s)`)
    }
    if (skippedSheets.length > 0) {
      parts.push(`Skipped ${skippedSheets.length} unchanged sheet(s)`)
    }
    if (importResults.length === 0 && updatedResults.length === 0 && skippedSheets.length > 0) {
      parts.push('All sheets in this file have already been imported with no new items')
    }

    return NextResponse.json({
      success: true,
      imports: importResults,
      updatedImports: updatedResults,
      skippedSheets,
      message: parts.join('. '),
    })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Error uploading vinyl tech file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process upload' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
