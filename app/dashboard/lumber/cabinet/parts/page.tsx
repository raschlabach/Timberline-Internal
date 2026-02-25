'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Plus, Trash2, RotateCcw, ArrowRightLeft, CopyPlus, X, Settings2, ChevronDown, ChevronUp } from 'lucide-react'

const STORAGE_KEY = 'partBuilder_state'

// ===== Layup Formulas =====

function layupWidth_Standard(w: number): number | null {
  if (w > 1 && w <= 4) return (w * 8) + 1.5625
  if (w > 4 && w <= 5) return (w * 7) + 1.375
  if (w > 5 && w <= 5.75) return (w * 6) + 1.1875
  if (w > 5.75 && w <= 7) return (w * 5) + 1
  if (w > 7 && w <= 9) return (w * 4) + 0.8125
  if (w > 9 && w <= 12.375) return (w * 3) + 0.625
  if (w > 12.375 && w <= 18.75) return (w * 2) + 0.4375
  if (w > 18.75 && w < 37) return w + 0.25
  return null
}

function pcsLayup_Standard(w: number): number | null {
  if (w > 1 && w <= 4) return 8
  if (w > 4 && w <= 5) return 7
  if (w > 5 && w <= 5.75) return 6
  if (w > 5.75 && w <= 7) return 5
  if (w > 7 && w <= 9) return 4
  if (w > 9 && w <= 12.375) return 3
  if (w > 12.375 && w <= 18.75) return 2
  if (w > 18.75 && w < 37) return 1
  return null
}

function layupWidth_125(w: number): number | null {
  if (w > 1 && w <= 4) return (w * 8) + 1.5625
  if (w > 4 && w <= 5) return (w * 7) + 1.375
  if (w > 5 && w <= 5.75) return (w * 6) + 1.1875
  if (w > 5.75 && w <= 7) return (w * 5) + 1
  if (w > 7 && w <= 9) return (w * 4) + 0.8125
  if (w > 9 && w <= 12) return (w * 3) + 0.625
  if (w > 12 && w <= 18) return (w * 2) + 0.4375
  if (w > 18 && w < 37) return w + 0.25
  return null
}

function pcsLayup_125(w: number): number | null {
  if (w > 1 && w <= 4) return 8
  if (w > 4 && w <= 5) return 7
  if (w > 5 && w <= 5.75) return 6
  if (w > 5.75 && w <= 7) return 5
  if (w > 7 && w <= 9) return 4
  if (w > 9 && w <= 12) return 3
  if (w > 12 && w <= 18) return 2
  if (w > 18 && w < 37) return 1
  return null
}

function layupWidth_DF(h: number): number | null {
  if (h > 1 && h <= 4) return (h * 8) + 3
  if (h > 4 && h <= 5) return (h * 7) + 2.625
  if (h > 5 && h <= 5.25) return (h * 6) + 2.25
  if (h > 5.25 && h <= 6.875) return (h * 5) + 1.875
  if (h > 6.875 && h <= 9) return (h * 4) + 1.5
  if (h > 9 && h <= 12.25) return (h * 3) + 1.125
  if (h > 12.25 && h <= 18) return (h * 2) + 0.75
  if (h > 18 && h < 37) return h + 0.375
  return null
}

function pcsLayup_DF(h: number): number | null {
  const w = h + 0.1875
  if (w > 1 && w <= 4.1875) return 8
  if (w > 4.1875 && w <= 5.1875) return 7
  if (w > 5.1875 && w <= 5.4375) return 6
  if (w > 5.4375 && w <= 6.875) return 5
  if (w > 6.875 && w <= 9.1875) return 4
  if (w > 9.1875 && w <= 12.4375) return 3
  if (w > 12.4375 && w <= 18.1875) return 2
  if (w > 18.1875 && w < 37) return 1
  return null
}

// ===== Types =====

interface PanelRow {
  width: string
  length: string
}

interface LinearRow {
  length: string
}

interface PanelReverseRow {
  width: string
  length: string
  price: string
}

interface LinearReverseRow {
  length: string
  price: string
}

interface PanelState {
  rate: string
  globalThickness: string
  rows: PanelRow[]
  reverseRows: PanelReverseRow[]
}

interface LinearState {
  rate: string
  globalWidth: string
  rows: LinearRow[]
  reverseRows: LinearReverseRow[]
}

// ===== Tab Configs =====

interface PanelConfig {
  type: 'panel'
  id: string
  label: string
  shortLabel: string
  defaultThickness: string
  defaultRate: string
  bfMultiplier: number
  layupWidthFn: (w: number) => number | null
  pcsLayupFn: (w: number) => number | null
  widthLabel: string
  lengthLabel: string
}

interface LinearConfig {
  type: 'linear'
  id: string
  label: string
  shortLabel: string
  defaultWidth: string
  defaultRate: string
  rateLabel: string
  copeAdder: number
  centerRailAdder: number
}

type TabConfig = PanelConfig | LinearConfig

const TABS: TabConfig[] = [
  {
    type: 'panel', id: 'rp', label: 'RP Layup BF Cost', shortLabel: 'Raised Panel',
    defaultThickness: '0.5625', defaultRate: '4.15', bfMultiplier: 1,
    layupWidthFn: layupWidth_Standard, pcsLayupFn: pcsLayup_Standard,
    widthLabel: 'Width', lengthLabel: 'Length',
  },
  {
    type: 'panel', id: 'df', label: 'DF Layup BF Cost', shortLabel: 'Drawer Front',
    defaultThickness: '0.781', defaultRate: '3.96', bfMultiplier: 1,
    layupWidthFn: layupWidth_DF, pcsLayupFn: pcsLayup_DF,
    widthLabel: 'Finish Width', lengthLabel: 'Finish Length',
  },
  {
    type: 'panel', id: 'sq', label: 'Sq Panel Layup BF Cost', shortLabel: 'Square Panel',
    defaultThickness: '0.5625', defaultRate: '4.15', bfMultiplier: 1,
    layupWidthFn: layupWidth_Standard, pcsLayupFn: pcsLayup_Standard,
    widthLabel: 'Width', lengthLabel: 'Length',
  },
  {
    type: 'panel', id: 'sq125', label: '1.25 Sq Panel Layup BF Cost', shortLabel: '1.25 Smart Panel',
    defaultThickness: '0.800', defaultRate: '3.85', bfMultiplier: 1.5,
    layupWidthFn: layupWidth_125, pcsLayupFn: pcsLayup_125,
    widthLabel: 'Width', lengthLabel: 'Length',
  },
  {
    type: 'linear', id: 'stiles', label: 'Moulded Stiles', shortLabel: 'Stiles',
    defaultWidth: '2.25', defaultRate: '2.50', rateLabel: '$/LF',
    copeAdder: 0, centerRailAdder: 0,
  },
  {
    type: 'linear', id: 'copes', label: 'Moulded Copes', shortLabel: 'Copes',
    defaultWidth: '2.25', defaultRate: '0.69', rateLabel: '$/LF',
    copeAdder: 0.12, centerRailAdder: 0.30,
  },
  {
    type: 'linear', id: 's4s', label: 'Moulded S4S', shortLabel: 'S4S',
    defaultWidth: '2.25', defaultRate: '0.73', rateLabel: '$/LF',
    copeAdder: 0, centerRailAdder: 0,
  },
]

function makePanelRows(count: number): PanelRow[] {
  return Array.from({ length: count }, () => ({ width: '', length: '' }))
}

function makeLinearRows(count: number): LinearRow[] {
  return Array.from({ length: count }, () => ({ length: '' }))
}

function makePanelReverseRows(): PanelReverseRow[] {
  return Array.from({ length: 3 }, () => ({ width: '', length: '', price: '' }))
}

function makeLinearReverseRows(): LinearReverseRow[] {
  return Array.from({ length: 3 }, () => ({ length: '', price: '' }))
}

// ===== Copy Button =====

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }, [value])

  return (
    <button onClick={handleCopy} title="Copy" className={`p-0.5 rounded transition-colors ${
      copied ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-500'
    }`}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

// ===== Output Cell with Copy =====

function OutCell({ value, decimals = 4, highlight, className, checkWidth }: {
  value: number | null; decimals?: number; highlight?: boolean; className?: string; checkWidth?: boolean
}) {
  if (value === null && !checkWidth) {
    return <td className={`px-1.5 py-1 text-right text-xs text-gray-300 ${className || ''}`}>—</td>
  }
  if (value === null && checkWidth) {
    return <td className={`px-1.5 py-1 text-right text-amber-500 text-[11px] italic ${className || ''}`}>Check Width</td>
  }
  const display = parseFloat(value!.toFixed(decimals)).toString()
  return (
    <td className={`px-1.5 py-1 text-right whitespace-nowrap text-xs font-mono ${highlight ? 'bg-blue-50 font-semibold text-blue-800' : 'text-gray-700'} ${className || ''}`}>
      <span className="inline-flex items-center gap-0.5">
        {display}
        <CopyBtn value={display} />
      </span>
    </td>
  )
}

// ===== Panel Calculator =====

function PanelCalculator({ config, state, setState }: {
  config: PanelConfig; state: PanelState; setState: (fn: (prev: PanelState) => PanelState) => void
}) {
  const rate = parseFloat(state.rate) || 0
  const thickness = parseFloat(state.globalThickness) || 0

  function updateRow(idx: number, field: keyof PanelRow, value: string) {
    setState(prev => {
      const rows = [...prev.rows]
      rows[idx] = { ...rows[idx], [field]: value }
      return { ...prev, rows }
    })
  }

  function addRow() {
    setState(prev => ({ ...prev, rows: [...prev.rows, { width: '', length: '' }] }))
  }

  function duplicateRow(idx: number) {
    setState(prev => {
      const rows = [...prev.rows]
      rows.splice(idx + 1, 0, { ...prev.rows[idx] })
      return { ...prev, rows }
    })
  }

  function removeRow(idx: number) {
    setState(prev => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))
  }

  function updateReverseRow(idx: number, field: keyof PanelReverseRow, value: string) {
    setState(prev => {
      const reverseRows = [...prev.reverseRows]
      reverseRows[idx] = { ...reverseRows[idx], [field]: value }
      return { ...prev, reverseRows }
    })
  }

  const inputCls = "w-[72px] bg-emerald-50 border border-emerald-300 rounded px-1.5 py-0.5 text-xs text-center font-medium focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-200"
  const reverseInputCls = "w-[72px] bg-blue-50 border border-blue-300 rounded px-1.5 py-0.5 text-xs text-center font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"

  return (
    <div className="space-y-2">
      {/* Settings row */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Thickness</label>
          <input type="number" step="0.001" className="w-24 bg-emerald-50 border border-emerald-300 rounded px-2 py-1 text-sm font-medium focus:border-emerald-500 focus:outline-none"
            value={state.globalThickness}
            onChange={(e) => setState(prev => ({ ...prev, globalThickness: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">$/BF Rate</label>
          <input type="number" step="0.01" className="w-24 bg-emerald-50 border border-emerald-300 rounded px-2 py-1 text-sm font-medium focus:border-emerald-500 focus:outline-none"
            value={state.rate} onChange={(e) => setState(prev => ({ ...prev, rate: e.target.value }))}
          />
        </div>
      </div>

      {/* Reverse $/BF */}
      <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
        <div className="px-3 py-1 bg-blue-50 border-b border-blue-200 flex items-center gap-1.5">
          <ArrowRightLeft size={12} className="text-blue-500" />
          <span className="text-[11px] font-semibold text-blue-700">Reverse $/BF</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-center text-gray-400 w-6">#</th>
              <th className="px-[5px] py-1 text-left text-gray-500 w-[82px]">Width</th>
              <th className="px-[5px] py-1 text-left text-gray-500 w-[82px]">Length</th>
              <th className="px-[5px] py-1 text-left text-gray-500 w-[82px]">Price</th>
              <th className="px-1.5 py-1 text-right text-gray-500">BF</th>
              <th className="px-1.5 py-1 text-right text-blue-600 font-semibold">$/BF</th>
            </tr>
          </thead>
          <tbody>
            {state.reverseRows.map((rr, idx) => {
              const rW = parseFloat(rr.width) || 0
              const rL = parseFloat(rr.length) || 0
              const rP = parseFloat(rr.price) || 0
              const rBf = rW > 0 && rL > 0 ? ((rW * rL) / 144) * config.bfMultiplier : 0
              const rRate = rBf > 0 && rP > 0 ? rP / rBf : 0
              return (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 text-center text-[10px] text-gray-400 w-6">{idx + 1}</td>
                  <td className="px-[5px] py-1 w-[82px]">
                    <input type="number" step="0.01" placeholder="W" className={reverseInputCls}
                      value={rr.width} onChange={(e) => updateReverseRow(idx, 'width', e.target.value)} />
                  </td>
                  <td className="px-[5px] py-1 w-[82px]">
                    <input type="number" step="0.01" placeholder="L" className={reverseInputCls}
                      value={rr.length} onChange={(e) => updateReverseRow(idx, 'length', e.target.value)} />
                  </td>
                  <td className="px-[5px] py-1 w-[82px]">
                    <input type="number" step="0.01" placeholder="$" className={reverseInputCls}
                      value={rr.price} onChange={(e) => updateReverseRow(idx, 'price', e.target.value)} />
                  </td>
                  <td className="px-1.5 py-1 text-right text-[11px] font-mono text-gray-500">{rBf > 0 ? rBf.toFixed(4) : '—'}</td>
                  <td className="px-1.5 py-1 text-right">
                    <span className="inline-flex items-center gap-0.5">
                      <span className="text-xs font-bold text-blue-800">{rRate > 0 ? `$${rRate.toFixed(4)}` : '—'}</span>
                      {rRate > 0 && <CopyBtn value={rRate.toFixed(4)} />}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Size Calculator Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="py-1 text-center text-gray-400 w-6">#</th>
                <th className="px-[5px] py-1 text-left text-gray-500 w-[82px]">{config.widthLabel}</th>
                <th className="px-[5px] py-1 text-left text-gray-500 w-[82px]">{config.lengthLabel}</th>
                <th className="px-1.5 py-1 text-right text-gray-500">BF</th>
                <th className="px-1.5 py-1 text-right text-blue-600 bg-blue-50">Cost</th>
                <th className="px-1.5 py-1 text-right text-gray-500">Layup W</th>
                <th className="px-1.5 py-1 text-right text-gray-500">Layup L</th>
                <th className="px-1.5 py-1 text-right text-gray-500">PCS</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, idx) => {
                const w = parseFloat(row.width) || 0
                const l = parseFloat(row.length) || 0
                const bf = w > 0 && l > 0 ? ((w * l) / 144) * config.bfMultiplier : 0
                const cost = bf * rate
                const layW = w > 0 ? config.layupWidthFn(w) : null
                const layL = l > 0 ? l + 1 : null
                const pcs = w > 0 ? config.pcsLayupFn(w) : null

                return (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-1 text-center text-[10px] text-gray-400 w-6">{idx + 1}</td>
                    <td className="px-[5px] py-1 w-[82px]">
                      <input type="number" step="0.01" className={inputCls}
                        value={row.width} onChange={(e) => updateRow(idx, 'width', e.target.value)} placeholder="—" />
                    </td>
                    <td className="px-[5px] py-1 w-[82px]">
                      <input type="number" step="0.01" className={inputCls}
                        value={row.length} onChange={(e) => updateRow(idx, 'length', e.target.value)} placeholder="—" />
                    </td>
                    <OutCell value={bf > 0 ? bf : null} decimals={4} />
                    <OutCell value={cost > 0 ? cost : null} decimals={2} highlight />
                    <OutCell value={w > 0 ? layW : null} decimals={4} checkWidth={w > 0 && layW === null} />
                    <OutCell value={layL} decimals={1} />
                    <OutCell value={w > 0 ? pcs : null} decimals={0} checkWidth={w > 0 && pcs === null} />
                    <td className="px-0.5 py-1">
                      <div className="flex items-center">
                        <button onClick={() => duplicateRow(idx)} className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors" title="Duplicate row">
                          <CopyPlus size={12} />
                        </button>
                        <button onClick={() => removeRow(idx)} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors" title="Remove row">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 border-t bg-gray-50">
          <button onClick={addRow} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
            <Plus size={12} /> Add Row
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== Linear Calculator =====

function LinearCalculator({ config, state, setState }: {
  config: LinearConfig; state: LinearState; setState: (fn: (prev: LinearState) => LinearState) => void
}) {
  const rate = parseFloat(state.rate) || 0
  const globalWidth = parseFloat(state.globalWidth) || 0

  function updateRow(idx: number, field: keyof LinearRow, value: string) {
    setState(prev => {
      const rows = [...prev.rows]
      rows[idx] = { ...rows[idx], [field]: value }
      return { ...prev, rows }
    })
  }

  function addRow() {
    setState(prev => ({ ...prev, rows: [...prev.rows, { length: '' }] }))
  }

  function duplicateRow(idx: number) {
    setState(prev => {
      const rows = [...prev.rows]
      rows.splice(idx + 1, 0, { ...prev.rows[idx] })
      return { ...prev, rows }
    })
  }

  function removeRow(idx: number) {
    setState(prev => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))
  }

  function updateReverseRow(idx: number, field: keyof LinearReverseRow, value: string) {
    setState(prev => {
      const reverseRows = [...prev.reverseRows]
      reverseRows[idx] = { ...reverseRows[idx], [field]: value }
      return { ...prev, reverseRows }
    })
  }

  const inputCls = "w-[72px] bg-emerald-50 border border-emerald-300 rounded px-1.5 py-0.5 text-xs text-center font-medium focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-200"
  const reverseInputCls = "w-[72px] bg-blue-50 border border-blue-300 rounded px-1.5 py-0.5 text-xs text-center font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
  const hasCope = config.copeAdder > 0

  return (
    <div className="space-y-2">
      {/* Settings row */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Width (all rows)</label>
          <input type="number" step="0.01" className="w-24 bg-emerald-50 border border-emerald-300 rounded px-2 py-1 text-sm font-medium focus:border-emerald-500 focus:outline-none"
            value={state.globalWidth} onChange={(e) => setState(prev => ({ ...prev, globalWidth: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">{config.rateLabel} Rate</label>
          <input type="number" step="0.01" className="w-24 bg-emerald-50 border border-emerald-300 rounded px-2 py-1 text-sm font-medium focus:border-emerald-500 focus:outline-none"
            value={state.rate} onChange={(e) => setState(prev => ({ ...prev, rate: e.target.value }))}
          />
        </div>
        {hasCope && (
          <div className="text-[10px] text-gray-500 bg-white border rounded px-2 py-1.5">
            Cope adder: +${config.copeAdder.toFixed(2)}/pc
            {config.centerRailAdder > 0 && <span className="ml-2">Center rail: +${config.centerRailAdder.toFixed(2)}/pc</span>}
          </div>
        )}
      </div>

      {/* Reverse $/LF */}
      <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
        <div className="px-3 py-1 bg-blue-50 border-b border-blue-200 flex items-center gap-1.5">
          <ArrowRightLeft size={12} className="text-blue-500" />
          <span className="text-[11px] font-semibold text-blue-700">Reverse {config.rateLabel}</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-center text-gray-400 w-6">#</th>
              <th className="px-[5px] py-1 text-left text-gray-500 w-[82px]">Length</th>
              <th className="px-[5px] py-1 text-left text-gray-500 w-[82px]">Price</th>
              <th className="px-1.5 py-1 text-right text-gray-500">LF</th>
              <th className="px-1.5 py-1 text-right text-blue-600 font-semibold">{config.rateLabel}</th>
            </tr>
          </thead>
          <tbody>
            {state.reverseRows.map((rr, idx) => {
              const rL = parseFloat(rr.length) || 0
              const rP = parseFloat(rr.price) || 0
              const rLf = rL > 0 ? rL / 12 : 0
              const rBase = rP - config.copeAdder
              const rRate = rLf > 0 && rBase > 0 ? rBase / rLf : 0
              return (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 text-center text-[10px] text-gray-400 w-6">{idx + 1}</td>
                  <td className="px-[5px] py-1 w-[82px]">
                    <input type="number" step="0.01" placeholder="Length" className={reverseInputCls}
                      value={rr.length} onChange={(e) => updateReverseRow(idx, 'length', e.target.value)} />
                  </td>
                  <td className="px-[5px] py-1 w-[82px]">
                    <input type="number" step="0.01" placeholder="$" className={reverseInputCls}
                      value={rr.price} onChange={(e) => updateReverseRow(idx, 'price', e.target.value)} />
                  </td>
                  <td className="px-1.5 py-1 text-right text-[11px] font-mono text-gray-500">{rLf > 0 ? rLf.toFixed(4) : '—'}</td>
                  <td className="px-1.5 py-1 text-right">
                    <span className="inline-flex items-center gap-0.5">
                      <span className="text-xs font-bold text-blue-800">{rRate > 0 ? `$${rRate.toFixed(4)}` : '—'}</span>
                      {rRate > 0 && <CopyBtn value={rRate.toFixed(4)} />}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Size Calculator Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-1.5 py-1 text-center text-gray-400 w-6">#</th>
                <th className="px-1.5 py-1 text-right text-gray-500">Width</th>
                <th className="px-[5px] py-1 text-left text-gray-500">Length</th>
                <th className="px-1.5 py-1 text-right text-gray-500">LF</th>
                <th className="px-1.5 py-1 text-right text-gray-500">BF</th>
                <th className="px-1.5 py-1 text-right text-blue-600 bg-blue-50">Cost</th>
                {hasCope && <th className="px-1.5 py-1 text-right text-blue-600 bg-blue-50">Center Rail</th>}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, idx) => {
                const l = parseFloat(row.length) || 0
                const lf = l > 0 ? l / 12 : 0
                const bf = globalWidth > 0 && l > 0 ? (globalWidth * l) / 144 : 0
                const cost = lf > 0 ? (lf * rate) + config.copeAdder : 0
                const centerRailCost = config.centerRailAdder > 0 && cost > 0 ? cost + config.centerRailAdder : 0

                return (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-1.5 py-1 text-center text-[10px] text-gray-400">{idx + 1}</td>
                    <td className="px-1.5 py-1 text-right text-gray-500 font-mono text-[11px]">{globalWidth || '—'}</td>
                    <td className="px-[5px] py-1">
                      <input type="number" step="0.01" className={inputCls}
                        value={row.length} onChange={(e) => updateRow(idx, 'length', e.target.value)} placeholder="—" />
                    </td>
                    <OutCell value={lf > 0 ? lf : null} decimals={4} />
                    <OutCell value={bf > 0 ? bf : null} decimals={6} />
                    <OutCell value={cost > 0 ? cost : null} decimals={2} highlight />
                    {hasCope && <OutCell value={centerRailCost > 0 ? centerRailCost : null} decimals={2} highlight />}
                    <td className="px-0.5 py-1">
                      <div className="flex items-center">
                        <button onClick={() => duplicateRow(idx)} className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors" title="Duplicate row">
                          <CopyPlus size={12} />
                        </button>
                        <button onClick={() => removeRow(idx)} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors" title="Remove row">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 border-t bg-gray-50">
          <button onClick={addRow} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
            <Plus size={12} /> Add Row
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== Main Page =====

// ===== Reference Pricing Types =====

interface RefCustomer { id: number; name: string }
interface RefSpecies { id: number; name: string }
interface RefPart {
  id: number; tab_id: string; part_name: string; price_per_bf: string
  customer_id: number; customer_name: string
  species_id: number; species_name: string
}

// ===== Reference Pricing Component =====

function PartReferenceList({ tabId, tabLabel }: { tabId: string; tabLabel: string }) {
  const [parts, setParts] = useState<RefPart[]>([])
  const [customers, setCustomers] = useState<RefCustomer[]>([])
  const [species, setSpecies] = useState<RefSpecies[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [showManage, setShowManage] = useState(false)

  const [newCustomer, setNewCustomer] = useState('')
  const [newSpecies, setNewSpecies] = useState('')

  const [addCustomerId, setAddCustomerId] = useState('')
  const [addSpeciesId, setAddSpeciesId] = useState('')
  const [addPartName, setAddPartName] = useState('')
  const [addPrice, setAddPrice] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPrice, setEditPrice] = useState('')

  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterSpecies, setFilterSpecies] = useState('')

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, cRes, sRes] = await Promise.all([
        fetch(`/api/lumber/cabinet/part-builder/parts?tab_id=${tabId}`),
        fetch('/api/lumber/cabinet/part-builder/customers'),
        fetch('/api/lumber/cabinet/part-builder/species'),
      ])
      if (pRes.ok) setParts(await pRes.json())
      if (cRes.ok) setCustomers(await cRes.json())
      if (sRes.ok) setSpecies(await sRes.json())
    } catch { /* fetch failed */ }
  }, [tabId])

  useEffect(() => {
    if (isOpen) fetchAll()
  }, [isOpen, fetchAll])

  async function handleAddCustomer() {
    if (!newCustomer.trim()) return
    const res = await fetch('/api/lumber/cabinet/part-builder/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCustomer.trim() }),
    })
    if (res.ok) {
      setNewCustomer('')
      const cRes = await fetch('/api/lumber/cabinet/part-builder/customers')
      if (cRes.ok) setCustomers(await cRes.json())
    }
  }

  async function handleDeleteCustomer(id: number) {
    await fetch(`/api/lumber/cabinet/part-builder/customers?id=${id}`, { method: 'DELETE' })
    fetchAll()
  }

  async function handleAddSpecies() {
    if (!newSpecies.trim()) return
    const res = await fetch('/api/lumber/cabinet/part-builder/species', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSpecies.trim() }),
    })
    if (res.ok) {
      setNewSpecies('')
      const sRes = await fetch('/api/lumber/cabinet/part-builder/species')
      if (sRes.ok) setSpecies(await sRes.json())
    }
  }

  async function handleDeleteSpecies(id: number) {
    await fetch(`/api/lumber/cabinet/part-builder/species?id=${id}`, { method: 'DELETE' })
    fetchAll()
  }

  async function handleAddPart() {
    if (!addCustomerId || !addSpeciesId || !addPartName.trim() || !addPrice) return
    const res = await fetch('/api/lumber/cabinet/part-builder/parts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tab_id: tabId, customer_id: parseInt(addCustomerId),
        species_id: parseInt(addSpeciesId), part_name: addPartName.trim(),
        price_per_bf: parseFloat(addPrice),
      }),
    })
    if (res.ok) {
      setAddPartName('')
      setAddPrice('')
      const pRes = await fetch(`/api/lumber/cabinet/part-builder/parts?tab_id=${tabId}`)
      if (pRes.ok) setParts(await pRes.json())
    }
  }

  async function handleUpdatePrice(id: number) {
    const val = parseFloat(editPrice)
    if (isNaN(val)) return
    await fetch('/api/lumber/cabinet/part-builder/parts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, price_per_bf: val }),
    })
    setEditingId(null)
    const pRes = await fetch(`/api/lumber/cabinet/part-builder/parts?tab_id=${tabId}`)
    if (pRes.ok) setParts(await pRes.json())
  }

  async function handleDeletePart(id: number) {
    await fetch(`/api/lumber/cabinet/part-builder/parts?id=${id}`, { method: 'DELETE' })
    const pRes = await fetch(`/api/lumber/cabinet/part-builder/parts?tab_id=${tabId}`)
    if (pRes.ok) setParts(await pRes.json())
  }

  const filtered = parts.filter(p => {
    if (filterCustomer && p.customer_id !== parseInt(filterCustomer)) return false
    if (filterSpecies && p.species_id !== parseInt(filterSpecies)) return false
    return true
  })

  const grouped: Record<string, RefPart[]> = {}
  for (const p of filtered) {
    if (!grouped[p.customer_name]) grouped[p.customer_name] = []
    grouped[p.customer_name].push(p)
  }

  return (
    <div className="mt-3 bg-white rounded-lg border overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="text-xs font-semibold text-gray-700">
          Reference Pricing — {tabLabel}
          {parts.length > 0 && <span className="ml-1.5 text-gray-400 font-normal">({parts.length} parts)</span>}
        </span>
        {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {isOpen && (
        <div className="p-3 space-y-3">
          {/* Manage Customers & Species */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <select className="text-xs border rounded px-2 py-1 bg-white" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
                <option value="">All Customers</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="text-xs border rounded px-2 py-1 bg-white" value={filterSpecies} onChange={(e) => setFilterSpecies(e.target.value)}>
                <option value="">All Species</option>
                {species.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={() => setShowManage(!showManage)}
              className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${showManage ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}>
              <Settings2 size={12} /> Manage
            </button>
          </div>

          {/* Management Panel */}
          {showManage && (
            <div className="bg-gray-50 rounded-lg p-3 border space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {/* Customers */}
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Customers</div>
                  <div className="flex gap-1 mb-2">
                    <input className="flex-1 text-xs border rounded px-2 py-1 focus:border-emerald-500 focus:outline-none"
                      placeholder="New customer name" value={newCustomer}
                      onChange={(e) => setNewCustomer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomer()} />
                    <button onClick={handleAddCustomer} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {customers.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-xs px-2 py-0.5 rounded hover:bg-white group">
                        <span>{c.name}</span>
                        <button onClick={() => handleDeleteCustomer(c.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all">
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {customers.length === 0 && <div className="text-[10px] text-gray-400 px-2">No customers yet</div>}
                  </div>
                </div>
                {/* Species */}
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Species</div>
                  <div className="flex gap-1 mb-2">
                    <input className="flex-1 text-xs border rounded px-2 py-1 focus:border-emerald-500 focus:outline-none"
                      placeholder="New species name" value={newSpecies}
                      onChange={(e) => setNewSpecies(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSpecies()} />
                    <button onClick={handleAddSpecies} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {species.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs px-2 py-0.5 rounded hover:bg-white group">
                        <span>{s.name}</span>
                        <button onClick={() => handleDeleteSpecies(s.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all">
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {species.length === 0 && <div className="text-[10px] text-gray-400 px-2">No species yet</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add Part Row */}
          <div className="flex gap-1.5 items-end">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-0.5">Customer</label>
              <select className="w-full text-xs border rounded px-2 py-1 bg-white" value={addCustomerId} onChange={(e) => setAddCustomerId(e.target.value)}>
                <option value="">Select...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-0.5">Part Name</label>
              <input className="w-full text-xs border rounded px-2 py-1 focus:border-emerald-500 focus:outline-none"
                placeholder="Part name" value={addPartName} onChange={(e) => setAddPartName(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-0.5">Species</label>
              <select className="w-full text-xs border rounded px-2 py-1 bg-white" value={addSpeciesId} onChange={(e) => setAddSpeciesId(e.target.value)}>
                <option value="">Select...</option>
                {species.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-[10px] text-gray-500 mb-0.5">$/BF</label>
              <input type="number" step="0.01" className="w-full text-xs border rounded px-2 py-1 focus:border-emerald-500 focus:outline-none"
                placeholder="0.00" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} />
            </div>
            <button onClick={handleAddPart}
              disabled={!addCustomerId || !addSpeciesId || !addPartName.trim() || !addPrice}
              className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              <Plus size={12} className="inline -mt-0.5" /> Add
            </button>
          </div>

          {/* Parts List */}
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-2 py-1 text-left text-gray-500">Customer</th>
                    <th className="px-2 py-1 text-left text-gray-500">Part</th>
                    <th className="px-2 py-1 text-left text-gray-500">Species</th>
                    <th className="px-2 py-1 text-right text-gray-500">$/BF</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([customerName, customerParts]) => (
                    customerParts.map((p, i) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium text-gray-700">
                          {i === 0 ? customerName : ''}
                        </td>
                        <td className="px-2 py-1">{p.part_name}</td>
                        <td className="px-2 py-1 text-gray-600">{p.species_name}</td>
                        <td className="px-2 py-1 text-right">
                          {editingId === p.id ? (
                            <input type="number" step="0.01" autoFocus
                              className="w-20 text-xs border rounded px-1.5 py-0.5 text-right focus:border-emerald-500 focus:outline-none"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              onBlur={() => handleUpdatePrice(p.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdatePrice(p.id)} />
                          ) : (
                            <button onClick={() => { setEditingId(p.id); setEditPrice(p.price_per_bf) }}
                              className="font-mono font-medium text-blue-700 hover:text-blue-900 hover:underline cursor-pointer">
                              ${parseFloat(p.price_per_bf).toFixed(4)}
                            </button>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          <button onClick={() => handleDeletePart(p.id)}
                            className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-gray-400">
              {parts.length === 0 ? 'No parts added yet for this tab' : 'No parts match the selected filters'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getDefaultPanelStates(): Record<string, PanelState> {
  const s: Record<string, PanelState> = {}
  for (const tab of TABS) {
    if (tab.type === 'panel') {
      s[tab.id] = {
        rate: tab.defaultRate,
        globalThickness: tab.defaultThickness,
        rows: makePanelRows(12),
        reverseRows: makePanelReverseRows(),
      }
    }
  }
  return s
}

function getDefaultLinearStates(): Record<string, LinearState> {
  const s: Record<string, LinearState> = {}
  for (const tab of TABS) {
    if (tab.type === 'linear') {
      s[tab.id] = {
        rate: tab.defaultRate,
        globalWidth: tab.defaultWidth,
        rows: makeLinearRows(12),
        reverseRows: makeLinearReverseRows(),
      }
    }
  }
  return s
}

function loadSavedState(): { activeTabId: string; panelStates: Record<string, PanelState>; linearStates: Record<string, LinearState> } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export default function PartBuilderPage() {
  const [activeTabId, setActiveTabId] = useState(() => {
    const saved = loadSavedState()
    return saved?.activeTabId ?? 'rp'
  })

  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>(() => {
    const saved = loadSavedState()
    if (saved?.panelStates) {
      const defaults = getDefaultPanelStates()
      for (const key of Object.keys(defaults)) {
        if (!saved.panelStates[key]) saved.panelStates[key] = defaults[key]
      }
      return saved.panelStates
    }
    return getDefaultPanelStates()
  })

  const [linearStates, setLinearStates] = useState<Record<string, LinearState>>(() => {
    const saved = loadSavedState()
    if (saved?.linearStates) {
      const defaults = getDefaultLinearStates()
      for (const key of Object.keys(defaults)) {
        if (!saved.linearStates[key]) saved.linearStates[key] = defaults[key]
      }
      return saved.linearStates
    }
    return getDefaultLinearStates()
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeTabId, panelStates, linearStates }))
    } catch { /* storage full or unavailable */ }
  }, [activeTabId, panelStates, linearStates])

  const activeTab = TABS.find(t => t.id === activeTabId)!

  function resetActiveTab() {
    const defaults = activeTab.type === 'panel' ? getDefaultPanelStates() : getDefaultLinearStates()
    if (activeTab.type === 'panel') {
      setPanelStates(prev => ({ ...prev, [activeTab.id]: defaults[activeTab.id] as PanelState }))
    } else {
      setLinearStates(prev => ({ ...prev, [activeTab.id]: defaults[activeTab.id] as LinearState }))
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Part Builder</h1>
          <p className="text-xs text-gray-500">Calculate BF, cost, and layup dimensions for new parts</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetActiveTab} className="gap-1.5 text-xs h-7">
          <RotateCcw className="h-3.5 w-3.5" /> Reset Tab
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTabId(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              tab.id === activeTabId
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border'
            }`}>
            {tab.shortLabel}
            <span className="ml-1 text-[10px] opacity-60">({tab.type === 'panel' ? 'BF' : 'LF'})</span>
          </button>
        ))}
      </div>

      {/* Active tab title */}
      <div className="text-xs font-medium text-gray-400 mb-2">{activeTab.label}</div>

      {/* Calculator */}
      {activeTab.type === 'panel' && (
        <PanelCalculator
          config={activeTab as PanelConfig}
          state={panelStates[activeTab.id]}
          setState={(fn) => setPanelStates(prev => ({ ...prev, [activeTab.id]: fn(prev[activeTab.id]) }))}
        />
      )}
      {activeTab.type === 'linear' && (
        <LinearCalculator
          config={activeTab as LinearConfig}
          state={linearStates[activeTab.id]}
          setState={(fn) => setLinearStates(prev => ({ ...prev, [activeTab.id]: fn(prev[activeTab.id]) }))}
        />
      )}

      {/* Reference Pricing */}
      <PartReferenceList tabId={activeTabId} tabLabel={activeTab.shortLabel} />
    </div>
  )
}
