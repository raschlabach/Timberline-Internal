'use client'

import { useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { ItemCodeSelector } from './item-code-selector'

interface ArchboldPart {
  id: number
  item_code: string
  width: number | null
  length: number | null
  used_for: string | null
}

export interface ReportLineItem {
  id?: number
  pallet_number: string
  pallet_tag: string
  archbold_part_id: number | null
  item_code?: string
  part_width?: number | null
  part_length?: number | null
  used_for?: string | null
  qty_per_skid: string
  skid_width: string
  skid_length: string
  skid_height: string
  skid_weight: string
}

interface ReportEditorProps {
  items: ReportLineItem[]
  parts: ArchboldPart[]
  archboldPo: string
  onChange: (items: ReportLineItem[]) => void
}

function emptyItem(): ReportLineItem {
  return {
    pallet_number: '',
    pallet_tag: '',
    archbold_part_id: null,
    qty_per_skid: '',
    skid_width: '',
    skid_length: '',
    skid_height: '',
    skid_weight: '',
  }
}

export function ReportEditor({ items, parts, archboldPo, onChange }: ReportEditorProps) {
  const tableRef = useRef<HTMLDivElement>(null)
  const pendingFocusRef = useRef<{ row: number; col: number } | null>(null)

  function updateItem(idx: number, updates: Partial<ReportLineItem>) {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], ...updates }
    onChange(newItems)
  }

  function addItem() {
    onChange([...items, emptyItem()])
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function handlePartSelect(idx: number, part: ArchboldPart | null) {
    if (part) {
      updateItem(idx, {
        archbold_part_id: part.id,
        item_code: part.item_code,
        part_width: part.width,
        part_length: part.length,
        used_for: part.used_for,
      })
    } else {
      updateItem(idx, {
        archbold_part_id: null,
        item_code: undefined,
        part_width: null,
        part_length: null,
        used_for: null,
      })
    }
  }

  const focusCell = useCallback((row: number, col: number) => {
    if (!tableRef.current) return
    const target = tableRef.current.querySelector<HTMLInputElement>(
      `input[data-row="${row}"][data-col="${col}"]`
    )
    if (target) {
      target.focus()
      target.select()
    }
  }, [])

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextRow = row + 1
      if (nextRow < items.length) {
        focusCell(nextRow, col)
      } else {
        pendingFocusRef.current = { row: nextRow, col }
        onChange([...items, emptyItem()])
      }
    }
  }, [items, onChange, focusCell])

  // After render, check if we need to focus a cell in a newly added row
  if (pendingFocusRef.current && items.length > pendingFocusRef.current.row) {
    const { row, col } = pendingFocusRef.current
    pendingFocusRef.current = null
    requestAnimationFrame(() => focusCell(row, col))
  }

  function handlePalletTagFocus(idx: number) {
    if (!items[idx].pallet_tag && archboldPo) {
      updateItem(idx, { pallet_tag: archboldPo + '-' })
    }
  }

  const inputCls = "h-8 px-2 text-xs border border-gray-300 rounded focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
  const readonlyCls = "h-8 px-2 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600"
  const poPrefix = archboldPo ? archboldPo + '-' : ''

  return (
    <div className="bg-white rounded-lg border overflow-hidden" ref={tableRef}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-1.5 py-2 text-center text-gray-400 w-8">#</th>
              <th className="px-1.5 py-2 text-left text-gray-500 font-medium w-20">Pallet #</th>
              <th className="px-1.5 py-2 text-left text-gray-500 font-medium w-32">Pallet Tag</th>
              <th className="px-1.5 py-2 text-left text-gray-500 font-medium w-36">Item Code</th>
              <th className="px-1.5 py-2 text-right text-gray-500 font-medium w-20">Qty/Skid</th>
              <th className="px-1.5 py-2 text-right text-gray-500 font-medium w-20">Width</th>
              <th className="px-1.5 py-2 text-right text-gray-500 font-medium w-20">Length</th>
              <th className="px-1.5 py-2 text-left text-gray-500 font-medium w-28">Used For</th>
              <th className="px-1.5 py-2 text-right text-gray-500 font-medium w-20">Skid W</th>
              <th className="px-1.5 py-2 text-right text-gray-500 font-medium w-20">Skid L</th>
              <th className="px-1.5 py-2 text-right text-gray-500 font-medium w-20">Skid H</th>
              <th className="px-1.5 py-2 text-right text-gray-500 font-medium w-22">Skid Wt</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                  No items yet. Click "Add Row" to start.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-1.5 py-1.5 text-center text-gray-400">{idx + 1}</td>
                  <td className="px-1.5 py-1.5">
                    <input
                      type="text"
                      data-row={idx} data-col={0}
                      className={inputCls + ' w-full'}
                      value={item.pallet_number}
                      onChange={(e) => updateItem(idx, { pallet_number: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 0)}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <div className="relative flex items-center">
                      {poPrefix && !item.pallet_tag && (
                        <span className="absolute left-2 text-xs text-gray-300 pointer-events-none">
                          {poPrefix}...
                        </span>
                      )}
                      <input
                        type="text"
                        data-row={idx} data-col={1}
                        className={inputCls + ' w-full'}
                        value={item.pallet_tag}
                        onChange={(e) => updateItem(idx, { pallet_tag: e.target.value })}
                        onFocus={() => handlePalletTagFocus(idx)}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, 1)}
                      />
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <ItemCodeSelector
                      parts={parts}
                      selectedPartId={item.archbold_part_id}
                      onSelect={(part) => handlePartSelect(idx, part)}
                      dataRow={idx}
                      dataCol={2}
                      onEnterKey={() => {
                        const nextRow = idx + 1
                        if (nextRow < items.length) {
                          focusCell(nextRow, 2)
                        } else {
                          pendingFocusRef.current = { row: nextRow, col: 2 }
                          onChange([...items, emptyItem()])
                        }
                      }}
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      type="number"
                      data-row={idx} data-col={3}
                      className={inputCls + ' w-full text-right'}
                      value={item.qty_per_skid}
                      onChange={(e) => updateItem(idx, { qty_per_skid: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 3)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <div className={readonlyCls + ' w-full flex items-center justify-end'}>
                      {item.part_width ?? '—'}
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <div className={readonlyCls + ' w-full flex items-center justify-end'}>
                      {item.part_length ?? '—'}
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <div className={readonlyCls + ' w-full flex items-center truncate'}>
                      {item.used_for || '—'}
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      type="number"
                      step="0.0001"
                      data-row={idx} data-col={4}
                      className={inputCls + ' w-full text-right'}
                      value={item.skid_width}
                      onChange={(e) => updateItem(idx, { skid_width: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 4)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      type="number"
                      step="0.0001"
                      data-row={idx} data-col={5}
                      className={inputCls + ' w-full text-right'}
                      value={item.skid_length}
                      onChange={(e) => updateItem(idx, { skid_length: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 5)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      type="number"
                      step="0.0001"
                      data-row={idx} data-col={6}
                      className={inputCls + ' w-full text-right'}
                      value={item.skid_height}
                      onChange={(e) => updateItem(idx, { skid_height: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 6)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      data-row={idx} data-col={7}
                      className={inputCls + ' w-full text-right'}
                      value={item.skid_weight}
                      onChange={(e) => updateItem(idx, { skid_weight: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 7)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t bg-gray-50">
        <Button variant="ghost" size="sm" onClick={addItem} className="gap-1.5 text-xs h-7 text-blue-600 hover:text-blue-700">
          <Plus className="h-3.5 w-3.5" /> Add Row
        </Button>
      </div>
    </div>
  )
}
