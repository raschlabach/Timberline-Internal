'use client'

import { useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

export interface FreightSkid {
  id?: number
  skid_number: string
  po_number: string
  width: string
  length: string
  height: string
  weight: string
}

interface SkidEditorProps {
  skids: FreightSkid[]
  mainPo: string
  onChange: (skids: FreightSkid[]) => void
}

function emptySkid(index: number, mainPo: string): FreightSkid {
  return {
    skid_number: String(index + 1),
    po_number: mainPo,
    width: '',
    length: '',
    height: '',
    weight: '',
  }
}

export function SkidEditor({ skids, mainPo, onChange }: SkidEditorProps) {
  const tableRef = useRef<HTMLDivElement>(null)
  const pendingFocusRef = useRef<{ row: number; col: number } | null>(null)

  function updateSkid(idx: number, updates: Partial<FreightSkid>) {
    const next = [...skids]
    next[idx] = { ...next[idx], ...updates }
    onChange(next)
  }

  function addSkid() {
    onChange([...skids, emptySkid(skids.length, mainPo)])
  }

  function removeSkid(idx: number) {
    onChange(skids.filter((_, i) => i !== idx))
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
      if (nextRow < skids.length) {
        focusCell(nextRow, col)
      } else {
        pendingFocusRef.current = { row: nextRow, col }
        onChange([...skids, emptySkid(skids.length, mainPo)])
      }
    }
  }, [skids, onChange, focusCell, mainPo])

  if (pendingFocusRef.current && skids.length > pendingFocusRef.current.row) {
    const { row, col } = pendingFocusRef.current
    pendingFocusRef.current = null
    requestAnimationFrame(() => focusCell(row, col))
  }

  const inputCls = "h-8 px-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"

  return (
    <div className="bg-white rounded-lg border overflow-hidden" ref={tableRef}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-2.5 text-center text-gray-400 w-10">#</th>
              <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Skid #</th>
              <th className="px-3 py-2.5 text-left text-gray-500 font-medium">PO #</th>
              <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Width</th>
              <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Length</th>
              <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Height</th>
              <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Weight (lbs)</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {skids.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No skids yet. Click &quot;Add Skid&quot; to start.
                </td>
              </tr>
            ) : (
              skids.map((skid, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-2 text-center text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      data-row={idx} data-col={0}
                      className={inputCls + ' w-full'}
                      value={skid.skid_number}
                      onChange={(e) => updateSkid(idx, { skid_number: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 0)}
                      placeholder="1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      data-row={idx} data-col={1}
                      className={inputCls + ' w-full'}
                      value={skid.po_number}
                      onChange={(e) => updateSkid(idx, { po_number: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 1)}
                      placeholder={mainPo || 'PO #'}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.0001"
                      data-row={idx} data-col={2}
                      className={inputCls + ' w-full text-right'}
                      value={skid.width}
                      onChange={(e) => updateSkid(idx, { width: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 2)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.0001"
                      data-row={idx} data-col={3}
                      className={inputCls + ' w-full text-right'}
                      value={skid.length}
                      onChange={(e) => updateSkid(idx, { length: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 3)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.0001"
                      data-row={idx} data-col={4}
                      className={inputCls + ' w-full text-right'}
                      value={skid.height}
                      onChange={(e) => updateSkid(idx, { height: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 4)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      data-row={idx} data-col={5}
                      className={inputCls + ' w-full text-right'}
                      value={skid.weight}
                      onChange={(e) => updateSkid(idx, { weight: e.target.value })}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, 5)}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeSkid(idx)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove skid"
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
      <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={addSkid} className="gap-1.5 text-xs h-7 text-blue-600 hover:text-blue-700">
          <Plus className="h-3.5 w-3.5" /> Add Skid
        </Button>
        {skids.length > 0 && (
          <span className="text-xs text-gray-400">
            {skids.length} skid{skids.length !== 1 ? 's' : ''} &bull; Total weight: {skids.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0).toLocaleString()} lbs
          </span>
        )}
      </div>
    </div>
  )
}
