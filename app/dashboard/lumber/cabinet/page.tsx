'use client'

import { useState, useCallback, useRef, Fragment } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Printer, FileSpreadsheet, RotateCcw } from 'lucide-react'

// ===== Types =====

type CellValue = string | number | null

interface SheetSection {
  rows: CellValue[][]
  qtyTotal: number
  extPriceTotal: number
}

interface ProcessedSheet {
  name: string
  poNumber: string
  dueDate: string
  displayHeaders: string[]
  sections: SheetSection[]
  isSpecial: boolean
  grandQtyTotal: number
  grandExtTotal: number
  extPriceDisplayIdx: number
  partNumDisplayIdx: number
  missingPartCount: number
}

interface SpecialRow {
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

interface SpecialTabResult {
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

const SPECIAL_TABS = ['Door Frame', 'R&R S4S', 'Moulding']
const START_COL = 1

const MOULD_RIP_WIDTH: Record<string, number> = {
  'Scribe SP-05': 1.875,
  'Batten SP-09': 2.5,
  'Quarter Round SP-13': 1.9375,
  'Crown CM02': 1.6875,
  'Crown Manorwood': 3,
  'Crown Pennwest': 2.975,
}

const SORT_ORDER_MAP: Record<string, number> = {
  'PL 13': 1,
  'S4S': 2,
  'Quarter Round SP-13': 3,
  'Slant Shaker': 4,
  'ISP01': 5,
  'Crown Pennwest': 6,
  'Crown Manorwood': 7,
  'Scribe SP-05': 1,
  'Batten SP-09': 2,
  'Crown CM02': 5,
}

const SPECIE_MAP: Record<string, string> = {
  'RED OAK': 'Red Oak',
  'SOFT MAPLE': 'Sap Soft Maple',
  'SAP SOFT MAPLE': 'Sap Soft Maple',
  'HARD MAPLE': 'Hard Maple',
  'CHERRY': 'Cherry',
  'HICKORY': 'Hickory',
  'PINE': 'Pine',
  'WALNUT': 'Walnut',
  'S. MAPLE': 'Sap Soft Maple',
  'Red Oak': 'Red Oak',
  'Red oak': 'Red Oak',
  'Soft Maple': 'Sap Soft Maple',
  'Hard Maple': 'Hard Maple',
  'Cherry': 'Cherry',
  'Hickory': 'Hickory',
  'Pine': 'Pine',
  'Walnut': 'Walnut',
}

const RIP_HEADERS = ['Part#', 'Qty', 'Rip Width', 'Specie', 'Thick', 'Width', 'Profile', 'Grade', 'Board Ft']
const MOULD_HEADERS = ['Part#', 'Qty', 'Width', 'Profile', 'Thickness', 'Specie', 'Grade', 'Sort Order']

// ===== Helpers =====

function excelDateToString(serial: number): string {
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = date.getUTCDate()
  return `${day}-${month}`
}

function normalizeSpecie(raw: string): string {
  const trimmed = raw.trim()
  return SPECIE_MAP[trimmed] ?? SPECIE_MAP[trimmed.toUpperCase()] ?? trimmed
}

function fractionToDecimal(frac: string): number {
  const trimmed = frac.trim()
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3])
  const simple = trimmed.match(/^(\d+)\/(\d+)$/)
  if (simple) return parseInt(simple[1]) / parseInt(simple[2])
  return parseFloat(trimmed) || 0
}

function isPartMissing(val: string): boolean {
  return !val || val === 'null' || val === 'undefined' || val.trim() === ''
}

// ===== Standard Sheet Processing =====

function findHeaderRowIndex(rows: CellValue[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (!row) continue
    const text = row.map(c => String(c ?? '').toUpperCase()).join(' ')
    if (text.includes('WIDTH') || text.includes('DESCRIPTION')) return i
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
  let profile = match[3].trim().replace(/\s*\([^)]*\)\s*$/, '').trim()

  return { thickness, width, profile }
}

// ===== Special Tab Processing =====

function processSpecialTabs(workbook: XLSX.WorkBook): SpecialTabResult[] {
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
          partNum,
          quantity: qty,
          width: parsed.width,
          profile: parsed.profile,
          thickness: parsed.thickness,
          specie: parsed.specie,
          grade: parsed.grade,
          ripWidth,
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
          partNum,
          quantity: qty,
          width: parsed.width,
          profile: parsed.profile,
          thickness: parsed.thickness,
          specie: normalizeSpecie(specie),
          grade: 'Prime',
          ripWidth,
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
            partNum,
            quantity: col1,
            width: currentSection.width,
            profile: currentSection.profile,
            thickness: currentSection.thickness,
            specie: normalizeSpecie(specie),
            grade: 'Prime',
            ripWidth,
            sortOrder: SORT_ORDER_MAP[currentSection.profile] ?? 99,
            boardFt: col1 * ripWidth / 12,
          })
        }
      }
    }
  }

  const results: SpecialTabResult[] = []

  if (linealRows.length > 0) {
    const ripRows = [...linealRows].sort((a, b) =>
      a.specie.localeCompare(b.specie) || a.ripWidth - b.ripWidth
    )
    const mouldRows = [...linealRows].sort((a, b) =>
      a.sortOrder - b.sortOrder || b.thickness - a.thickness || a.profile.localeCompare(b.profile)
    )
    results.push({
      label: 'S4S / Door Frame',
      poNumbers: Array.from(new Set(linealPOs)),
      dueDate: linealDueDate,
      ripRows,
      mouldRows,
      speciesTotals: calcSpeciesTotals(ripRows),
      totalBoardFt: ripRows.reduce((sum, r) => sum + r.boardFt, 0),
      missingPartCount: linealRows.filter(r => isPartMissing(r.partNum)).length,
    })
  }

  if (mouldingRows.length > 0) {
    const ripRows = [...mouldingRows].sort((a, b) =>
      a.specie.localeCompare(b.specie) || b.ripWidth - a.ripWidth
    )
    const mouldRows = [...mouldingRows].sort((a, b) =>
      a.sortOrder - b.sortOrder || a.specie.localeCompare(b.specie)
    )
    results.push({
      label: 'Moulding',
      poNumbers: Array.from(new Set(mouldingPOs)),
      dueDate: mouldingDueDate,
      ripRows,
      mouldRows,
      speciesTotals: calcSpeciesTotals(ripRows),
      totalBoardFt: ripRows.reduce((sum, r) => sum + r.boardFt, 0),
      missingPartCount: mouldingRows.filter(r => isPartMissing(r.partNum)).length,
    })
  }

  return results
}

function calcSpeciesTotals(rows: SpecialRow[]): { specie: string; boardFt: number }[] {
  const map: Record<string, number> = {}
  for (const r of rows) {
    map[r.specie] = (map[r.specie] || 0) + r.boardFt
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([specie, boardFt]) => ({ specie, boardFt }))
}

// ===== Main Processing =====

function processWorkbook(workbook: XLSX.WorkBook): ProcessedSheet[] {
  const results: ProcessedSheet[] = []

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name]
    const rows: CellValue[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    if (rows.length < 3) continue

    const isSpecial = SPECIAL_TABS.some(t => name.includes(t))
    const { poNumber, dueDate } = extractHeaderInfo(rows)

    if (isSpecial) {
      results.push({
        name, poNumber, dueDate,
        displayHeaders: [], sections: [], isSpecial: true,
        grandQtyTotal: 0, grandExtTotal: 0,
        extPriceDisplayIdx: -1, partNumDisplayIdx: -1, missingPartCount: 0,
      })
      continue
    }

    const headerRowIdx = findHeaderRowIndex(rows)
    const headerRow = rows[headerRowIdx] || []
    const lastColIdx = findLastUsefulColumn(headerRow)

    const displayHeaders: string[] = []
    for (let i = START_COL; i <= lastColIdx; i++) {
      if (i === START_COL) {
        displayHeaders.push('QTY')
      } else {
        const raw = headerRow[i]
        let label = raw !== null && raw !== undefined ? String(raw) : ''
        if (/^\d{5}$/.test(label)) label = 'PRICE'
        displayHeaders.push(label)
      }
    }

    const extPriceDisplayIdx = displayHeaders.findIndex(h => h.toUpperCase().includes('EXT'))
    const partNumDisplayIdx = displayHeaders.findIndex(h => h.toUpperCase().includes('PART'))

    const dataStartIdx = headerRowIdx + 1
    const sections: SheetSection[] = []
    let currentGroup: CellValue[][] = []

    const flushSection = () => {
      if (currentGroup.length === 0) return
      const filtered = currentGroup.filter(r => hasValidQty(r))
      if (filtered.length > 0) {
        const qtyTotal = filtered.reduce((sum, r) => sum + (Number(r[START_COL]) || 0), 0)
        const slicedRows = filtered.map(r => {
          const sliced: CellValue[] = []
          for (let i = START_COL; i <= lastColIdx; i++) sliced.push(r[i] ?? null)
          return sliced
        })
        let extPriceTotal = 0
        if (extPriceDisplayIdx >= 0) {
          extPriceTotal = slicedRows.reduce((sum, r) => sum + (Number(r[extPriceDisplayIdx]) || 0), 0)
        }
        sections.push({ rows: slicedRows, qtyTotal, extPriceTotal })
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
      isSpecial: false,
      grandQtyTotal: sections.reduce((sum, s) => sum + s.qtyTotal, 0),
      grandExtTotal: sections.reduce((sum, s) => sum + s.extPriceTotal, 0),
      extPriceDisplayIdx, partNumDisplayIdx, missingPartCount,
    })
  }

  return results
}

// ===== Formatting =====

function formatCell(val: CellValue, colIdx: number, headers: string[]): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') {
    const header = (headers[colIdx] || '').toUpperCase()
    if (header.includes('EXT') || header.includes('PRICE') || header.includes('PRICING')) {
      return val.toFixed(2)
    }
    if (Number.isInteger(val)) return val.toString()
    return parseFloat(val.toFixed(4)).toString()
  }
  return String(val)
}

function formatNum(val: number, decimals = 3): string {
  return parseFloat(val.toFixed(decimals)).toString()
}

// ===== Rip/Mould Table Renderers =====

function RipTable({ rows, speciesTotals, totalBoardFt, compact }: {
  rows: SpecialRow[]
  speciesTotals: { specie: string; boardFt: number }[]
  totalBoardFt: number
  compact?: boolean
}) {
  const fontSize = compact ? '10px' : undefined
  const padding = compact ? '2px 6px' : undefined
  const borderStyle = compact ? '1px solid #ccc' : undefined
  const headerBorder = compact ? '1px solid #999' : undefined

  return (
    <table className={compact ? undefined : 'w-full text-sm'} style={compact ? {
      width: '100%', borderCollapse: 'collapse', fontSize, fontFamily: 'Arial, sans-serif',
    } : undefined}>
      <thead>
        <tr className={compact ? undefined : 'bg-gray-50 border-b'}>
          {RIP_HEADERS.map((h, i) => (
            <th key={i} className={compact ? undefined : 'px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap'}
              style={compact ? {
                border: headerBorder, padding, textAlign: 'left', fontWeight: 600,
                backgroundColor: '#f0f0f0', whiteSpace: 'nowrap',
              } : undefined}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const missing = isPartMissing(r.partNum)
          return (
            <tr key={i}
              className={compact ? undefined : `border-b border-gray-100 ${missing ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
              style={compact && missing ? { backgroundColor: '#fffbeb' } : undefined}>
              <td className={compact ? undefined : 'px-3 py-1.5 whitespace-nowrap'}
                style={compact ? { border: borderStyle, padding, whiteSpace: 'nowrap' } : undefined}>
                {missing ? (compact ? '⚠' : <span className="text-amber-500 font-medium">⚠ MISSING</span>) : r.partNum}
              </td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.quantity}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{formatNum(r.ripWidth)}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.specie}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{formatNum(r.thickness)}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{formatNum(r.width)}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.profile}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.grade}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{formatNum(r.boardFt, 2)}</td>
            </tr>
          )
        })}
        <tr className={compact ? undefined : 'border-t-2 border-gray-300'}>
          <td colSpan={9} className={compact ? undefined : 'py-2'} style={compact ? { padding: '6px' } : undefined} />
        </tr>
        {speciesTotals.map((st, i) => (
          <tr key={`st-${i}`} className={compact ? undefined : 'bg-emerald-50 font-semibold text-emerald-800'}>
            <td colSpan={3} className={compact ? undefined : 'px-3 py-1'}
              style={compact ? { border: headerBorder, padding, fontWeight: 'bold' } : undefined} />
            <td className={compact ? undefined : 'px-3 py-1'}
              style={compact ? { border: headerBorder, padding, fontWeight: 'bold' } : undefined}>{st.specie}</td>
            <td colSpan={4} className={compact ? undefined : 'px-3 py-1'}
              style={compact ? { border: headerBorder, padding } : undefined} />
            <td className={compact ? undefined : 'px-3 py-1'}
              style={compact ? { border: headerBorder, padding, fontWeight: 'bold' } : undefined}>{formatNum(st.boardFt, 2)}</td>
          </tr>
        ))}
        <tr className={compact ? undefined : 'bg-emerald-100 font-bold text-emerald-900'}>
          <td colSpan={3} className={compact ? undefined : 'px-3 py-1.5'}
            style={compact ? { border: headerBorder, padding, fontWeight: 'bold' } : undefined} />
          <td className={compact ? undefined : 'px-3 py-1.5'}
            style={compact ? { border: headerBorder, padding, fontWeight: 'bold' } : undefined}>TOTAL</td>
          <td colSpan={4} className={compact ? undefined : 'px-3 py-1.5'}
            style={compact ? { border: headerBorder, padding } : undefined} />
          <td className={compact ? undefined : 'px-3 py-1.5'}
            style={compact ? { border: headerBorder, padding, fontWeight: 'bold' } : undefined}>{formatNum(totalBoardFt, 2)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function MouldTable({ rows, compact }: { rows: SpecialRow[]; compact?: boolean }) {
  const fontSize = compact ? '10px' : undefined
  const padding = compact ? '2px 6px' : undefined
  const borderStyle = compact ? '1px solid #ccc' : undefined
  const headerBorder = compact ? '1px solid #999' : undefined

  return (
    <table className={compact ? undefined : 'w-full text-sm'} style={compact ? {
      width: '100%', borderCollapse: 'collapse', fontSize, fontFamily: 'Arial, sans-serif',
    } : undefined}>
      <thead>
        <tr className={compact ? undefined : 'bg-gray-50 border-b'}>
          {MOULD_HEADERS.map((h, i) => (
            <th key={i} className={compact ? undefined : 'px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap'}
              style={compact ? {
                border: headerBorder, padding, textAlign: 'left', fontWeight: 600,
                backgroundColor: '#f0f0f0', whiteSpace: 'nowrap',
              } : undefined}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const missing = isPartMissing(r.partNum)
          return (
            <tr key={i}
              className={compact ? undefined : `border-b border-gray-100 ${missing ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
              style={compact && missing ? { backgroundColor: '#fffbeb' } : undefined}>
              <td className={compact ? undefined : 'px-3 py-1.5 whitespace-nowrap'}
                style={compact ? { border: borderStyle, padding, whiteSpace: 'nowrap' } : undefined}>
                {missing ? (compact ? '⚠' : <span className="text-amber-500 font-medium">⚠ MISSING</span>) : r.partNum}
              </td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.quantity}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{formatNum(r.width)}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.profile}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{formatNum(r.thickness)}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.specie}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.grade}</td>
              <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: borderStyle, padding } : undefined}>{r.sortOrder}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ===== Component =====

export default function CabinetOrderPage() {
  const [sheets, setSheets] = useState<ProcessedSheet[]>([])
  const [specialResults, setSpecialResults] = useState<SpecialTabResult[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [activeSpecialIdx, setActiveSpecialIdx] = useState<number | null>(null)
  const [specialView, setSpecialView] = useState<'rip' | 'mould'>('rip')
  const [fileName, setFileName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please upload an Excel file (.xlsx or .xls)')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      setSheets(processWorkbook(workbook))
      setSpecialResults(processSpecialTabs(workbook))
      setActiveTab(0)
      setActiveSpecialIdx(null)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragOver(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }
  function handlePrint() { window.print() }
  function handleReset() {
    setSheets([]); setSpecialResults([]); setFileName('')
    setActiveTab(0); setActiveSpecialIdx(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const standardSheets = sheets.filter(s => !s.isSpecial)
  const sheetsWithOrders = standardSheets.filter(s => s.sections.length > 0)
  const activeSheet = activeSpecialIdx === null ? standardSheets[activeTab] : null
  const activeSpecial = activeSpecialIdx !== null ? specialResults[activeSpecialIdx] : null

  const totalMissingParts = standardSheets.reduce((sum, s) => sum + s.missingPartCount, 0)
    + specialResults.reduce((sum, s) => sum + s.missingPartCount, 0)

  const totalPrintPages = sheetsWithOrders.length + specialResults.length * 2

  // ===== Upload Screen =====
  if (sheets.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cabinet Shop Order Processor</h1>
          <p className="text-gray-500 mt-1">
            Upload a Nature&apos;s Blend order file to clean, process, and print
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-16 text-center transition-all cursor-pointer ${
            isDragOver
              ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
              : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
          }`}
        >
          <FileSpreadsheet className={`h-16 w-16 mx-auto mb-4 ${isDragOver ? 'text-emerald-500' : 'text-gray-400'}`} />
          <p className="text-lg font-medium text-gray-700">
            Drop Nature&apos;s Blend .xlsx file here
          </p>
          <p className="text-sm text-gray-500 mt-2">or click to browse</p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
          <p className="font-medium text-gray-700 mb-2">What this does:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Reads all tabs from the Nature&apos;s Blend order file</li>
            <li>Removes rows with no quantity ordered</li>
            <li>Totals quantity per section on each tab</li>
            <li>Processes S4S, Door Frame &amp; Moulding into Rip and Mould views</li>
            <li>Flags parts missing a Part Number</li>
            <li>Prints all tabs with one click</li>
          </ul>
        </div>
      </div>
    )
  }

  // ===== Preview & Print Screen =====
  return (
    <>
      {/* Global print styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 0.4in; size: landscape; }
          body * { visibility: hidden !important; }
          .cabinet-print-area, .cabinet-print-area * { visibility: visible !important; }
          .cabinet-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .cabinet-page-break { page-break-before: always; }
        }
      `}} />

      {/* ===== Screen Preview ===== */}
      <div className="print:hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cabinet Shop Order Processor</h1>
            <p className="text-sm text-gray-500 mt-1">{fileName}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              New File
            </Button>
            <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Printer className="h-4 w-4" />
              Print All ({totalPrintPages} pages)
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Tabs</div>
            <div className="text-2xl font-bold text-gray-900">{sheets.length}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Tabs With Orders</div>
            <div className="text-2xl font-bold text-emerald-700">{sheetsWithOrders.length}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Special Tabs</div>
            <div className="text-2xl font-bold text-blue-600">{specialResults.length} groups</div>
            <div className="text-xs text-blue-400">{specialResults.reduce((s, r) => s + r.ripRows.length, 0)} rows</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Print Pages</div>
            <div className="text-2xl font-bold text-gray-700">{totalPrintPages}</div>
          </div>
          {totalMissingParts > 0 && (
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
              <div className="text-sm text-amber-600">Missing Part #</div>
              <div className="text-2xl font-bold text-amber-700">{totalMissingParts}</div>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2 items-center">
          {standardSheets.map((sheet, idx) => {
            const hasOrders = sheet.sections.length > 0
            const isActive = activeSpecialIdx === null && idx === activeTab
            return (
              <button
                key={sheet.name}
                onClick={() => { setActiveTab(idx); setActiveSpecialIdx(null) }}
                className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : hasOrders
                      ? 'bg-white text-gray-700 hover:bg-gray-100 border'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {sheet.name.trim()}
                {hasOrders && <span className="ml-1.5 text-xs opacity-75">({sheet.grandQtyTotal})</span>}
                {sheet.missingPartCount > 0 && <span className="ml-1 text-amber-500">⚠</span>}
              </button>
            )
          })}

          {specialResults.length > 0 && (
            <div className="w-px h-8 bg-gray-300 mx-2 shrink-0" />
          )}

          {specialResults.map((sr, idx) => {
            const isActive = activeSpecialIdx === idx
            return (
              <button
                key={sr.label}
                onClick={() => { setActiveSpecialIdx(idx); setSpecialView('rip') }}
                className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                {sr.label}
                <span className="ml-1.5 text-xs opacity-75">({sr.ripRows.length})</span>
                {sr.missingPartCount > 0 && <span className="ml-1 text-amber-300">⚠</span>}
              </button>
            )
          })}
        </div>

        {/* ===== Standard Sheet Content ===== */}
        {activeSheet && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-900">{activeSheet.name.trim()}</span>
                <span className="text-sm text-gray-500 ml-3">PO# {activeSheet.poNumber}</span>
                <span className="text-sm text-gray-500 ml-3">Due: {activeSheet.dueDate}</span>
              </div>
              <div className="flex items-center gap-3">
                {activeSheet.missingPartCount > 0 && (
                  <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                    {activeSheet.missingPartCount} missing part #
                  </span>
                )}
                {activeSheet.sections.length > 0 && (
                  <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    Total Qty: {activeSheet.grandQtyTotal}
                  </span>
                )}
              </div>
            </div>

            {activeSheet.sections.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No orders on this tab</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      {activeSheet.displayHeaders.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSheet.sections.map((section, sIdx) => (
                      <Fragment key={sIdx}>
                        {sIdx > 0 && (
                          <tr><td colSpan={activeSheet.displayHeaders.length} className="py-2 border-b" /></tr>
                        )}
                        {section.rows.map((row, rIdx) => {
                          const isMissingPart = activeSheet.partNumDisplayIdx >= 0 &&
                            (row[activeSheet.partNumDisplayIdx] === null ||
                             row[activeSheet.partNumDisplayIdx] === undefined ||
                             String(row[activeSheet.partNumDisplayIdx]).trim() === '')
                          return (
                            <tr key={rIdx} className={`border-b border-gray-100 ${isMissingPart ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap">
                                  {cIdx === activeSheet.partNumDisplayIdx && isMissingPart
                                    ? <span className="text-amber-500 font-medium text-xs">⚠ MISSING</span>
                                    : formatCell(cell, cIdx, activeSheet.displayHeaders)}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                        <tr className="bg-emerald-50 border-b-2 border-emerald-200 font-semibold text-emerald-800">
                          <td className="px-3 py-1.5">{section.qtyTotal}</td>
                          {activeSheet.displayHeaders.slice(1).map((_, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5">
                              {cIdx + 1 === activeSheet.extPriceDisplayIdx
                                ? `$${section.extPriceTotal.toFixed(2)}`
                                : ''}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== Special Tab Content ===== */}
        {activeSpecial && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-900">{activeSpecial.label}</span>
                <span className="text-sm text-gray-500 ml-3">
                  PO# {activeSpecial.poNumbers.join(', ')}
                </span>
                <span className="text-sm text-gray-500 ml-3">Due: {activeSpecial.dueDate}</span>
              </div>
              <div className="flex items-center gap-3">
                {activeSpecial.missingPartCount > 0 && (
                  <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                    {activeSpecial.missingPartCount} missing part #
                  </span>
                )}
                <span className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                  {activeSpecial.ripRows.length} items
                </span>
              </div>
            </div>

            {/* Rip / Mould toggle */}
            <div className="flex border-b">
              <button
                onClick={() => setSpecialView('rip')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  specialView === 'rip'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                RIP View
                <span className="ml-2 text-xs opacity-75">
                  (Board Ft: {formatNum(activeSpecial.totalBoardFt, 1)})
                </span>
              </button>
              <button
                onClick={() => setSpecialView('mould')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  specialView === 'mould'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                MOULD View
              </button>
            </div>

            <div className="overflow-x-auto">
              {specialView === 'rip' ? (
                <RipTable
                  rows={activeSpecial.ripRows}
                  speciesTotals={activeSpecial.speciesTotals}
                  totalBoardFt={activeSpecial.totalBoardFt}
                />
              ) : (
                <MouldTable rows={activeSpecial.mouldRows} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== Print Layout ===== */}
      <div className="cabinet-print-area hidden print:block">
        {/* Standard sheets */}
        {sheetsWithOrders.map((sheet, sheetIdx) => (
          <div key={sheet.name} className={sheetIdx > 0 ? 'cabinet-page-break' : ''}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                Nature&apos;s Blend Wood Products
              </div>
              <div style={{ fontSize: '11px', display: 'flex', gap: '24px' }}>
                <span>PO# {sheet.poNumber}</span>
                <span>Due Date: {sheet.dueDate}</span>
              </div>
              <div style={{
                fontSize: '13px', fontWeight: 600, marginTop: '8px',
                borderBottom: '2px solid #333', paddingBottom: '4px',
              }}>
                {sheet.name.trim()}
                {sheet.missingPartCount > 0 && (
                  <span style={{ marginLeft: '12px', color: '#d97706', fontSize: '11px' }}>
                    ({sheet.missingPartCount} missing part #)
                  </span>
                )}
              </div>
            </div>

            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontSize: '10px', fontFamily: 'Arial, sans-serif',
            }}>
              <thead>
                <tr>
                  {sheet.displayHeaders.map((h, i) => (
                    <th key={i} style={{
                      border: '1px solid #999', padding: '3px 6px',
                      textAlign: 'left', fontWeight: 600, backgroundColor: '#f0f0f0',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.sections.map((section, sIdx) => (
                  <Fragment key={sIdx}>
                    {sIdx > 0 && (
                      <tr><td colSpan={sheet.displayHeaders.length} style={{ padding: '4px' }} /></tr>
                    )}
                    {section.rows.map((row, rIdx) => {
                      const isMissing = sheet.partNumDisplayIdx >= 0 &&
                        (row[sheet.partNumDisplayIdx] === null ||
                         row[sheet.partNumDisplayIdx] === undefined ||
                         String(row[sheet.partNumDisplayIdx]).trim() === '')
                      return (
                        <tr key={rIdx} style={isMissing ? { backgroundColor: '#fffbeb' } : undefined}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} style={{
                              border: '1px solid #ccc', padding: '2px 6px', whiteSpace: 'nowrap',
                            }}>
                              {cIdx === sheet.partNumDisplayIdx && isMissing
                                ? '⚠'
                                : formatCell(cell, cIdx, sheet.displayHeaders)}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                    <tr>
                      <td style={{ border: '1px solid #999', padding: '3px 6px', fontWeight: 'bold' }}>
                        {section.qtyTotal}
                      </td>
                      {sheet.displayHeaders.slice(1).map((_, cIdx) => (
                        <td key={cIdx} style={{ border: '1px solid #999', padding: '3px 6px', fontWeight: 'bold' }}>
                          {cIdx + 1 === sheet.extPriceDisplayIdx
                            ? `$${section.extPriceTotal.toFixed(2)}`
                            : ''}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>

            {sheet.sections.length > 1 && (
              <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 'bold', textAlign: 'right' }}>
                Grand Total Qty: {sheet.grandQtyTotal}
                {sheet.grandExtTotal > 0 && (
                  <span style={{ marginLeft: '24px' }}>Grand Total: ${sheet.grandExtTotal.toFixed(2)}</span>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Special tabs - Rip pages then Mould pages */}
        {specialResults.map((sr) => (
          <Fragment key={sr.label}>
            {/* RIP page */}
            <div className="cabinet-page-break">
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  Nature&apos;s Blend Wood Products
                </div>
                <div style={{ fontSize: '11px', display: 'flex', gap: '24px' }}>
                  <span>PO# {sr.poNumbers.join(', ')}</span>
                  <span>Due Date: {sr.dueDate}</span>
                </div>
                <div style={{
                  fontSize: '13px', fontWeight: 600, marginTop: '8px',
                  borderBottom: '2px solid #333', paddingBottom: '4px',
                }}>
                  {sr.label} — RIP
                  {sr.missingPartCount > 0 && (
                    <span style={{ marginLeft: '12px', color: '#d97706', fontSize: '11px' }}>
                      ({sr.missingPartCount} missing part #)
                    </span>
                  )}
                </div>
              </div>
              <RipTable
                rows={sr.ripRows}
                speciesTotals={sr.speciesTotals}
                totalBoardFt={sr.totalBoardFt}
                compact
              />
            </div>

            {/* MOULD page */}
            <div className="cabinet-page-break">
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  Nature&apos;s Blend Wood Products
                </div>
                <div style={{ fontSize: '11px', display: 'flex', gap: '24px' }}>
                  <span>PO# {sr.poNumbers.join(', ')}</span>
                  <span>Due Date: {sr.dueDate}</span>
                </div>
                <div style={{
                  fontSize: '13px', fontWeight: 600, marginTop: '8px',
                  borderBottom: '2px solid #333', paddingBottom: '4px',
                }}>
                  {sr.label} — MOULD
                </div>
              </div>
              <MouldTable rows={sr.mouldRows} compact />
            </div>
          </Fragment>
        ))}
      </div>
    </>
  )
}
