'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Plus, Trash2, RotateCcw, ArrowRightLeft } from 'lucide-react'

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
  qty: string
}

interface LinearRow {
  length: string
  qty: string
}

interface PanelMeta {
  description: string
  subItem: string
  customer: string
  specie: string
  product: string
  profile: string
  thickness: string
  itemClass: string
}

interface PanelState {
  rate: string
  globalThickness: string
  meta: PanelMeta
  rows: PanelRow[]
  reverseWidth: string
  reverseLength: string
  reversePrice: string
}

interface LinearState {
  rate: string
  globalWidth: string
  meta: PanelMeta
  rows: LinearRow[]
  reverseLength: string
  reversePrice: string
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

const EMPTY_META: PanelMeta = {
  description: '', subItem: '', customer: '', specie: '',
  product: '', profile: '', thickness: '', itemClass: '',
}

function makePanelRows(count: number): PanelRow[] {
  return Array.from({ length: count }, () => ({ width: '', length: '', qty: '' }))
}

function makeLinearRows(count: number): LinearRow[] {
  return Array.from({ length: count }, () => ({ length: '', qty: '' }))
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
    <button onClick={handleCopy} title="Copy" className={`p-1 rounded transition-colors ${
      copied ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
    }`}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

// ===== Labeled Input with Copy =====

function MetaField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-gray-500 w-20 shrink-0 text-right">{label}</label>
      <input
        className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-200"
        value={value} onChange={(e) => onChange(e.target.value)}
      />
      <CopyBtn value={value} />
    </div>
  )
}

// ===== Output Cell with Copy =====

function OutCell({ value, decimals = 4, highlight, className, checkWidth }: {
  value: number | null; decimals?: number; highlight?: boolean; className?: string; checkWidth?: boolean
}) {
  if (value === null && !checkWidth) {
    return <td className={`px-2 py-1.5 text-right text-gray-300 ${className || ''}`}>—</td>
  }
  if (value === null && checkWidth) {
    return <td className={`px-2 py-1.5 text-right text-amber-500 text-xs italic ${className || ''}`}>Check Width</td>
  }
  const display = parseFloat(value!.toFixed(decimals)).toString()
  return (
    <td className={`px-2 py-1.5 text-right whitespace-nowrap ${highlight ? 'bg-blue-50 font-medium text-blue-800' : ''} ${className || ''}`}>
      <span className="inline-flex items-center gap-1">
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
    setState(prev => ({ ...prev, rows: [...prev.rows, { width: '', length: '', qty: '' }] }))
  }

  function removeRow(idx: number) {
    setState(prev => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))
  }

  function updateMeta(field: keyof PanelMeta, value: string) {
    setState(prev => ({ ...prev, meta: { ...prev.meta, [field]: value } }))
  }

  const revW = parseFloat(state.reverseWidth) || 0
  const revL = parseFloat(state.reverseLength) || 0
  const revP = parseFloat(state.reversePrice) || 0
  const revBf = revW > 0 && revL > 0 ? ((revW * revL) / 144) * config.bfMultiplier : 0
  const revRate = revBf > 0 && revP > 0 ? revP / revBf : 0

  return (
    <div className="space-y-4">
      {/* Settings row */}
      <div className="bg-gray-50 rounded-lg p-4 flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Thickness</label>
          <input type="number" step="0.001" className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            value={state.globalThickness}
            onChange={(e) => setState(prev => ({ ...prev, globalThickness: e.target.value, meta: { ...prev.meta, thickness: e.target.value } }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">$/BF Rate</label>
          <input type="number" step="0.01" className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            value={state.rate} onChange={(e) => setState(prev => ({ ...prev, rate: e.target.value }))}
          />
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div className="bg-white border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-3">
            <ArrowRightLeft size={14} className="text-blue-500" />
            <span className="text-xs font-medium text-blue-600">Reverse $/BF:</span>
            <input type="number" step="0.01" placeholder="W" className="w-16 border rounded px-1.5 py-1 text-xs text-center"
              value={state.reverseWidth} onChange={(e) => setState(prev => ({ ...prev, reverseWidth: e.target.value }))} />
            <span className="text-gray-400">×</span>
            <input type="number" step="0.01" placeholder="L" className="w-16 border rounded px-1.5 py-1 text-xs text-center"
              value={state.reverseLength} onChange={(e) => setState(prev => ({ ...prev, reverseLength: e.target.value }))} />
            <span className="text-gray-400">@</span>
            <input type="number" step="0.01" placeholder="Price" className="w-20 border rounded px-1.5 py-1 text-xs text-center"
              value={state.reversePrice} onChange={(e) => setState(prev => ({ ...prev, reversePrice: e.target.value }))} />
            <span className="text-sm font-bold text-blue-800">
              {revRate > 0 ? `$${revRate.toFixed(4)}/BF` : '—'}
            </span>
            {revRate > 0 && <CopyBtn value={revRate.toFixed(4)} />}
          </div>
        </div>
      </div>

      {/* QB Metadata */}
      <div className="bg-white rounded-lg border p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">QuickBooks Fields</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <MetaField label="Description" value={state.meta.description} onChange={(v) => updateMeta('description', v)} />
          <MetaField label="Sub Item" value={state.meta.subItem} onChange={(v) => updateMeta('subItem', v)} />
          <MetaField label="Customer" value={state.meta.customer} onChange={(v) => updateMeta('customer', v)} />
          <MetaField label="Specie" value={state.meta.specie} onChange={(v) => updateMeta('specie', v)} />
          <MetaField label="Product" value={state.meta.product} onChange={(v) => updateMeta('product', v)} />
          <MetaField label="Profile" value={state.meta.profile} onChange={(v) => updateMeta('profile', v)} />
          <MetaField label="Thickness" value={state.meta.thickness} onChange={(v) => updateMeta('thickness', v)} />
          <MetaField label="Item Class" value={state.meta.itemClass} onChange={(v) => updateMeta('itemClass', v)} />
        </div>
      </div>

      {/* Size Calculator Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs">
                <th className="px-2 py-2 text-center text-gray-400 w-8">#</th>
                <th className="px-2 py-2 text-left text-gray-600">{config.widthLabel}</th>
                <th className="px-2 py-2 text-left text-gray-600">{config.lengthLabel}</th>
                <th className="px-2 py-2 text-right text-gray-600">BF</th>
                <th className="px-2 py-2 text-right text-blue-600 bg-blue-50">Cost</th>
                <th className="px-2 py-2 text-right text-gray-600">Layup W</th>
                <th className="px-2 py-2 text-right text-gray-600">Layup L</th>
                <th className="px-2 py-2 text-right text-gray-600">PCS</th>
                <th className="px-2 py-2 text-left text-gray-600">Qty</th>
                <th className="px-2 py-2 text-right text-gray-600">Total BF</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, idx) => {
                const w = parseFloat(row.width) || 0
                const l = parseFloat(row.length) || 0
                const qty = parseFloat(row.qty) || 0
                const bf = w > 0 && l > 0 ? ((w * l) / 144) * config.bfMultiplier : 0
                const cost = bf * rate
                const layW = w > 0 ? config.layupWidthFn(w) : null
                const layL = l > 0 ? l + 1 : null
                const pcs = w > 0 ? config.pcsLayupFn(w) : null
                const totalBf = bf * qty

                return (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-center text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.01" className="w-20 border rounded px-1.5 py-1 text-sm text-center focus:border-emerald-500 focus:outline-none"
                        value={row.width} onChange={(e) => updateRow(idx, 'width', e.target.value)} placeholder="—" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.01" className="w-20 border rounded px-1.5 py-1 text-sm text-center focus:border-emerald-500 focus:outline-none"
                        value={row.length} onChange={(e) => updateRow(idx, 'length', e.target.value)} placeholder="—" />
                    </td>
                    <OutCell value={bf > 0 ? bf : null} decimals={4} />
                    <OutCell value={cost > 0 ? cost : null} decimals={2} highlight />
                    <OutCell value={w > 0 ? layW : null} decimals={4} checkWidth={w > 0 && layW === null} />
                    <OutCell value={layL} decimals={1} />
                    <OutCell value={w > 0 ? pcs : null} decimals={0} checkWidth={w > 0 && pcs === null} />
                    <td className="px-1 py-1">
                      <input type="number" step="1" className="w-16 border rounded px-1.5 py-1 text-sm text-center focus:border-emerald-500 focus:outline-none"
                        value={row.qty} onChange={(e) => updateRow(idx, 'qty', e.target.value)} placeholder="—" />
                    </td>
                    <OutCell value={totalBf > 0 ? totalBf : null} decimals={4} />
                    <td className="px-1 py-1">
                      <button onClick={() => removeRow(idx)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t bg-gray-50">
          <button onClick={addRow} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
            <Plus size={14} /> Add Row
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
    setState(prev => ({ ...prev, rows: [...prev.rows, { length: '', qty: '' }] }))
  }

  function removeRow(idx: number) {
    setState(prev => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))
  }

  function updateMeta(field: keyof PanelMeta, value: string) {
    setState(prev => ({ ...prev, meta: { ...prev.meta, [field]: value } }))
  }

  const revL = parseFloat(state.reverseLength) || 0
  const revP = parseFloat(state.reversePrice) || 0
  const revLf = revL > 0 ? revL / 12 : 0
  const basePrice = revP - config.copeAdder
  const revRate = revLf > 0 && basePrice > 0 ? basePrice / revLf : 0

  const hasCope = config.copeAdder > 0

  return (
    <div className="space-y-4">
      {/* Settings row */}
      <div className="bg-gray-50 rounded-lg p-4 flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Width (all rows)</label>
          <input type="number" step="0.01" className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            value={state.globalWidth} onChange={(e) => setState(prev => ({ ...prev, globalWidth: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{config.rateLabel} Rate</label>
          <input type="number" step="0.01" className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            value={state.rate} onChange={(e) => setState(prev => ({ ...prev, rate: e.target.value }))}
          />
        </div>
        {hasCope && (
          <div className="text-xs text-gray-500 bg-white border rounded px-3 py-2">
            Cope adder: +${config.copeAdder.toFixed(2)}/pc
            {config.centerRailAdder > 0 && <span className="ml-3">Center rail: +${config.centerRailAdder.toFixed(2)}/pc</span>}
          </div>
        )}
        <div className="ml-auto flex items-end gap-2">
          <div className="bg-white border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-3">
            <ArrowRightLeft size={14} className="text-blue-500" />
            <span className="text-xs font-medium text-blue-600">Reverse {config.rateLabel}:</span>
            <input type="number" step="0.01" placeholder="Length" className="w-20 border rounded px-1.5 py-1 text-xs text-center"
              value={state.reverseLength} onChange={(e) => setState(prev => ({ ...prev, reverseLength: e.target.value }))} />
            <span className="text-gray-400">@</span>
            <input type="number" step="0.01" placeholder="Price" className="w-20 border rounded px-1.5 py-1 text-xs text-center"
              value={state.reversePrice} onChange={(e) => setState(prev => ({ ...prev, reversePrice: e.target.value }))} />
            <span className="text-sm font-bold text-blue-800">
              {revRate > 0 ? `$${revRate.toFixed(4)}${config.rateLabel}` : '—'}
            </span>
            {revRate > 0 && <CopyBtn value={revRate.toFixed(4)} />}
          </div>
        </div>
      </div>

      {/* QB Metadata */}
      <div className="bg-white rounded-lg border p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">QuickBooks Fields</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <MetaField label="Description" value={state.meta.description} onChange={(v) => updateMeta('description', v)} />
          <MetaField label="Sub Item" value={state.meta.subItem} onChange={(v) => updateMeta('subItem', v)} />
          <MetaField label="Customer" value={state.meta.customer} onChange={(v) => updateMeta('customer', v)} />
          <MetaField label="Specie" value={state.meta.specie} onChange={(v) => updateMeta('specie', v)} />
          <MetaField label="Product" value={state.meta.product} onChange={(v) => updateMeta('product', v)} />
          <MetaField label="Profile" value={state.meta.profile} onChange={(v) => updateMeta('profile', v)} />
          <MetaField label="Thickness" value={state.meta.thickness} onChange={(v) => updateMeta('thickness', v)} />
          <MetaField label="Item Class" value={state.meta.itemClass} onChange={(v) => updateMeta('itemClass', v)} />
        </div>
      </div>

      {/* Size Calculator Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs">
                <th className="px-2 py-2 text-center text-gray-400 w-8">#</th>
                <th className="px-2 py-2 text-right text-gray-600">Width</th>
                <th className="px-2 py-2 text-left text-gray-600">Length</th>
                <th className="px-2 py-2 text-right text-gray-600">LF</th>
                <th className="px-2 py-2 text-right text-gray-600">BF</th>
                <th className="px-2 py-2 text-right text-blue-600 bg-blue-50">Cost</th>
                {hasCope && <th className="px-2 py-2 text-right text-blue-600 bg-blue-50">Center Rail</th>}
                <th className="px-2 py-2 text-left text-gray-600">Qty</th>
                <th className="px-2 py-2 text-right text-gray-600">Total BF</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, idx) => {
                const l = parseFloat(row.length) || 0
                const qty = parseFloat(row.qty) || 0
                const lf = l > 0 ? l / 12 : 0
                const bf = globalWidth > 0 && l > 0 ? (globalWidth * l) / 144 : 0
                const cost = lf > 0 ? (lf * rate) + config.copeAdder : 0
                const centerRailCost = config.centerRailAdder > 0 && cost > 0 ? cost + config.centerRailAdder : 0
                const totalBf = bf * qty

                return (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-center text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1.5 text-right text-gray-500 font-mono text-xs">{globalWidth || '—'}</td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.01" className="w-20 border rounded px-1.5 py-1 text-sm text-center focus:border-emerald-500 focus:outline-none"
                        value={row.length} onChange={(e) => updateRow(idx, 'length', e.target.value)} placeholder="—" />
                    </td>
                    <OutCell value={lf > 0 ? lf : null} decimals={4} />
                    <OutCell value={bf > 0 ? bf : null} decimals={6} />
                    <OutCell value={cost > 0 ? cost : null} decimals={2} highlight />
                    {hasCope && <OutCell value={centerRailCost > 0 ? centerRailCost : null} decimals={2} highlight />}
                    <td className="px-1 py-1">
                      <input type="number" step="1" className="w-16 border rounded px-1.5 py-1 text-sm text-center focus:border-emerald-500 focus:outline-none"
                        value={row.qty} onChange={(e) => updateRow(idx, 'qty', e.target.value)} placeholder="—" />
                    </td>
                    <OutCell value={totalBf > 0 ? totalBf : null} decimals={6} />
                    <td className="px-1 py-1">
                      <button onClick={() => removeRow(idx)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t bg-gray-50">
          <button onClick={addRow} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
            <Plus size={14} /> Add Row
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== Main Page =====

export default function PartBuilderPage() {
  const [activeTabId, setActiveTabId] = useState('rp')

  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>(() => {
    const s: Record<string, PanelState> = {}
    for (const tab of TABS) {
      if (tab.type === 'panel') {
        s[tab.id] = {
          rate: tab.defaultRate,
          globalThickness: tab.defaultThickness,
          meta: { ...EMPTY_META, thickness: tab.defaultThickness },
          rows: makePanelRows(12),
          reverseWidth: '', reverseLength: '', reversePrice: '',
        }
      }
    }
    return s
  })

  const [linearStates, setLinearStates] = useState<Record<string, LinearState>>(() => {
    const s: Record<string, LinearState> = {}
    for (const tab of TABS) {
      if (tab.type === 'linear') {
        s[tab.id] = {
          rate: tab.defaultRate,
          globalWidth: tab.defaultWidth,
          meta: { ...EMPTY_META },
          rows: makeLinearRows(12),
          reverseLength: '', reversePrice: '',
        }
      }
    }
    return s
  })

  const activeTab = TABS.find(t => t.id === activeTabId)!

  function resetActiveTab() {
    if (activeTab.type === 'panel') {
      const cfg = activeTab as PanelConfig
      setPanelStates(prev => ({
        ...prev,
        [cfg.id]: {
          rate: cfg.defaultRate, globalThickness: cfg.defaultThickness,
          meta: { ...EMPTY_META, thickness: cfg.defaultThickness },
          rows: makePanelRows(12), reverseWidth: '', reverseLength: '', reversePrice: '',
        },
      }))
    } else {
      const cfg = activeTab as LinearConfig
      setLinearStates(prev => ({
        ...prev,
        [cfg.id]: {
          rate: cfg.defaultRate, globalWidth: cfg.defaultWidth,
          meta: { ...EMPTY_META },
          rows: makeLinearRows(12), reverseLength: '', reversePrice: '',
        },
      }))
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Part Builder</h1>
          <p className="text-sm text-gray-500 mt-1">Calculate BF, cost, and layup dimensions for new parts</p>
        </div>
        <Button variant="outline" onClick={resetActiveTab} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Reset Tab
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTabId(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              tab.id === activeTabId
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border'
            }`}>
            {tab.shortLabel}
            <span className="ml-1 text-xs opacity-60">({tab.type === 'panel' ? 'BF' : 'LF'})</span>
          </button>
        ))}
      </div>

      {/* Active tab title */}
      <div className="text-sm font-medium text-gray-400 mb-3">{activeTab.label}</div>

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
    </div>
  )
}
