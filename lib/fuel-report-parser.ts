export interface ParsedTransaction {
  transactionDate: string
  merchantName: string
  merchantCity: string
  state: string
  invoiceNumber: string
  odometer: number
  productCode: string
  quantity: number
  unitCost: number
  transAmount: number
}

export interface ParsedVehicleReport {
  vehicleDescription: string
  transactions: ParsedTransaction[]
  totalQuantity: number
  totalAmount: number
}

export interface ParsedFuelReport {
  dateFrom: string
  dateTo: string
  vehicles: ParsedVehicleReport[]
}

function parseNumber(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

const DATE_RE = /^\d{2}-\d{2}-\d{4}$/

function convertDate(raw: string): string {
  const [mm, dd, yyyy] = raw.split('-')
  return `${yyyy}-${mm}-${dd}`
}

function splitByPages(text: string): string[] {
  const pageMarker = /Page\s+\n?\s*\d+\s*\n?\s*of\s*\n?\s*\d+/g
  const positions: number[] = []
  let m
  while ((m = pageMarker.exec(text)) !== null) {
    positions.push(m.index)
  }

  if (positions.length === 0) return [text]

  const pages: string[] = []

  if (positions[0] > 0) {
    pages.push(text.slice(0, positions[0]))
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i]
    const end = i + 1 < positions.length ? positions[i + 1] : text.length
    pages.push(text.slice(start, end))
  }
  return pages
}

function parsePage(pageText: string): ParsedVehicleReport | null {
  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean)

  const vdHeaderIdx = lines.findIndex(
    (l, i) => l === 'Vehicle Description' && i + 1 < lines.length && lines[i + 1] === 'License Tag'
  )
  if (vdHeaderIdx === -1) return null

  const secondVdIdx = lines.findIndex(
    (l, i) => i > vdHeaderIdx + 2 && l === 'Vehicle Description'
  )
  if (secondVdIdx === -1) return null

  const level1Idx = lines.findIndex(
    (l, i) => i > secondVdIdx && l.startsWith('Level 1')
  )
  if (level1Idx === -1 || level1Idx + 1 >= lines.length) return null

  const vehicleDescription = lines[level1Idx + 1]
  if (!vehicleDescription || vehicleDescription.startsWith('Level')) return null

  const fuelIdx = lines.findIndex((l, i) => i > level1Idx && l === 'Fuel')
  if (fuelIdx === -1) return null

  const dataLines = lines.slice(fuelIdx + 1)

  const transactions: ParsedTransaction[] = []
  let totalQuantity = 0
  let totalAmount = 0

  let i = 0
  while (i < dataLines.length) {
    const line = dataLines[i]

    if (line === 'Total Fuel') {
      if (i + 1 < dataLines.length) totalQuantity = parseNumber(dataLines[i + 1])
      if (i + 2 < dataLines.length) totalAmount = parseNumber(dataLines[i + 2])
      break
    }

    if (DATE_RE.test(line)) {
      const txnLines: string[] = [line]
      let j = i + 1
      while (j < dataLines.length && !DATE_RE.test(dataLines[j]) && dataLines[j] !== 'Total Fuel') {
        txnLines.push(dataLines[j])
        j++
      }

      const txn = parseTransactionFields(txnLines)
      if (txn) transactions.push(txn)
      i = j
      continue
    }

    i++
  }

  if (transactions.length === 0) return null

  if (totalQuantity === 0) {
    totalQuantity = transactions.reduce((s, t) => s + t.quantity, 0)
    totalAmount = transactions.reduce((s, t) => s + t.transAmount, 0)
  }

  return { vehicleDescription, transactions, totalQuantity, totalAmount }
}

function parseTransactionFields(fields: string[]): ParsedTransaction | null {
  if (fields.length < 8) return null

  const transactionDate = convertDate(fields[0])
  const merchantName = fields[1] || ''
  const merchantCity = fields[2] || ''
  const state = fields[3] || ''
  const invoiceNumber = fields[4] || ''

  const prodIdx = fields.findIndex((f, i) => i > 4 && /^[A-Z]{3,5}$/.test(f))
  if (prodIdx === -1 || prodIdx + 3 >= fields.length) return null

  const productCode = fields[prodIdx]
  const odometer = prodIdx >= 1 ? parseNumber(fields[prodIdx - 1]) : 0
  const quantity = parseNumber(fields[prodIdx + 1])
  const unitCost = parseNumber(fields[prodIdx + 2])
  const transAmount = parseNumber(fields[prodIdx + 3])

  if (quantity === 0) return null

  return {
    transactionDate,
    merchantName,
    merchantCity,
    state,
    invoiceNumber,
    odometer,
    productCode,
    quantity,
    unitCost,
    transAmount,
  }
}

export function parseFuelReport(text: string): ParsedFuelReport {
  const dateRangeMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+(?:to|-)\s+(\d{2}\/\d{2}\/\d{4})/)
  let dateFrom = ''
  let dateTo = ''
  if (dateRangeMatch) {
    const [, from, to] = dateRangeMatch
    const [fm, fd, fy] = from.split('/')
    const [tm, td, ty] = to.split('/')
    dateFrom = `${fy}-${fm}-${fd}`
    dateTo = `${ty}-${tm}-${td}`
  }

  const rangeAlt = text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/)
  if (!dateFrom && rangeAlt) {
    const [, from, to] = rangeAlt
    const [fm, fd, fy] = from.split('/')
    const [tm, td, ty] = to.split('/')
    dateFrom = `${fy}-${fm}-${fd}`
    dateTo = `${ty}-${tm}-${td}`
  }

  const pages = splitByPages(text)
  const vehicleMap = new Map<string, ParsedVehicleReport>()

  for (const page of pages) {
    const parsed = parsePage(page)
    if (!parsed) continue

    const existing = vehicleMap.get(parsed.vehicleDescription)
    if (existing) {
      existing.transactions.push(...parsed.transactions)
      existing.totalQuantity += parsed.totalQuantity
      existing.totalAmount += parsed.totalAmount
    } else {
      vehicleMap.set(parsed.vehicleDescription, parsed)
    }
  }

  const vehicles = Array.from(vehicleMap.values())
  return { dateFrom, dateTo, vehicles }
}
