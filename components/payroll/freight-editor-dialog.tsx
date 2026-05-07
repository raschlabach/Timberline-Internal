'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { DimensionEntry } from '@/lib/driver-pay/types'

// Editor row state mirrors DimensionEntry but stores values as strings so
// the user can clear / retype freely without the input snapping to 0.
interface DraftRow {
  id: string
  width: string
  length: string
  quantity: string
}

interface FreightEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: number
  orderLabel: string
  initialSkids: DimensionEntry[]
  initialVinyl: DimensionEntry[]
  // Called after a successful save with the persisted dimension arrays
  // and the new total footage. Caller is responsible for patching its
  // local state for every assignment that points at this order.
  onSaved: (result: {
    skidsData: DimensionEntry[]
    vinylData: DimensionEntry[]
    footage: number
  }) => void
}

export function FreightEditorDialog({
  open,
  onOpenChange,
  orderId,
  orderLabel,
  initialSkids,
  initialVinyl,
  onSaved,
}: FreightEditorDialogProps) {
  const [skidRows, setSkidRows] = useState<DraftRow[]>([])
  const [vinylRows, setVinylRows] = useState<DraftRow[]>([])
  const [saving, setSaving] = useState(false)

  // Re-seed local state every time the dialog opens so re-opening shows
  // the latest persisted values rather than the user's previous draft.
  useEffect(() => {
    if (!open) return
    setSkidRows(toDraftRows(initialSkids))
    setVinylRows(toDraftRows(initialVinyl))
  }, [open, initialSkids, initialVinyl])

  const skidFootage = useMemo(() => sumFootage(skidRows), [skidRows])
  const vinylFootage = useMemo(() => sumFootage(vinylRows), [vinylRows])
  const totalFootage = skidFootage + vinylFootage

  function updateSkid(id: string, patch: Partial<DraftRow>) {
    setSkidRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function updateVinyl(id: string, patch: Partial<DraftRow>) {
    setVinylRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function removeSkid(id: string) {
    setSkidRows((rows) => rows.filter((r) => r.id !== id))
  }
  function removeVinyl(id: string) {
    setVinylRows((rows) => rows.filter((r) => r.id !== id))
  }
  function addSkid() {
    setSkidRows((rows) => [...rows, blankDraftRow()])
  }
  function addVinyl() {
    setVinylRows((rows) => [...rows, blankDraftRow()])
  }

  async function handleSave() {
    const skidsData = draftRowsToDimensions(skidRows)
    const vinylData = draftRowsToDimensions(vinylRows)

    if (skidsData === null || vinylData === null) {
      toast.error('Each row needs a positive width, length, and quantity.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/skids`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skidsData, vinylData }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save')
      }

      onSaved({
        skidsData: data.skidsData ?? skidsData,
        vinylData: data.vinylData ?? vinylData,
        footage:
          typeof data.footage === 'number'
            ? data.footage
            : skidFootage + vinylFootage,
      })
      toast.success('Freight updated')
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving freight:', error)
      toast.error('Failed to save freight changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit freight</DialogTitle>
          <DialogDescription>{orderLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <DimensionSection
            title="Skids"
            rows={skidRows}
            footage={skidFootage}
            onUpdate={updateSkid}
            onRemove={removeSkid}
            onAdd={addSkid}
            emptyLabel="No skids on this order"
          />
          <DimensionSection
            title="Vinyl"
            rows={vinylRows}
            footage={vinylFootage}
            onUpdate={updateVinyl}
            onRemove={removeVinyl}
            onAdd={addVinyl}
            emptyLabel="No vinyl on this order"
          />

          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="text-sm font-semibold text-gray-700">
              Total footage
            </span>
            <span className="text-base font-bold text-gray-900">
              {totalFootage.toFixed(0)} ft²
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DimensionSectionProps {
  title: string
  rows: DraftRow[]
  footage: number
  onUpdate: (id: string, patch: Partial<DraftRow>) => void
  onRemove: (id: string) => void
  onAdd: () => void
  emptyLabel: string
}

function DimensionSection({
  title,
  rows,
  footage,
  onUpdate,
  onRemove,
  onAdd,
  emptyLabel,
}: DimensionSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        <span className="text-xs text-gray-500">
          {footage.toFixed(0)} ft²
        </span>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs italic text-gray-400 px-1">{emptyLabel}</p>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              <span>Quantity</span>
              <span>Width</span>
              <span>Length</span>
              <span aria-hidden />
            </div>
            {rows.map((row) => (
              <DimensionRowInputs
                key={row.id}
                row={row}
                onUpdate={(patch) => onUpdate(row.id, patch)}
                onRemove={() => onRemove(row.id)}
              />
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add {title.toLowerCase().replace(/s$/, '')} row
        </Button>
      </div>
    </section>
  )
}

interface DimensionRowInputsProps {
  row: DraftRow
  onUpdate: (patch: Partial<DraftRow>) => void
  onRemove: () => void
}

function DimensionRowInputs({ row, onUpdate, onRemove }: DimensionRowInputsProps) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={row.quantity}
        onChange={(e) => onUpdate({ quantity: e.target.value })}
        placeholder="qty"
        className="h-8 text-sm"
      />
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={row.width}
        onChange={(e) => onUpdate({ width: e.target.value })}
        placeholder="width"
        className="h-8 text-sm"
      />
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={row.length}
        onChange={(e) => onUpdate({ length: e.target.value })}
        placeholder="length"
        className="h-8 text-sm"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        title="Remove row"
        className="h-8 w-8 text-gray-500 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

let draftRowSeq = 0
function nextRowId() {
  draftRowSeq += 1
  return `row-${draftRowSeq}`
}

function blankDraftRow(): DraftRow {
  return { id: nextRowId(), width: '', length: '', quantity: '1' }
}

function toDraftRows(entries: DimensionEntry[]): DraftRow[] {
  return entries.map((e) => ({
    id: nextRowId(),
    width: String(e.width ?? ''),
    length: String(e.length ?? ''),
    quantity: String(e.quantity ?? ''),
  }))
}

function sumFootage(rows: DraftRow[]): number {
  let total = 0
  for (const row of rows) {
    const w = parseFloat(row.width)
    const l = parseFloat(row.length)
    const q = parseFloat(row.quantity)
    if (!Number.isFinite(w) || !Number.isFinite(l) || !Number.isFinite(q)) continue
    total += w * l * q
  }
  return total
}

// Returns null when any row has invalid (non-numeric or negative) values.
function draftRowsToDimensions(rows: DraftRow[]): DimensionEntry[] | null {
  const out: DimensionEntry[] = []
  for (const row of rows) {
    const q = parseFloat(row.quantity)
    if (!Number.isFinite(q) || q <= 0) {
      // Treat blank/zero quantity rows as "drop me" rather than invalid
      // so users can leave a half-finished row behind without blocking
      // save. But if they put a quantity but no dimensions, that's a
      // real validation error.
      if (row.width.trim() === '' && row.length.trim() === '') continue
      if (Number.isFinite(q) && q === 0) continue
      return null
    }
    const w = parseFloat(row.width)
    const l = parseFloat(row.length)
    if (!Number.isFinite(w) || w <= 0) return null
    if (!Number.isFinite(l) || l <= 0) return null
    out.push({ width: w, length: l, quantity: q })
  }
  return out
}
