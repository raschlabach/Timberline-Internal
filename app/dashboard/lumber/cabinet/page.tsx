'use client'

import { useState, useCallback, useRef, Fragment } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Upload, Printer, FileSpreadsheet, AlertTriangle, RotateCcw } from 'lucide-react'

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

// ===== Constants =====

const SPECIAL_TABS = ['Door Frame', 'R&R S4S', 'Moulding']
const START_COL = 1 // Skip column A, start from B

// ===== Processing =====

function excelDateToString(serial: number): string {
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = date.getUTCDate()
  return `${day}-${month}`
}

function findHeaderRowIndex(rows: CellValue[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (!row) continue
    const text = row.map(c => String(c ?? '').toUpperCase()).join(' ')
    if (text.includes('WIDTH') || text.includes('DESCRIPTION')) {
      return i
    }
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
    if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== '') {
      return false
    }
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
    if (cellA.startsWith('PO')) {
      poNumber = String(row[1] ?? '')
    }
    if (cellA.includes('DUE')) {
      const rawDate = row[1]
      dueDate = typeof rawDate === 'number' ? excelDateToString(rawDate) : String(rawDate ?? '')
    }
  }

  return { poNumber, dueDate }
}

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
        name,
        poNumber,
        dueDate,
        displayHeaders: [],
        sections: [],
        isSpecial: true,
        grandQtyTotal: 0,
        grandExtTotal: 0,
        extPriceDisplayIdx: -1,
      })
      continue
    }

    const headerRowIdx = findHeaderRowIndex(rows)
    const headerRow = rows[headerRowIdx] || []
    const lastColIdx = findLastUsefulColumn(headerRow)

    // Build display headers (skip column A, override B to "QTY")
    const displayHeaders: string[] = []
    for (let i = START_COL; i <= lastColIdx; i++) {
      if (i === START_COL) {
        displayHeaders.push('QTY')
      } else {
        const raw = headerRow[i]
        let label = raw !== null && raw !== undefined ? String(raw) : ''
        // Fix Excel date serials appearing as header text (e.g., 44927 instead of "PRICE")
        if (/^\d{5}$/.test(label)) label = 'PRICE'
        displayHeaders.push(label)
      }
    }

    // Find ext price column index in the display array
    const extPriceDisplayIdx = displayHeaders.findIndex(h =>
      h.toUpperCase().includes('EXT')
    )

    // Find RNR PART # column index in the display array
    const partNumDisplayIdx = displayHeaders.findIndex(h =>
      h.toUpperCase().includes('PART')
    )

    // Process data rows into sections
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
          for (let i = START_COL; i <= lastColIdx; i++) {
            sliced.push(r[i] ?? null)
          }
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
      if (isRowBlank(rows[i], lastColIdx)) {
        flushSection()
      } else {
        currentGroup.push(rows[i])
      }
    }
    flushSection()

    const grandQtyTotal = sections.reduce((sum, s) => sum + s.qtyTotal, 0)
    const grandExtTotal = sections.reduce((sum, s) => sum + s.extPriceTotal, 0)

    results.push({
      name,
      poNumber,
      dueDate,
      displayHeaders,
      sections,
      isSpecial: false,
      grandQtyTotal,
      grandExtTotal,
      extPriceDisplayIdx,
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

// ===== Component =====

export default function CabinetOrderPage() {
  const [sheets, setSheets] = useState<ProcessedSheet[]>([])
  const [activeTab, setActiveTab] = useState(0)
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
      const processed = processWorkbook(workbook)
      setSheets(processed)
      setActiveTab(0)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handlePrint() {
    window.print()
  }

  function handleReset() {
    setSheets([])
    setFileName('')
    setActiveTab(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const standardSheets = sheets.filter(s => !s.isSpecial)
  const specialSheets = sheets.filter(s => s.isSpecial)
  const sheetsWithOrders = standardSheets.filter(s => s.sections.length > 0)
  const activeSheet = standardSheets[activeTab]

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
          <FileSpreadsheet
            className={`h-16 w-16 mx-auto mb-4 ${isDragOver ? 'text-emerald-500' : 'text-gray-400'}`}
          />
          <p className="text-lg font-medium text-gray-700">
            Drop Nature&apos;s Blend .xlsx file here
          </p>
          <p className="text-sm text-gray-500 mt-2">or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
          <p className="font-medium text-gray-700 mb-2">What this does:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Reads all tabs from the Nature&apos;s Blend order file</li>
            <li>Removes rows with no quantity ordered</li>
            <li>Totals quantity per section on each tab</li>
            <li>Cleans up formatting for uniform text</li>
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
              Print All ({sheetsWithOrders.length} pages)
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Tabs</div>
            <div className="text-2xl font-bold text-gray-900">{sheets.length}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Tabs With Orders</div>
            <div className="text-2xl font-bold text-emerald-700">{sheetsWithOrders.length}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Empty Tabs</div>
            <div className="text-2xl font-bold text-gray-400">
              {standardSheets.length - sheetsWithOrders.length}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Special Tabs</div>
            <div className="text-2xl font-bold text-amber-600">{specialSheets.length}</div>
            <div className="text-xs text-amber-500">Phase 2</div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
          {standardSheets.map((sheet, idx) => {
            const hasOrders = sheet.sections.length > 0
            return (
              <button
                key={sheet.name}
                onClick={() => setActiveTab(idx)}
                className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  idx === activeTab
                    ? 'bg-emerald-600 text-white'
                    : hasOrders
                      ? 'bg-white text-gray-700 hover:bg-gray-100 border'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {sheet.name.trim()}
                {hasOrders && (
                  <span className="ml-1.5 text-xs opacity-75">({sheet.grandQtyTotal})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Special tabs notice */}
        {specialSheets.length > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Special tabs ({specialSheets.map(s => s.name).join(', ')}) will be supported in Phase 2
            </span>
          </div>
        )}

        {/* Active sheet data */}
        {activeSheet && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-900">{activeSheet.name.trim()}</span>
                <span className="text-sm text-gray-500 ml-3">PO# {activeSheet.poNumber}</span>
                <span className="text-sm text-gray-500 ml-3">Due: {activeSheet.dueDate}</span>
              </div>
              {activeSheet.sections.length > 0 && (
                <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                  Total Qty: {activeSheet.grandQtyTotal}
                </span>
              )}
            </div>

            {activeSheet.sections.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                No orders on this tab
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      {activeSheet.displayHeaders.map((h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSheet.sections.map((section, sIdx) => (
                      <Fragment key={sIdx}>
                        {sIdx > 0 && (
                          <tr>
                            <td
                              colSpan={activeSheet.displayHeaders.length}
                              className="py-2 border-b"
                            />
                          </tr>
                        )}
                        {section.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-gray-100 hover:bg-gray-50">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap">
                                {formatCell(cell, cIdx, activeSheet.displayHeaders)}
                              </td>
                            ))}
                          </tr>
                        ))}
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
      </div>

      {/* ===== Print Layout ===== */}
      <div className="cabinet-print-area hidden print:block">
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
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  marginTop: '8px',
                  borderBottom: '2px solid #333',
                  paddingBottom: '4px',
                }}
              >
                {sheet.name.trim()}
              </div>
            </div>

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              <thead>
                <tr>
                  {sheet.displayHeaders.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        border: '1px solid #999',
                        padding: '3px 6px',
                        textAlign: 'left',
                        fontWeight: 600,
                        backgroundColor: '#f0f0f0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.sections.map((section, sIdx) => (
                  <Fragment key={sIdx}>
                    {sIdx > 0 && (
                      <tr>
                        <td
                          colSpan={sheet.displayHeaders.length}
                          style={{ padding: '4px' }}
                        />
                      </tr>
                    )}
                    {section.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            style={{
                              border: '1px solid #ccc',
                              padding: '2px 6px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatCell(cell, cIdx, sheet.displayHeaders)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td
                        style={{
                          border: '1px solid #999',
                          padding: '3px 6px',
                          fontWeight: 'bold',
                        }}
                      >
                        {section.qtyTotal}
                      </td>
                      {sheet.displayHeaders.slice(1).map((_, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            border: '1px solid #999',
                            padding: '3px 6px',
                            fontWeight: 'bold',
                          }}
                        >
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
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textAlign: 'right',
                }}
              >
                Grand Total Qty: {sheet.grandQtyTotal}
                {sheet.grandExtTotal > 0 && (
                  <span style={{ marginLeft: '24px' }}>
                    Grand Total: ${sheet.grandExtTotal.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
