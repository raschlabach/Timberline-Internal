'use client'

import React, { useState } from 'react'
import { CornerDownRight, Split } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/driver-pay/calculations'
import type { PayrollAdjustment } from '@/lib/driver-pay/types'
import { AdjustmentEditor, SaveAdjustmentInput } from './adjustment-editor'

interface AdjustmentRowProps {
  truckloadId: number
  adjustment: PayrollAdjustment
  attachedTo: string
  // Visual indent — true when nested under an order row.
  indented: boolean
  onUpdated: (updated: PayrollAdjustment) => void
  onDeleted: (adjustmentId: number) => void
}

export function AdjustmentRow({
  truckloadId,
  adjustment,
  attachedTo,
  indented,
  onUpdated,
  onDeleted,
}: AdjustmentRowProps) {
  const [open, setOpen] = useState(false)

  // Split-load entries are non-editable from this row (they pair across two
  // truckloads — managed via the Split Load dialog instead). Manual,
  // non-split adjustments are freely editable here.
  const isSplitLoad = adjustment.splitLoadId !== null
  const isManualEditable = adjustment.isManual && !isSplitLoad

  const sign = adjustment.isAddition ? '+' : '−'
  const colorClass = adjustment.isAddition ? 'text-green-700' : 'text-red-700'
  const appliesToLabel =
    adjustment.appliesTo === 'load_value' ? 'Load Value' : 'Driver Pay'
  const description = adjustment.comment?.trim() || '(no description)'

  async function handleSave(input: SaveAdjustmentInput) {
    try {
      const response = await fetch(
        `/api/truckloads/${truckloadId}/adjustments/${adjustment.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(input),
        }
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to update')
      onUpdated({
        ...adjustment,
        ...input,
        comment: input.comment,
      })
      toast.success('Adjustment updated')
    } catch (error) {
      console.error('Error updating adjustment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update')
      throw error
    }
  }

  async function handleDelete() {
    try {
      const response = await fetch(
        `/api/truckloads/${truckloadId}/adjustments/${adjustment.id}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to delete')
      onDeleted(adjustment.id)
      toast.success('Adjustment deleted')
    } catch (error) {
      console.error('Error deleting adjustment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete')
      throw error
    }
  }

  const cellPad = 'px-1.5 py-0.5'
  const cornerCellPad = `${cellPad} ${indented ? 'pl-6' : ''}`

  // Split-load entries get a yellow tint and the split icon to stand out.
  const rowClass = isSplitLoad ? 'bg-amber-100/70 text-[11px]' : 'text-[11px]'
  const iconCellExtra = isSplitLoad ? 'text-amber-700' : 'text-gray-400'

  if (!isManualEditable) {
    // Non-editable (e.g. split-load entries). Display with distinctive
    // yellow shading and the split icon so the user sees at a glance what
    // it is.
    return (
      <tr className={rowClass}>
        <td className={`${cornerCellPad} ${iconCellExtra}`}>
          {isSplitLoad ? (
            <Split className="h-3.5 w-3.5" />
          ) : (
            <CornerDownRight className="h-3 w-3" />
          )}
        </td>
        <td className={`${cellPad} text-gray-700`}>
          {isSplitLoad ? renderSplitDescription(description) : description}
        </td>
        <td className={`${cellPad} text-[10px] text-gray-500 whitespace-nowrap`}>
          {appliesToLabel}
        </td>
        <td
          className={`${cellPad} font-semibold whitespace-nowrap text-right ${colorClass}`}
        >
          {sign}
          {formatCurrency(adjustment.amount)}
        </td>
      </tr>
    )
  }

  return (
    <AdjustmentEditor
      existing={adjustment}
      open={open}
      onOpenChange={setOpen}
      attachedTo={attachedTo}
      onSave={handleSave}
      onDelete={handleDelete}
    >
      <tr
        className="cursor-pointer hover:bg-black/5 text-[11px]"
        title="Click to edit adjustment"
      >
        <td className={`${cornerCellPad} text-gray-500`}>
          <CornerDownRight className="h-3 w-3" />
        </td>
        <td className={`${cellPad} text-gray-700`}>{description}</td>
        <td className={`${cellPad} text-[10px] text-gray-500 whitespace-nowrap`}>
          {appliesToLabel}
        </td>
        <td
          className={`${cellPad} font-semibold whitespace-nowrap text-right ${colorClass}`}
        >
          {sign}
          {formatCurrency(adjustment.amount)}
        </td>
      </tr>
    </AdjustmentEditor>
  )
}

// "*Split Load* {rest}" → renders the leading marker as a yellow pill so the
// reason is obvious at a glance.
function renderSplitDescription(description: string): React.ReactNode {
  const marker = '*Split Load*'
  if (!description.startsWith(marker)) {
    return description
  }
  const rest = description.slice(marker.length).trim()
  return (
    <>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mr-1.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold uppercase tracking-wide">
        Split Load
      </span>
      <span>{rest}</span>
    </>
  )
}
