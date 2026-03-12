import * as XLSX from 'xlsx'

// ===== Types =====

export type CellValue = string | number | null

export interface SheetSection {
  rows: CellValue[][]
  rowExtPrices: number[]
  qtyTotal: number
  extPriceTotal: number
}

export interface ProcessedSheet {
  name: string
  poNumber: string
  dueDate: string
  displayHeaders: string[]
  sections: SheetSection[]
  grandQtyTotal: number
  grandExtTotal: number
  extPriceDisplayIdx: number
  partNumDisplayIdx: number
  missingPartCount: number
  tabProfile: string
  widthDisplayIdx: number
  speciesDisplayIdx: number
}

export interface SpecialRow {
  poNumber: string
  partNum: string
  quantity: number
  width: number
  profile: string
  thickness: number
  specie: string
  grade: string
  ripWidth: number
  sortOrder: number
  boardFt: number
}

export interface SpecialTabResult {
  label: string
  poNumbers: string[]
  dueDate: string
  ripRows: SpecialRow[]
  mouldRows: SpecialRow[]
  speciesTotals: { specie: string; boardFt: number }[]
  totalBoardFt: number
  missingPartCount: number
}

// ===== Constants =====

export const SPECIAL_TABS = ['Door Frame', 'R&R S4S', 'Moulding']
export const START_COL = 1

export const MOULD_RIP_WIDTH: Record<string, number> = {
  'Scribe SP-05': 1.875,
  'Batten SP-09': 2.5,
  'Quarter Round SP-13': 1.9375,
  'Crown CM02': 1.6875,
  'Crown Manorwood': 3,
  'Crown Pennwest': 2.975,
}

export const SORT_ORDER_MAP: Record<string, number> = {
  'PL 13': 1, 'S4S': 2, 'Quarter Round SP-13': 3, 'Slant Shaker': 4,
  'ISP01': 5, 'Crown Pennwest': 6, 'Crown Manorwood': 7,
  'Scribe SP-05': 1, 'Batten SP-09': 2, 'Crown CM02': 5,
}

export const SPECIE_MAP: Record<string, string> = {
  'RED OAK': 'Red Oak', 'SOFT MAPLE': 'Sap Soft Maple', 'SAP SOFT MAPLE': 'Sap Soft Maple',
  'HARD MAPLE': 'Hard Maple', 'CHERRY': 'Cherry', 'HICKORY': 'Hickory',
  'PINE': 'Pine', 'WALNUT': 'Walnut', 'S. MAPLE': 'Sap Soft Maple',
  'Red Oak': 'Red Oak', 'Red oak': 'Red Oak', 'Soft Maple': 'Sap Soft Maple',
  'Hard Maple': 'Hard Maple', 'Cherry': 'Cherry', 'Hickory': 'Hickory',
  'Pine': 'Pine', 'Walnut': 'Walnut',
}

export const RIP_HEADERS = ['PO#', 'Part#', 'Qty', 'Rip Width', 'Specie', 'Thick', 'Width', 'Profile', 'Grade', 'Board Ft', '$/BF', 'Our $']
export const MOULD_HEADERS = ['PO#', 'Part#', 'Qty', 'Width', 'Profile', 'Thickness', 'Specie', 'Grade', 'Sort Order']

// ===== Helpers =====

export function priceKey(profile: string, species: string): string {
  return `${profile}::${species}`
}

export function excelDateToString(serial: number): string {
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${date.getUTCDate()}-${month}`
}

export function normalizeSpecie(raw: string): string {
  const t = raw.trim()
  return SPECIE_MAP[t] ?? SPECIE_MAP[t.toUpperCase()] ?? t
}

export function fractionToDecimal(frac: string): number {
  const t = frac.trim()
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3])
  const simple = t.match(/^(\d+)\/(\d+)$/)
  if (simple) return parseInt(simple[1]) / parseInt(simple[2])
  return parseFloat(t) || 0
}

export function isPartMissing(val: string): boolean {
  return !val || val === 'null' || val === 'undefined' || val.trim() === ''
}

export function formatCell(val: CellValue, colIdx: number, headers: string[]): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') {
    const header = (headers[colIdx] || '').toUpperCase()
    if (header.includes('EXT') || header.includes('PRICE') || header.includes('PRICING')) return val.toFixed(2)
    if (Number.isInteger(val)) return val.toString()
    return parseFloat(val.toFixed(4)).toString()
  }
  return String(val)
}

export function formatNum(val: number, decimals = 3): string {
  return parseFloat(val.toFixed(decimals)).toString()
}

export function formatDollar(val: number): string {
  return val.toFixed(2)
}

// ===== Column Hiding =====

function getHiddenColumns(sheetName: string, headerRow: CellValue[], dataRows: CellValue[][]): Set<number> {
  const hidden = new Set<number>()
  const n = sheetName.trim().toUpperCase()
  const hdrAt = (i: number) => String(headerRow[i] ?? '').trim().toUpperCase()

  const findByHeader = (test: (h: string) => boolean): number => {
    for (let i = START_COL; i <= 15; i++) { if (test(hdrAt(i))) return i }
    return -1
  }

  const findPwCol = (): number => {
    for (let i = START_COL; i <= 12; i++) {
      if (hdrAt(i) !== '') continue
      for (let r = 5; r < Math.min(dataRows.length, 35); r++) {
        const cell = dataRows[r]?.[i]
        if (cell && /^(PW|PV|COL|Pvalley)/i.test(String(cell))) return i
      }
    }
    return -1
  }

  const hideExt = () => { const c = findByHeader(h => h.startsWith('EXT')); if (c >= 0) hidden.add(c) }
  const hideFaceLength = () => { const c = findByHeader(h => h.includes('FACE') && h.includes('LENGTH')); if (c >= 0) hidden.add(c) }

  if (n.includes('RAILS ISP01')) {
    const c = findByHeader(h => h === 'LENGTH'); if (c >= 0) hidden.add(c)
    hideExt()
  } else if (n.includes('2.1') && n.includes('SLANT RAIL')) {
    hideFaceLength(); hideExt()
  } else if (n.includes('2.35') && n.includes('SLANT RAIL')) {
    hideFaceLength(); hideExt()
  } else if (n.includes('2.35') && n.includes('SLANT STILE')) {
    hideExt()
  } else if (n.includes('2.85') && n.includes('SLANT STILE')) {
    const pw = findPwCol(); if (pw >= 0) hidden.add(pw)
    hideExt()
  } else if (n.includes('2.85') && n.includes('SLANT RAIL')) {
    hideFaceLength()
    const pw = findPwCol(); if (pw >= 0) hidden.add(pw)
    hideExt()
  } else if (n.includes('BLANK PANEL') || n.includes('DR FRONT') || n.includes('SILLS') || n.includes('STILES ISP01')) {
    hideExt()
  }

  return hidden
}

// ===== Tab Profile Mapping =====

function getTabProfile(sheetName: string): string {
  const n = sheetName.trim().toUpperCase()
  if (n.includes('ISP') && /ISP[-\s]?0?1/i.test(n)) return 'ISP01'
  if (n.includes('SLANT')) return 'Slant Shaker'
  if (n.includes('BLANK PANEL')) {
    if (n.includes('.600') || n.includes('600')) return 'Blank Panel .600'
    if (n.includes('.800') || n.includes('800')) return 'Blank Panel .800'
    return 'Blank Panel'
  }
  if (n.includes('DR FRONT')) return 'Dr Fronts'
  if (n.includes('SILLS') || n.includes('SILL')) return 'Sills'
  if (n.includes('SHKR')) return 'SHKR Dr Fr'
  if (n.includes('PINE')) return 'Pine'
  if (n.includes('DOOR FRAME') || n.includes('R&R S4S') || n.includes('MOULDING')) return ''
  return sheetName.trim()
}

// ===== Standard Sheet Processing =====

function findHeaderRowIndex(rows: CellValue[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (!row) continue
    const text = row.map(c => String(c ?? '').toUpperCase()).join(' ')
    if (text.includes('WIDTH') || text.includes('DESCRIPTION') || text.includes('RNR PART')) return i
  }
  return 4
}

function findLastUsefulColumn(headerRow: CellValue[]): number {
  let lastExtIdx = -1
  let lastPriceIdx = -1
  for (let i = 0; i < Math.min(headerRow?.length ?? 0, 15); i++) {
    const val = String(headerRow[i] ?? '').toUpperCase()
    if (val.includes('EXT')) lastExtIdx = i
    if (val.includes('PRICE') || val.includes('PRICING')) lastPriceIdx = i
    if (/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i.test(val)) break
  }
  if (lastExtIdx >= 0) return lastExtIdx
  if (lastPriceIdx >= 0) return lastPriceIdx
  return 9
}

function isRowBlank(row: CellValue[] | undefined, endCol: number): boolean {
  if (!row) return true
  for (let i = 0; i <= Math.min(endCol, (row.length || 0) - 1); i++) {
    if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== '') return false
  }
  return true
}

function hasValidQty(row: CellValue[] | undefined): boolean {
  if (!row) return false
  const val = row[START_COL]
  if (val === null || val === undefined || String(val).trim() === '') return false
  const num = Number(val)
  return !isNaN(num) && num > 0
}

function extractHeaderInfo(rows: CellValue[][]): { poNumber: string; dueDate: string } {
  let poNumber = ''
  let dueDate = ''
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const row = rows[i]
    if (!row) continue
    const cellA = String(row[0] ?? '').trim().toUpperCase()
    if (cellA.startsWith('PO')) poNumber = String(row[1] ?? '')
    if (cellA.includes('DUE')) {
      const rawDate = row[1]
      dueDate = typeof rawDate === 'number' ? excelDateToString(rawDate) : String(rawDate ?? '')
    }
  }
  return { poNumber, dueDate }
}

// ===== Special Tab Parsing =====

function parseS4SDescription(desc: string): {
  thickness: number; width: number; specie: string; profile: string; grade: string
} | null {
  const match = desc.match(/^([\d.]+)\s*[Xx]\s*([\d.]+)\s*[Xx]\s*(?:RL|96)\s+(.+)$/i)
  if (!match) return null
  const thickness = parseFloat(match[1])
  const width = parseFloat(match[2])
  let remainder = match[3].trim()
  let grade = 'Prime'
  if (/\b1\s*COMMON$/i.test(remainder)) {
    grade = '1 com'
    remainder = remainder.replace(/\b1\s*COMMON$/i, '').trim()
  } else if (/\bFAS$/i.test(remainder)) {
    remainder = remainder.replace(/\bFAS$/i, '').trim()
  }
  let profile = 'S4S'
  if (/\bPLOW\s*13\s*\(PL\s*13\)/i.test(remainder)) {
    profile = 'PL 13'
    remainder = remainder.replace(/\bPLOW\s*13\s*\(PL\s*13\)/i, '').trim()
  } else if (/\bPL\s*13/i.test(remainder)) {
    profile = 'PL 13'
    remainder = remainder.replace(/\bPL\s*13/i, '').trim()
  } else if (/\bS4S/i.test(remainder)) {
    profile = 'S4S'
    remainder = remainder.replace(/\bS4S/i, '').trim()
  }
  return { thickness, width, specie: normalizeSpecie(remainder), profile, grade }
}

function parseDoorFrameDescription(desc: string): {
  width: number; thickness: number; profile: string
} | null {
  const match = desc.match(/^([\d.]+)\s*[Xx]\s*([\d.]+)\s+(.+?)\s+[Dd]oor\s+[Ff]raming/i)
  if (!match) return null
  const width = parseFloat(match[1])
  const thickness = parseFloat(match[2])
  let profile = match[3].trim()
  if (/ISP[-\s]?1/i.test(profile)) profile = 'ISP01'
  else if (/SLANT\s*SHAKER/i.test(profile)) profile = 'Slant Shaker'
  return { width, thickness, profile }
}

function parseMouldingHeader(header: string): {
  thickness: number; width: number; profile: string
} | null {
  const match = header.match(/^([\d\s/]+?)\s*x\s*([\d\s/]+?)\s*x\s*(?:RL|\d+)\s+(.+)$/i)
  if (!match) return null
  const thickness = fractionToDecimal(match[1])
  const width = fractionToDecimal(match[2])
  const profile = match[3].trim().replace(/\s*\([^)]*\)\s*$/, '').trim()
  return { thickness, width, profile }
}

// ===== Special Tab Processing =====

function calcSpeciesTotals(rows: SpecialRow[]): { specie: string; boardFt: number }[] {
  const map: Record<string, number> = {}
  for (const r of rows) map[r.specie] = (map[r.specie] || 0) + r.boardFt
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([specie, boardFt]) => ({ specie, boardFt }))
}

export function processSpecialTabs(workbook: XLSX.WorkBook): SpecialTabResult[] {
  const linealRows: SpecialRow[] = []
  const mouldingRows: SpecialRow[] = []
  const linealPOs: string[] = []
  const mouldingPOs: string[] = []
  let linealDueDate = ''
  let mouldingDueDate = ''

  for (const name of workbook.SheetNames) {
    const isS4S = name.includes('R&R S4S')
    const isDoorFrame = name.includes('Door Frame')
    const isMoulding = name.includes('Moulding')
    if (!isS4S && !isDoorFrame && !isMoulding) continue

    const ws = workbook.Sheets[name]
    const rows: CellValue[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    const { poNumber, dueDate } = extractHeaderInfo(rows)

    if (isS4S || isDoorFrame) {
      if (poNumber) linealPOs.push(poNumber)
      if (dueDate) linealDueDate = dueDate
    } else {
      if (poNumber) mouldingPOs.push(poNumber)
      if (dueDate) mouldingDueDate = dueDate
    }

    if (isS4S) {
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        const qty = row[1]
        if (typeof qty !== 'number' || qty <= 0 || qty > 40000) continue
        const desc = String(row[2] ?? '')
        const partNum = String(row[3] ?? '')
        const parsed = parseS4SDescription(desc)
        if (!parsed) continue
        const ripWidth = parsed.width + 0.125
        linealRows.push({
          poNumber: poNumber || '', partNum, quantity: qty,
          width: parsed.width, profile: parsed.profile, thickness: parsed.thickness,
          specie: parsed.specie, grade: parsed.grade, ripWidth,
          sortOrder: SORT_ORDER_MAP[parsed.profile] ?? 99,
          boardFt: qty * ripWidth / 12,
        })
      }
    }

    if (isDoorFrame) {
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        const qty = row[1]
        if (typeof qty !== 'number' || qty <= 0 || qty > 40000) continue
        const specie = String(row[2] ?? '')
        const desc = String(row[3] ?? '')
        const partNum = String(row[4] ?? '')
        const parsed = parseDoorFrameDescription(desc)
        if (!parsed) continue
        const ripWidth = parsed.width + 0.125
        linealRows.push({
          poNumber: poNumber || '', partNum, quantity: qty,
          width: parsed.width, profile: parsed.profile, thickness: parsed.thickness,
          specie: normalizeSpecie(specie), grade: 'Prime', ripWidth,
          sortOrder: SORT_ORDER_MAP[parsed.profile] ?? 99,
          boardFt: qty * ripWidth / 12,
        })
      }
    }

    if (isMoulding) {
      let currentSection: { thickness: number; width: number; profile: string } | null = null
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        const col1 = row[1]
        if (typeof col1 === 'string' && col1.includes('x')) {
          const parsed = parseMouldingHeader(col1)
          if (parsed) { currentSection = parsed; continue }
        }
        if (typeof col1 === 'number' && col1 > 0 && col1 < 40000 && currentSection) {
          const specie = String(row[2] ?? '')
          const partNum = String(row[5] ?? '')
          const ripWidth = MOULD_RIP_WIDTH[currentSection.profile] ?? (currentSection.width + 0.125)
          mouldingRows.push({
            poNumber: poNumber || '', partNum, quantity: col1,
            width: currentSection.width, profile: currentSection.profile,
            thickness: currentSection.thickness, specie: normalizeSpecie(specie),
            grade: 'Prime', ripWidth,
            sortOrder: SORT_ORDER_MAP[currentSection.profile] ?? 99,
            boardFt: col1 * ripWidth / 12,
          })
        }
      }
    }
  }

  const results: SpecialTabResult[] = []

  if (linealRows.length > 0) {
    const ripRows = [...linealRows].sort((a, b) => a.specie.localeCompare(b.specie) || a.ripWidth - b.ripWidth)
    const mouldRows = [...linealRows].sort((a, b) => a.sortOrder - b.sortOrder || b.thickness - a.thickness || a.profile.localeCompare(b.profile))
    results.push({
      label: 'S4S / Door Frame', poNumbers: Array.from(new Set(linealPOs)),
      dueDate: linealDueDate, ripRows, mouldRows,
      speciesTotals: calcSpeciesTotals(ripRows),
      totalBoardFt: ripRows.reduce((sum, r) => sum + r.boardFt, 0),
      missingPartCount: linealRows.filter(r => isPartMissing(r.partNum)).length,
    })
  }

  if (mouldingRows.length > 0) {
    const ripRows = [...mouldingRows].sort((a, b) => a.specie.localeCompare(b.specie) || b.ripWidth - a.ripWidth)
    const mouldRows = [...mouldingRows].sort((a, b) => a.sortOrder - b.sortOrder || a.specie.localeCompare(b.specie))
    results.push({
      label: 'Moulding', poNumbers: Array.from(new Set(mouldingPOs)),
      dueDate: mouldingDueDate, ripRows, mouldRows,
      speciesTotals: calcSpeciesTotals(ripRows),
      totalBoardFt: ripRows.reduce((sum, r) => sum + r.boardFt, 0),
      missingPartCount: mouldingRows.filter(r => isPartMissing(r.partNum)).length,
    })
  }

  return results
}

// ===== Main Processing =====

export function processWorkbook(workbook: XLSX.WorkBook): ProcessedSheet[] {
  const results: ProcessedSheet[] = []

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name]
    const rows: CellValue[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    if (rows.length < 3) continue

    const { poNumber, dueDate } = extractHeaderInfo(rows)
    const headerRowIdx = findHeaderRowIndex(rows)
    const headerRow = rows[headerRowIdx] || []
    const lastColIdx = findLastUsefulColumn(headerRow)

    let rawExtPriceCol = -1
    for (let i = START_COL; i <= 15; i++) {
      const h = String(headerRow[i] ?? '').toUpperCase()
      if (h.startsWith('EXT')) rawExtPriceCol = i
    }

    const hiddenCols = getHiddenColumns(name, headerRow, rows)
    const visibleCols: number[] = []
    for (let i = START_COL; i <= lastColIdx; i++) {
      if (!hiddenCols.has(i)) visibleCols.push(i)
    }

    const displayHeaders: string[] = visibleCols.map(col => {
      if (col === START_COL) return 'QTY'
      const raw = headerRow[col]
      let label = raw !== null && raw !== undefined ? String(raw) : ''
      if (/^\d{5}$/.test(label)) label = 'PRICE'
      return label
    })

    const nameUpper = name.trim().toUpperCase()
    if (nameUpper.includes('DOOR FRAME') || nameUpper.includes('MOULDING')) {
      for (let i = 0; i < displayHeaders.length; i++) {
        if (displayHeaders[i] !== '') continue
        const rawCol = visibleCols[i]
        if (rawCol === 2) displayHeaders[i] = 'Species'
        if (rawCol === 3 && nameUpper.includes('DOOR FRAME')) displayHeaders[i] = 'Description'
      }
    }

    const extPriceDisplayIdx = displayHeaders.findIndex(h => h.toUpperCase().includes('EXT'))
    const partNumDisplayIdx = displayHeaders.findIndex(h => h.toUpperCase().includes('PART'))
    const widthDisplayIdx = displayHeaders.findIndex(h => h.toUpperCase() === 'WIDTH')
    const speciesDisplayIdx = displayHeaders.findIndex(h => {
      const u = h.toUpperCase()
      return u === 'PRODUCT' || u === 'SPECIES'
    })
    const tabProfile = getTabProfile(name)

    const dataStartIdx = headerRowIdx + 1
    const sections: SheetSection[] = []
    let currentGroup: CellValue[][] = []

    const flushSection = () => {
      if (currentGroup.length === 0) return
      const filtered = currentGroup.filter(r => hasValidQty(r))
      if (filtered.length > 0) {
        const qtyTotal = filtered.reduce((sum, r) => sum + (Number(r[START_COL]) || 0), 0)
        const slicedRows = filtered.map(r => visibleCols.map(col => r[col] ?? null))
        const rowExtPrices = filtered.map(r => rawExtPriceCol >= 0 ? Number(r[rawExtPriceCol]) || 0 : 0)
        const extPriceTotal = rowExtPrices.reduce((sum, v) => sum + v, 0)
        sections.push({ rows: slicedRows, rowExtPrices, qtyTotal, extPriceTotal })
      }
      currentGroup = []
    }

    for (let i = dataStartIdx; i < rows.length; i++) {
      if (isRowBlank(rows[i], lastColIdx)) flushSection()
      else currentGroup.push(rows[i])
    }
    flushSection()

    let missingPartCount = 0
    if (partNumDisplayIdx >= 0) {
      for (const section of sections) {
        for (const row of section.rows) {
          const val = row[partNumDisplayIdx]
          if (val === null || val === undefined || String(val).trim() === '') missingPartCount++
        }
      }
    }

    results.push({
      name, poNumber, dueDate, displayHeaders, sections,
      grandQtyTotal: sections.reduce((sum, s) => sum + s.qtyTotal, 0),
      grandExtTotal: sections.reduce((sum, s) => sum + s.extPriceTotal, 0),
      extPriceDisplayIdx, partNumDisplayIdx, missingPartCount,
      tabProfile, widthDisplayIdx, speciesDisplayIdx,
    })
  }

  return results
}

// ===== Collect Upload Combos =====

export function collectUploadCombos(
  sheets: ProcessedSheet[],
  specialResults: SpecialTabResult[]
): { profile: string; species: string }[] {
  const seen = new Set<string>()
  const combos: { profile: string; species: string }[] = []

  const add = (profile: string, rawSpecies: string) => {
    if (!profile || !rawSpecies) return
    const sp = normalizeSpecie(rawSpecies)
    if (!sp) return
    const k = priceKey(profile, sp)
    if (seen.has(k)) return
    seen.add(k)
    combos.push({ profile, species: sp })
  }

  for (const sheet of sheets) {
    if (!sheet.tabProfile || sheet.speciesDisplayIdx < 0) continue
    for (const section of sheet.sections) {
      for (const row of section.rows) {
        const species = String(row[sheet.speciesDisplayIdx] ?? '').trim()
        if (species) add(sheet.tabProfile, species)
      }
    }
  }

  for (const sr of specialResults) {
    for (const row of sr.ripRows) add(row.profile, row.specie)
  }

  return combos.sort((a, b) => a.profile.localeCompare(b.profile) || a.species.localeCompare(b.species))
}
