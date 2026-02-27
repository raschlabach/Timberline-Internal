import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

interface ParsedRow {
  shipToName: string
  address: string
  skidQty: number
  isBundle: boolean
  pickupDate: Date | null
  deliveryDate: Date | null
}

interface ParsedSheet {
  weekLabel: string
  weekDate: Date | null
  rows: ParsedRow[]
}

function cleanNameForMatching(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function parseExcelDate(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'string') {
    if (val === '?' || val.trim() === '') return null
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569)
    return new Date(utcDays * 86400 * 1000)
  }
  return null
}

function parseWeekDate(label: string): Date | null {
  const match = label.match(/Week\s+of:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
  if (!match) return null
  const parts = match[1].split('/')
  if (parts.length !== 3) return null
  const month = parseInt(parts[0])
  const day = parseInt(parts[1])
  let year = parseInt(parts[2])
  if (year < 100) year += 2000
  const d = new Date(year, month - 1, day)
  return isNaN(d.getTime()) ? null : d
}

function parseSkidQty(val: unknown): { qty: number; isBundle: boolean } {
  if (typeof val === 'number') {
    return { qty: Math.floor(val), isBundle: false }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    const isBdl = /bdl/i.test(trimmed)
    const numMatch = trimmed.match(/(\d+)/)
    const qty = numMatch ? parseInt(numMatch[1]) : 0
    return { qty, isBundle: isBdl }
  }
  return { qty: 0, isBundle: false }
}

function parseSheet(ws: XLSX.WorkSheet): ParsedSheet {
  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  })

  let weekLabel = ''
  let weekDate: Date | null = null

  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i]
    if (!row) continue
    for (const cell of row) {
      if (typeof cell === 'string' && /week\s+of:/i.test(cell)) {
        weekLabel = cell.trim()
        weekDate = parseWeekDate(cell)
        break
      }
    }
    if (weekLabel) break
  }

  let headerRow = -1
  for (let i = 0; i < Math.min(data.length, 15); i++) {
    const row = data[i]
    if (!row) continue
    const firstCell = typeof row[0] === 'string' ? row[0].toLowerCase() : ''
    const secondCell = typeof row[1] === 'string' ? row[1].toLowerCase() : ''
    if (firstCell.includes('skid') || secondCell.includes('ship to')) {
      headerRow = i
      break
    }
  }

  if (headerRow === -1) headerRow = 5

  const rows: ParsedRow[] = []

  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i]
    if (!row) continue

    const shipToName = row[1]
    if (!shipToName || typeof shipToName !== 'string' || !shipToName.trim()) continue

    const skidRaw = row[0]
    if (skidRaw === null || skidRaw === undefined) continue

    const { qty, isBundle } = parseSkidQty(skidRaw)
    if (qty === 0) continue

    rows.push({
      shipToName: shipToName.trim(),
      address: typeof row[2] === 'string' ? row[2].trim() : '',
      skidQty: qty,
      isBundle,
      pickupDate: parseExcelDate(row[3]),
      deliveryDate: parseExcelDate(row[4]),
    })
  }

  return { weekLabel, weekDate, rows }
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

    const existingWeeksResult = await client.query(
      `SELECT DISTINCT week_label FROM bentwood_imports WHERE week_label IS NOT NULL`
    )
    const existingWeeks = new Set(
      existingWeeksResult.rows.map((r: { week_label: string }) => r.week_label.trim())
    )

    const nameMapResult = await client.query(
      `SELECT bentwood_name, customer_id FROM bentwood_customer_map`
    )
    const savedNameMap = new Map<string, number>()
    for (const m of nameMapResult.rows) {
      savedNameMap.set(m.bentwood_name.trim().toLowerCase(), m.customer_id)
    }

    const customersResult = await client.query(
      `SELECT id, customer_name FROM customers`
    )
    const customerNameMap = new Map<string, number>()
    for (const c of customersResult.rows) {
      customerNameMap.set(c.customer_name.toLowerCase().trim(), c.id)
    }

    const importResults: { importId: number; weekLabel: string; itemCount: number }[] = []
    const skippedSheets: string[] = []

    await client.query('BEGIN')

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const parsed = parseSheet(ws)

      if (parsed.rows.length === 0) continue

      if (parsed.weekLabel && existingWeeks.has(parsed.weekLabel)) {
        skippedSheets.push(parsed.weekLabel)
        continue
      }

      let totalSkids = 0
      let totalBundles = 0
      for (const row of parsed.rows) {
        if (row.isBundle) {
          totalBundles += row.skidQty
        } else {
          totalSkids += row.skidQty
        }
      }

      const importResult = await client.query(
        `INSERT INTO bentwood_imports (
          file_name, week_label, week_date,
          total_items, total_skids, total_bundles,
          status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          file.name,
          parsed.weekLabel || null,
          parsed.weekDate,
          parsed.rows.length,
          totalSkids,
          totalBundles,
          'active',
          session.user.id,
        ]
      )

      const importId = importResult.rows[0].id

      for (const row of parsed.rows) {
        let matchedCustomerId: number | null = null
        let customerMatched = false

        const cleanName = cleanNameForMatching(row.shipToName)
        if (savedNameMap.has(cleanName)) {
          matchedCustomerId = savedNameMap.get(cleanName) || null
          customerMatched = true
        }

        if (!customerMatched && customerNameMap.has(cleanName)) {
          matchedCustomerId = customerNameMap.get(cleanName) || null
          customerMatched = true
        }

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
          `INSERT INTO bentwood_import_items (
            import_id, ship_to_name, address, skid_qty, is_bundle,
            pickup_date, delivery_date, freight_quote,
            customer_matched, matched_customer_id, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            importId,
            row.shipToName,
            row.address || null,
            row.skidQty,
            row.isBundle,
            row.pickupDate,
            row.deliveryDate,
            0,
            customerMatched,
            matchedCustomerId,
            'pending',
          ]
        )
      }

      importResults.push({
        importId,
        weekLabel: parsed.weekLabel,
        itemCount: parsed.rows.length,
      })
    }

    await client.query('COMMIT')

    const parts: string[] = []
    if (importResults.length > 0) {
      parts.push(`Imported ${importResults.length} sheet(s) with ${importResults.reduce((s, i) => s + i.itemCount, 0)} items`)
    }
    if (skippedSheets.length > 0) {
      parts.push(`Skipped ${skippedSheets.length} already-imported week(s)`)
    }
    if (importResults.length === 0 && skippedSheets.length > 0) {
      parts.push('All weeks in this file have already been imported')
    }

    return NextResponse.json({
      success: true,
      imports: importResults,
      skippedSheets,
      message: parts.join('. '),
    })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Error uploading Bentwood file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process upload' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
