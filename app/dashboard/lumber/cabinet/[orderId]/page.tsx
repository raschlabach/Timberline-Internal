'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, RotateCcw, DollarSign, ChevronDown, ChevronUp, Loader2, CheckCircle2, Circle, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  priceKey,
  normalizeSpecie,
  isPartMissing,
  formatCell,
  formatNum,
  formatDollar,
  RIP_HEADERS,
  MOULD_HEADERS,
} from '@/lib/cabinet-processing'
import type {
  ProcessedSheet,
  SpecialTabResult,
  SpecialRow,
  CellValue,
} from '@/lib/cabinet-processing'

// ===== Row Color Maps =====

const RIP_SPECIE_COLORS: Record<string, string> = {
  'Hard Maple': '#ece4f0',
  'Hickory': '#e0eddf',
  'Red Oak': '#f5e3d3',
  'Sap Soft Maple': '#dce6f3',
}

const MOULD_PROFILE_COLORS: Record<string, string> = {
  'PL 13': '#e0eddf',
  'S4S': '#f5e3d3',
  'Slant Shaker': '#f0edd0',
  'ISP01': '#dce6f3',
}

// ===== Editable Part Number Cell =====

function EditablePartNum({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const missing = isPartMissing(value)

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== value) onChange(trimmed)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="w-28 border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      />
    )
  }

  if (missing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-amber-500 font-medium text-xs hover:text-amber-700 hover:underline cursor-pointer"
      >
        ⚠ MISSING — click to enter
      </button>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="hover:text-blue-600 hover:underline cursor-pointer text-left"
      title="Click to edit part number"
    >
      {value}
    </button>
  )
}

// ===== RipTable Component =====

function RipTable({ rows, speciesTotals, totalBoardFt, compact, categoryPrices, onPartNumChange }: {
  rows: SpecialRow[]
  speciesTotals: { specie: string; boardFt: number }[]
  totalBoardFt: number
  compact?: boolean
  categoryPrices?: Record<string, number>
  onPartNumChange?: (rowIdx: number, val: string) => void
}) {
  const p = compact ? '2px 6px' : undefined
  const bs = compact ? '1px solid #ccc' : undefined
  const hb = compact ? '1px solid #999' : undefined

  const speciesOurTotals: Record<string, number> = {}
  let grandOurTotal = 0
  for (const r of rows) {
    const rate = categoryPrices?.[priceKey(r.profile, r.specie)]
    if (rate) {
      const ourPrice = r.boardFt * rate
      speciesOurTotals[r.specie] = (speciesOurTotals[r.specie] || 0) + ourPrice
      grandOurTotal += ourPrice
    }
  }

  return (
    <table className={compact ? undefined : 'w-full text-sm'} style={compact ? {
      width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'Arial, sans-serif',
    } : undefined}>
      <thead>
        <tr className={compact ? undefined : 'bg-gray-50 border-b'}>
          {RIP_HEADERS.map((h, i) => (
            <th key={i} className={compact ? undefined : `px-3 py-2 text-left font-medium whitespace-nowrap ${i >= 10 ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`}
              style={compact ? { border: hb, padding: p, textAlign: 'left', fontWeight: 600, backgroundColor: i >= 10 ? '#dbeafe' : '#f0f0f0', whiteSpace: 'nowrap' } : undefined}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const missing = isPartMissing(r.partNum)
          const rate = categoryPrices?.[priceKey(r.profile, r.specie)]
          const ourPrice = rate ? r.boardFt * rate : undefined
          const rowBg = missing ? '#fffbeb' : RIP_SPECIE_COLORS[r.specie]
          const Td = ({ children, blue }: { children: React.ReactNode; blue?: boolean }) => (
            <td className={compact ? undefined : `px-3 py-1.5 ${blue ? 'bg-blue-50/50' : ''}`}
              style={compact ? { border: bs, padding: p, backgroundColor: blue ? '#eff6ff' : undefined } : undefined}>{children}</td>
          )
          return (
            <tr key={i} className={compact ? undefined : 'border-b border-gray-100'}
              style={rowBg ? { backgroundColor: rowBg } : undefined}>
              <Td>{r.poNumber}</Td>
              <Td>
                {compact
                  ? (missing ? '⚠' : r.partNum)
                  : onPartNumChange
                    ? <EditablePartNum value={r.partNum} onChange={(val) => onPartNumChange(i, val)} />
                    : (missing ? <span className="text-amber-500 font-medium">⚠ MISSING</span> : r.partNum)}
              </Td>
              <Td>{r.quantity}</Td>
              <Td>{formatNum(r.ripWidth)}</Td>
              <Td>{r.specie}</Td>
              <Td>{formatNum(r.thickness)}</Td>
              <Td>{formatNum(r.width)}</Td>
              <Td>{r.profile}</Td>
              <Td>{r.grade}</Td>
              <Td>{formatNum(r.boardFt, 2)}</Td>
              <Td blue>{rate !== undefined ? rate.toFixed(4) : '—'}</Td>
              <Td blue>{ourPrice !== undefined ? formatDollar(ourPrice) : '—'}</Td>
            </tr>
          )
        })}
        <tr className={compact ? undefined : 'border-t-2 border-gray-300'}>
          <td colSpan={12} className={compact ? undefined : 'py-2'} style={compact ? { padding: '6px' } : undefined} />
        </tr>
        {speciesTotals.map((st, i) => (
          <tr key={`st-${i}`} className={compact ? undefined : 'bg-emerald-50 font-semibold text-emerald-800'}>
            <td colSpan={4} className={compact ? undefined : 'px-3 py-1'} style={compact ? { border: hb, padding: p, fontWeight: 'bold' } : undefined} />
            <td className={compact ? undefined : 'px-3 py-1'} style={compact ? { border: hb, padding: p, fontWeight: 'bold' } : undefined}>{st.specie}</td>
            <td colSpan={4} className={compact ? undefined : 'px-3 py-1'} style={compact ? { border: hb, padding: p } : undefined} />
            <td className={compact ? undefined : 'px-3 py-1'} style={compact ? { border: hb, padding: p, fontWeight: 'bold' } : undefined}>{formatNum(st.boardFt, 2)}</td>
            <td className={compact ? undefined : 'px-3 py-1 bg-blue-50/50'} style={compact ? { border: hb, padding: p } : undefined} />
            <td className={compact ? undefined : 'px-3 py-1 bg-blue-50/50 font-bold text-blue-700'} style={compact ? { border: hb, padding: p, fontWeight: 'bold', color: '#1d4ed8' } : undefined}>
              {speciesOurTotals[st.specie] !== undefined ? formatDollar(speciesOurTotals[st.specie]) : '—'}
            </td>
          </tr>
        ))}
        <tr className={compact ? undefined : 'bg-emerald-100 font-bold text-emerald-900'}>
          <td colSpan={4} className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: hb, padding: p, fontWeight: 'bold' } : undefined} />
          <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: hb, padding: p, fontWeight: 'bold' } : undefined}>TOTAL</td>
          <td colSpan={4} className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: hb, padding: p } : undefined} />
          <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: hb, padding: p, fontWeight: 'bold' } : undefined}>{formatNum(totalBoardFt, 2)}</td>
          <td className={compact ? undefined : 'px-3 py-1.5 bg-blue-50/50'} style={compact ? { border: hb, padding: p } : undefined} />
          <td className={compact ? undefined : 'px-3 py-1.5 bg-blue-100 font-bold text-blue-800'} style={compact ? { border: hb, padding: p, fontWeight: 'bold', color: '#1e40af' } : undefined}>
            {grandOurTotal > 0 ? formatDollar(grandOurTotal) : '—'}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ===== MouldTable Component =====

function MouldTable({ rows, compact, onPartNumChange }: { rows: SpecialRow[]; compact?: boolean; onPartNumChange?: (rowIdx: number, val: string) => void }) {
  const p = compact ? '2px 6px' : undefined
  const bs = compact ? '1px solid #ccc' : undefined
  const hb = compact ? '1px solid #999' : undefined

  return (
    <table className={compact ? undefined : 'w-full text-sm'} style={compact ? {
      width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'Arial, sans-serif',
    } : undefined}>
      <thead>
        <tr className={compact ? undefined : 'bg-gray-50 border-b'}>
          {MOULD_HEADERS.map((h, i) => (
            <th key={i} className={compact ? undefined : 'px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap'}
              style={compact ? { border: hb, padding: p, textAlign: 'left', fontWeight: 600, backgroundColor: '#f0f0f0', whiteSpace: 'nowrap' } : undefined}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const missing = isPartMissing(r.partNum)
          const rowBg = missing ? '#fffbeb' : MOULD_PROFILE_COLORS[r.profile]
          const Td = ({ children }: { children: React.ReactNode }) => (
            <td className={compact ? undefined : 'px-3 py-1.5'} style={compact ? { border: bs, padding: p } : undefined}>{children}</td>
          )
          return (
            <tr key={i} className={compact ? undefined : 'border-b border-gray-100'}
              style={rowBg ? { backgroundColor: rowBg } : undefined}>
              <Td>{r.poNumber}</Td>
              <Td>
                {compact
                  ? (missing ? '⚠' : r.partNum)
                  : onPartNumChange
                    ? <EditablePartNum value={r.partNum} onChange={(val) => onPartNumChange(i, val)} />
                    : (missing ? <span className="text-amber-500 font-medium">⚠ MISSING</span> : r.partNum)}
              </Td>
              <Td>{r.quantity}</Td>
              <Td>{formatNum(r.width)}</Td>
              <Td>{r.profile}</Td>
              <Td>{formatNum(r.thickness)}</Td>
              <Td>{r.specie}</Td>
              <Td>{r.grade}</Td>
              <Td>{r.sortOrder}</Td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ===== Detail Page Component =====

export default function CabinetOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params?.orderId as string

  const [isLoading, setIsLoading] = useState(true)
  const [fileName, setFileName] = useState('')
  const [isDone, setIsDone] = useState(false)
  const [sheets, setSheets] = useState<ProcessedSheet[]>([])
  const [specialResults, setSpecialResults] = useState<SpecialTabResult[]>([])
  const [uploadCombos, setUploadCombos] = useState<{ profile: string; species: string }[]>([])

  const [activeTab, setActiveTab] = useState(0)
  const [activeSpecialIdx, setActiveSpecialIdx] = useState<number | null>(null)
  const [specialView, setSpecialView] = useState<'rip' | 'mould'>('rip')

  const [categoryPrices, setCategoryPrices] = useState<Record<string, number>>({})
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({})
  const [showPriceManager, setShowPriceManager] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/lumber/cabinet/orders/${orderId}`)
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Order not found')
          router.push('/dashboard/lumber/cabinet')
          return
        }
        throw new Error('Failed to fetch')
      }
      const data = await res.json()
      setFileName(data.file_name)
      setIsDone(data.is_done ?? false)
      setSheets(data.processed_sheets || [])
      setSpecialResults(data.special_results || [])
      setUploadCombos(data.upload_combos || [])
    } catch {
      toast.error('Failed to load order')
    } finally {
      setIsLoading(false)
    }
  }, [orderId, router])

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/lumber/cabinet/prices')
      if (res.ok) {
        const data: { profile: string; species: string; price_per_bf: string }[] = await res.json()
        const map: Record<string, number> = {}
        for (const row of data) {
          map[priceKey(row.profile, row.species)] = parseFloat(row.price_per_bf)
        }
        setCategoryPrices(map)
      }
    } catch { /* prices unavailable */ }
  }, [])

  const savePrice = useCallback(async (profile: string, species: string, priceBf: number) => {
    try {
      const res = await fetch('/api/lumber/cabinet/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, species, price_per_bf: priceBf }),
      })
      if (res.ok) {
        setCategoryPrices(prev => ({ ...prev, [priceKey(profile, species)]: priceBf }))
      }
    } catch { /* save failed */ }
  }, [])

  useEffect(() => {
    fetchOrder()
    fetchPrices()
  }, [fetchOrder, fetchPrices])

  async function handleToggleDone() {
    const newValue = !isDone
    setIsDone(newValue)
    try {
      const res = await fetch(`/api/lumber/cabinet/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_done: newValue }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(newValue ? 'Order marked as done' : 'Order marked as active')
    } catch {
      setIsDone(!newValue)
      toast.error('Failed to update status')
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/lumber/cabinet/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processed_sheets: sheets,
          special_results: specialResults,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setHasUnsavedChanges(false)
      toast.success('Part numbers saved')
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  function updateSheetPartNum(sheetIdx: number, sectionIdx: number, rowIdx: number, value: string) {
    setSheets(prev => {
      const next = prev.map((sheet, si) => {
        if (si !== sheetIdx) return sheet
        const newSections = sheet.sections.map((section, secIdx) => {
          if (secIdx !== sectionIdx) return section
          const newRows = section.rows.map((row, ri) => {
            if (ri !== rowIdx) return row
            const newRow = [...row]
            newRow[sheet.partNumDisplayIdx] = value || null
            return newRow
          })
          return { ...section, rows: newRows }
        })
        const missingPartCount = sheet.partNumDisplayIdx >= 0
          ? newSections.reduce((sum, sec) => sum + sec.rows.filter(r => {
              const val = r[sheet.partNumDisplayIdx]
              return val === null || val === undefined || String(val).trim() === ''
            }).length, 0)
          : 0
        return { ...sheet, sections: newSections, missingPartCount }
      })
      return next
    })
    setHasUnsavedChanges(true)
  }

  function updateSpecialPartNum(specialIdx: number, viewType: 'rip' | 'mould', rowIdx: number, value: string) {
    setSpecialResults(prev => prev.map((sr, si) => {
      if (si !== specialIdx) return sr
      const field = viewType === 'rip' ? 'ripRows' : 'mouldRows'
      const newRows = sr[field].map((r, ri) => ri === rowIdx ? { ...r, partNum: value } : r)
      const allRows = [...(viewType === 'rip' ? newRows : sr.ripRows), ...(viewType === 'mould' ? newRows : sr.mouldRows)]
      const missingPartCount = allRows.filter(r => isPartMissing(r.partNum)).length
      return { ...sr, [field]: newRows, missingPartCount }
    }))
    setHasUnsavedChanges(true)
  }

  function handlePrint() { window.print() }

  function handlePriceEditBlur(key: string, profile: string, species: string) {
    const raw = priceEdits[key]
    if (raw === undefined) return
    const val = parseFloat(raw)
    if (!isNaN(val) && val >= 0) {
      savePrice(profile, species, val)
    }
    setPriceEdits(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading order...</span>
      </div>
    )
  }

  const sheetsWithOrders = sheets.filter(s => s.sections.length > 0)
  const activeSheet = activeSpecialIdx === null ? sheets[activeTab] : null
  const activeSpecial = activeSpecialIdx !== null ? specialResults[activeSpecialIdx] : null

  const totalMissingParts = sheets.reduce((sum, s) => sum + s.missingPartCount, 0)
    + specialResults.reduce((sum, s) => sum + s.missingPartCount, 0)

  const totalPrintPages = sheetsWithOrders.length + specialResults.length * 2

  const hasPricing = (sheet: ProcessedSheet) =>
    sheet.tabProfile !== '' && sheet.widthDisplayIdx >= 0 && sheet.speciesDisplayIdx >= 0

  const missingRateCount = uploadCombos.filter(c => {
    const rate = categoryPrices[priceKey(c.profile, c.species)]
    return rate === undefined || rate <= 0
  }).length

  function calcRowBf(sheet: ProcessedSheet, row: CellValue[]): number {
    if (sheet.widthDisplayIdx < 0) return 0
    const qty = Number(row[0]) || 0
    const width = Number(row[sheet.widthDisplayIdx]) || 0
    return qty * (width + 0.125) / 12
  }

  function getRowRate(sheet: ProcessedSheet, row: CellValue[]): number | undefined {
    if (!hasPricing(sheet)) return undefined
    const species = normalizeSpecie(String(row[sheet.speciesDisplayIdx] ?? '').trim())
    if (!species) return undefined
    return categoryPrices[priceKey(sheet.tabProfile, species)]
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 0.4in; size: landscape; }
          body * { visibility: hidden !important; }
          .cabinet-print-area, .cabinet-print-area * { visibility: visible !important; }
          .cabinet-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .cabinet-page-break { page-break-before: always; }
        }
      `}} />

      <div className="print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/lumber/cabinet')} className="gap-1.5 text-gray-600">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cabinet Shop Order</h1>
              <p className="text-sm text-gray-500 mt-1">{fileName}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowPriceManager(!showPriceManager)}
              className={`gap-2 ${showPriceManager ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}>
              <DollarSign className="h-4 w-4" />
              Price Rates
              {missingRateCount > 0 && <span className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{missingRateCount}</span>}
              {showPriceManager ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            {hasUnsavedChanges && (
              <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            )}
            <Button
              variant={isDone ? 'default' : 'outline'}
              onClick={handleToggleDone}
              className={`gap-2 ${isDone ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {isDone ? 'Done' : 'Mark Done'}
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard/lumber/cabinet')} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Back to List
            </Button>
            <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Printer className="h-4 w-4" /> Print All ({totalPrintPages} pages)
            </Button>
          </div>
        </div>

        {/* Price Manager Panel */}
        {showPriceManager && (
          <div className="bg-white rounded-lg border border-blue-200 overflow-hidden mb-4">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-blue-800">Price Rates ($/BF by Profile + Species)</span>
                <span className="text-sm text-blue-600 ml-3">{uploadCombos.length} combinations found in order</span>
              </div>
              {missingRateCount > 0 && (
                <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  {missingRateCount} need pricing
                </span>
              )}
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Profile</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Species</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">$/BF</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const allKeys = new Set<string>()
                    const allCombos: { profile: string; species: string; key: string }[] = []
                    for (const c of uploadCombos) {
                      const k = priceKey(c.profile, c.species)
                      if (!allKeys.has(k)) { allKeys.add(k); allCombos.push({ ...c, key: k }) }
                    }
                    for (const [k] of Object.entries(categoryPrices)) {
                      if (!allKeys.has(k)) {
                        const parts = k.split('::')
                        allKeys.add(k)
                        allCombos.push({ profile: parts[0], species: parts[1], key: k })
                      }
                    }
                    allCombos.sort((a, b) => a.profile.localeCompare(b.profile) || a.species.localeCompare(b.species))

                    let lastProfile = ''
                    return allCombos.map((c) => {
                      const stored = categoryPrices[c.key]
                      const editing = priceEdits[c.key]
                      const hasRate = stored !== undefined && stored > 0
                      const showProfile = c.profile !== lastProfile
                      lastProfile = c.profile

                      return (
                        <tr key={c.key} className={`border-b ${hasRate ? 'bg-white hover:bg-gray-50' : 'bg-amber-50'}`}>
                          <td className="px-3 py-1.5 font-medium text-gray-800">
                            {showProfile ? c.profile : ''}
                          </td>
                          <td className="px-3 py-1.5">{c.species}</td>
                          <td className="px-2 py-1">
                            <input
                              type="number" step="0.0001" min="0"
                              className="w-28 text-right border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                              value={editing ?? (stored !== undefined ? stored.toFixed(4) : '')}
                              placeholder="0.0000"
                              onChange={(e) => setPriceEdits(prev => ({ ...prev, [c.key]: e.target.value }))}
                              onBlur={() => handlePriceEditBlur(c.key, c.profile, c.species)}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-sm">
                            {hasRate
                              ? <span className="text-emerald-600 font-medium">✓</span>
                              : <span className="text-amber-500">⚠ Set price</span>}
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Tabs With Orders</div>
            <div className="text-2xl font-bold text-emerald-700">{sheetsWithOrders.length}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Rip/Mould Groups</div>
            <div className="text-2xl font-bold text-blue-600">{specialResults.length}</div>
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
          {sheets.map((sheet, idx) => {
            const hasOrders = sheet.sections.length > 0
            const isActive = activeSpecialIdx === null && idx === activeTab
            return (
              <button key={sheet.name} onClick={() => { setActiveTab(idx); setActiveSpecialIdx(null) }}
                className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive ? 'bg-emerald-600 text-white'
                    : hasOrders ? 'bg-white text-gray-700 hover:bg-gray-100 border'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}>
                {sheet.name.trim()}
                {hasOrders && <span className="ml-1.5 text-xs opacity-75">({sheet.grandQtyTotal})</span>}
                {sheet.missingPartCount > 0 && <span className="ml-1 text-amber-500">⚠</span>}
              </button>
            )
          })}

          {specialResults.length > 0 && <div className="w-px h-8 bg-gray-300 mx-2 shrink-0" />}

          {specialResults.map((sr, idx) => (
            <button key={sr.label} onClick={() => { setActiveSpecialIdx(idx); setSpecialView('rip') }}
              className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeSpecialIdx === idx ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}>
              {sr.label} <span className="ml-1.5 text-xs opacity-75">({sr.ripRows.length})</span>
              {sr.missingPartCount > 0 && <span className="ml-1 text-amber-300">⚠</span>}
            </button>
          ))}
        </div>

        {/* ===== Standard Sheet Content ===== */}
        {activeSheet && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-900">{activeSheet.name.trim()}</span>
                <span className="text-sm text-gray-500 ml-3">PO# {activeSheet.poNumber}</span>
                <span className="text-sm text-gray-500 ml-3">Due: {activeSheet.dueDate}</span>
                {activeSheet.tabProfile && <span className="text-xs text-blue-600 ml-3 bg-blue-50 px-2 py-0.5 rounded">{activeSheet.tabProfile}</span>}
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
                      {hasPricing(activeSheet) && (
                        <>
                          <th className="px-3 py-2 text-left font-medium text-blue-600 whitespace-nowrap bg-blue-50">Our $</th>
                          <th className="px-3 py-2 text-left font-medium text-blue-600 whitespace-nowrap bg-blue-50">NB $</th>
                          <th className="px-3 py-2 text-left font-medium text-blue-600 whitespace-nowrap bg-blue-50">+/−</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSheet.sections.map((section, sIdx) => {
                      let sectionOurTotal = 0
                      let sectionHasRate = false
                      const sectionRows = section.rows.map((row, rIdx) => {
                        const isMissingPart = activeSheet.partNumDisplayIdx >= 0 &&
                          (row[activeSheet.partNumDisplayIdx] === null ||
                           row[activeSheet.partNumDisplayIdx] === undefined ||
                           String(row[activeSheet.partNumDisplayIdx]).trim() === '')
                        const bf = calcRowBf(activeSheet, row)
                        const rate = getRowRate(activeSheet, row)
                        const ourPrice = rate !== undefined ? bf * rate : undefined
                        const nbPrice = section.rowExtPrices[rIdx] || 0
                        const diff = ourPrice !== undefined ? nbPrice - ourPrice : undefined
                        if (ourPrice !== undefined) { sectionOurTotal += ourPrice; sectionHasRate = true }

                        return (
                          <tr key={rIdx} className={`border-b border-gray-100 ${isMissingPart ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap">
                                {cIdx === activeSheet.partNumDisplayIdx
                                  ? <EditablePartNum
                                      value={String(cell ?? '')}
                                      onChange={(val) => updateSheetPartNum(activeTab, sIdx, rIdx, val)}
                                    />
                                  : formatCell(cell, cIdx, activeSheet.displayHeaders)}
                              </td>
                            ))}
                            {hasPricing(activeSheet) && (
                              <>
                                <td className="px-3 py-1.5 bg-blue-50/50 text-right font-mono text-xs">
                                  {ourPrice !== undefined ? formatDollar(ourPrice) : '—'}
                                </td>
                                <td className="px-3 py-1.5 bg-blue-50/50 text-right font-mono text-xs">
                                  {formatDollar(nbPrice)}
                                </td>
                                <td className={`px-3 py-1.5 bg-blue-50/50 text-right font-mono text-xs font-medium ${
                                  diff === undefined ? 'text-gray-300'
                                    : Math.abs(diff) < 0.5 ? 'text-emerald-600'
                                      : diff > 0 ? 'text-red-600' : 'text-amber-600'
                                }`}>
                                  {diff === undefined ? '—' : diff > 0 ? `+${formatDollar(diff)}` : formatDollar(diff)}
                                </td>
                              </>
                            )}
                          </tr>
                        )
                      })

                      return (
                        <Fragment key={sIdx}>
                          {sIdx > 0 && (
                            <tr><td colSpan={activeSheet.displayHeaders.length + (hasPricing(activeSheet) ? 3 : 0)} className="py-2 border-b" /></tr>
                          )}
                          {sectionRows}
                          <tr className="bg-emerald-50 border-b-2 border-emerald-200 font-semibold text-emerald-800">
                            <td className="px-3 py-1.5">{section.qtyTotal}</td>
                            {activeSheet.displayHeaders.slice(1).map((_, cIdx) => (
                              <td key={cIdx} className="px-3 py-1.5">
                                {cIdx + 1 === activeSheet.extPriceDisplayIdx ? `$${section.extPriceTotal.toFixed(2)}` : ''}
                              </td>
                            ))}
                            {hasPricing(activeSheet) && (
                              <>
                                <td className="px-3 py-1.5 bg-blue-50/50 text-right font-mono text-xs font-bold text-blue-700">
                                  {sectionHasRate ? formatDollar(sectionOurTotal) : '—'}
                                </td>
                                <td className="px-3 py-1.5 bg-blue-50/50 text-right font-mono text-xs font-bold">
                                  {formatDollar(section.extPriceTotal)}
                                </td>
                                <td className={`px-3 py-1.5 bg-blue-50/50 text-right font-mono text-xs font-bold ${
                                  !sectionHasRate ? 'text-gray-300'
                                    : Math.abs(section.extPriceTotal - sectionOurTotal) < 0.5 ? 'text-emerald-600'
                                      : (section.extPriceTotal - sectionOurTotal) > 0 ? 'text-red-600' : 'text-amber-600'
                                }`}>
                                  {!sectionHasRate ? '—' : (section.extPriceTotal - sectionOurTotal) > 0
                                    ? `+${formatDollar(section.extPriceTotal - sectionOurTotal)}`
                                    : formatDollar(section.extPriceTotal - sectionOurTotal)}
                                </td>
                              </>
                            )}
                          </tr>
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>

                {/* Page grand total comparison */}
                {hasPricing(activeSheet) && activeSheet.sections.length > 0 && (() => {
                  let grandOur = 0
                  let grandHasRate = false
                  for (const section of activeSheet.sections) {
                    for (let i = 0; i < section.rows.length; i++) {
                      const rate = getRowRate(activeSheet, section.rows[i])
                      if (rate !== undefined) {
                        grandOur += calcRowBf(activeSheet, section.rows[i]) * rate
                        grandHasRate = true
                      }
                    }
                  }
                  const grandNb = activeSheet.grandExtTotal
                  const grandDiff = grandNb - grandOur
                  return (
                    <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-6 text-sm">
                      <span className="text-gray-600">Page Totals:</span>
                      <span className="font-semibold text-blue-700">Our: ${grandHasRate ? formatDollar(grandOur) : '—'}</span>
                      <span className="font-semibold text-gray-700">NB: ${formatDollar(grandNb)}</span>
                      <span className={`font-bold px-3 py-1 rounded-full ${
                        !grandHasRate ? 'text-gray-400 bg-gray-100'
                          : Math.abs(grandDiff) < 1 ? 'text-emerald-700 bg-emerald-100'
                            : grandDiff > 0 ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100'
                      }`}>
                        {!grandHasRate ? 'Set rates to compare'
                          : grandDiff > 0 ? `NB +$${formatDollar(grandDiff)}` : `NB $${formatDollar(grandDiff)}`}
                      </span>
                    </div>
                  )
                })()}
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
                <span className="text-sm text-gray-500 ml-3">PO# {activeSpecial.poNumbers.join(', ')}</span>
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
            <div className="flex border-b">
              <button onClick={() => setSpecialView('rip')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  specialView === 'rip' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'
                }`}>
                RIP View <span className="ml-2 text-xs opacity-75">(Board Ft: {formatNum(activeSpecial.totalBoardFt, 1)})</span>
              </button>
              <button onClick={() => setSpecialView('mould')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  specialView === 'mould' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'
                }`}>
                MOULD View
              </button>
            </div>
            <div className="overflow-x-auto">
              {specialView === 'rip'
                ? <RipTable rows={activeSpecial.ripRows} speciesTotals={activeSpecial.speciesTotals} totalBoardFt={activeSpecial.totalBoardFt} categoryPrices={categoryPrices}
                    onPartNumChange={(rowIdx, val) => updateSpecialPartNum(activeSpecialIdx!, 'rip', rowIdx, val)} />
                : <MouldTable rows={activeSpecial.mouldRows}
                    onPartNumChange={(rowIdx, val) => updateSpecialPartNum(activeSpecialIdx!, 'mould', rowIdx, val)} />}
            </div>
          </div>
        )}
      </div>

      {/* ===== Print Layout ===== */}
      <div className="cabinet-print-area hidden print:block">
        {sheetsWithOrders.map((sheet, sheetIdx) => {
          const pricing = hasPricing(sheet)
          return (
            <div key={sheet.name} className={sheetIdx > 0 ? 'cabinet-page-break' : ''}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Nature&apos;s Blend Wood Products</div>
                <div style={{ fontSize: '11px', display: 'flex', gap: '24px' }}>
                  <span>PO# {sheet.poNumber}</span>
                  <span>Due Date: {sheet.dueDate}</span>
                  {sheet.tabProfile && <span>Profile: {sheet.tabProfile}</span>}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px', borderBottom: '2px solid #333', paddingBottom: '4px' }}>
                  {sheet.name.trim()}
                  {sheet.missingPartCount > 0 && (
                    <span style={{ marginLeft: '12px', color: '#d97706', fontSize: '11px' }}>({sheet.missingPartCount} missing part #)</span>
                  )}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'Arial, sans-serif' }}>
                <thead>
                  <tr>
                    {sheet.displayHeaders.map((h, i) => (
                      <th key={i} style={{ border: '1px solid #999', padding: '3px 6px', textAlign: 'left', fontWeight: 600, backgroundColor: '#f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    {pricing && (
                      <>
                        <th style={{ border: '1px solid #999', padding: '3px 6px', textAlign: 'right', fontWeight: 600, backgroundColor: '#dbeafe', whiteSpace: 'nowrap' }}>Our $</th>
                        <th style={{ border: '1px solid #999', padding: '3px 6px', textAlign: 'right', fontWeight: 600, backgroundColor: '#dbeafe', whiteSpace: 'nowrap' }}>NB $</th>
                        <th style={{ border: '1px solid #999', padding: '3px 6px', textAlign: 'right', fontWeight: 600, backgroundColor: '#dbeafe', whiteSpace: 'nowrap' }}>+/−</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sheet.sections.map((section, sIdx) => {
                    let sectionOurTotal = 0
                    let sectionHasRate = false
                    return (
                      <Fragment key={sIdx}>
                        {sIdx > 0 && <tr><td colSpan={sheet.displayHeaders.length + (pricing ? 3 : 0)} style={{ padding: '4px' }} /></tr>}
                        {section.rows.map((row, rIdx) => {
                          const isMissing = sheet.partNumDisplayIdx >= 0 &&
                            (row[sheet.partNumDisplayIdx] === null || row[sheet.partNumDisplayIdx] === undefined || String(row[sheet.partNumDisplayIdx]).trim() === '')
                          const bf = calcRowBf(sheet, row)
                          const rate = getRowRate(sheet, row)
                          const ourPrice = rate !== undefined ? bf * rate : undefined
                          const nbPrice = section.rowExtPrices[rIdx] || 0
                          const diff = ourPrice !== undefined ? nbPrice - ourPrice : undefined
                          if (ourPrice !== undefined) { sectionOurTotal += ourPrice; sectionHasRate = true }
                          return (
                            <tr key={rIdx} style={isMissing ? { backgroundColor: '#fffbeb' } : undefined}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} style={{ border: '1px solid #ccc', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                                  {cIdx === sheet.partNumDisplayIdx && isMissing ? '⚠' : formatCell(cell, cIdx, sheet.displayHeaders)}
                                </td>
                              ))}
                              {pricing && (
                                <>
                                  <td style={{ border: '1px solid #ccc', padding: '2px 6px', textAlign: 'right', backgroundColor: '#eff6ff' }}>
                                    {ourPrice !== undefined ? formatDollar(ourPrice) : ''}
                                  </td>
                                  <td style={{ border: '1px solid #ccc', padding: '2px 6px', textAlign: 'right', backgroundColor: '#eff6ff' }}>
                                    {formatDollar(nbPrice)}
                                  </td>
                                  <td style={{
                                    border: '1px solid #ccc', padding: '2px 6px', textAlign: 'right', fontWeight: 'bold',
                                    color: diff === undefined ? '#ccc' : Math.abs(diff) < 0.5 ? '#059669' : diff > 0 ? '#dc2626' : '#d97706',
                                  }}>
                                    {diff === undefined ? '' : diff > 0 ? `+${formatDollar(diff)}` : formatDollar(diff)}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                        <tr>
                          <td style={{ border: '1px solid #999', padding: '3px 6px', fontWeight: 'bold' }}>{section.qtyTotal}</td>
                          {sheet.displayHeaders.slice(1).map((_, cIdx) => (
                            <td key={cIdx} style={{ border: '1px solid #999', padding: '3px 6px', fontWeight: 'bold' }}>
                              {cIdx + 1 === sheet.extPriceDisplayIdx ? `$${section.extPriceTotal.toFixed(2)}` : ''}
                            </td>
                          ))}
                          {pricing && (
                            <>
                              <td style={{ border: '1px solid #999', padding: '3px 6px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#dbeafe' }}>
                                {sectionHasRate ? formatDollar(sectionOurTotal) : ''}
                              </td>
                              <td style={{ border: '1px solid #999', padding: '3px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                                {formatDollar(section.extPriceTotal)}
                              </td>
                              <td style={{
                                border: '1px solid #999', padding: '3px 6px', textAlign: 'right', fontWeight: 'bold',
                                color: !sectionHasRate ? '#ccc' : Math.abs(section.extPriceTotal - sectionOurTotal) < 0.5 ? '#059669' : (section.extPriceTotal - sectionOurTotal) > 0 ? '#dc2626' : '#d97706',
                              }}>
                                {sectionHasRate ? ((section.extPriceTotal - sectionOurTotal) > 0 ? `+${formatDollar(section.extPriceTotal - sectionOurTotal)}` : formatDollar(section.extPriceTotal - sectionOurTotal)) : ''}
                              </td>
                            </>
                          )}
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>

              {sheet.sections.length > 1 && (
                <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 'bold', textAlign: 'right' }}>
                  Grand Total Qty: {sheet.grandQtyTotal}
                  {sheet.grandExtTotal > 0 && <span style={{ marginLeft: '24px' }}>NB Grand Total: ${sheet.grandExtTotal.toFixed(2)}</span>}
                </div>
              )}
            </div>
          )
        })}

        {specialResults.map((sr) => (
          <Fragment key={sr.label}>
            <div className="cabinet-page-break">
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Nature&apos;s Blend Wood Products</div>
                <div style={{ fontSize: '11px', display: 'flex', gap: '24px' }}>
                  <span>PO# {sr.poNumbers.join(', ')}</span>
                  <span>Due Date: {sr.dueDate}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px', borderBottom: '2px solid #333', paddingBottom: '4px' }}>
                  {sr.label} — RIP
                  {sr.missingPartCount > 0 && <span style={{ marginLeft: '12px', color: '#d97706', fontSize: '11px' }}>({sr.missingPartCount} missing part #)</span>}
                </div>
              </div>
              <RipTable rows={sr.ripRows} speciesTotals={sr.speciesTotals} totalBoardFt={sr.totalBoardFt} compact categoryPrices={categoryPrices} />
            </div>
            <div className="cabinet-page-break">
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Nature&apos;s Blend Wood Products</div>
                <div style={{ fontSize: '11px', display: 'flex', gap: '24px' }}>
                  <span>PO# {sr.poNumbers.join(', ')}</span>
                  <span>Due Date: {sr.dueDate}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px', borderBottom: '2px solid #333', paddingBottom: '4px' }}>
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
