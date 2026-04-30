'use client'

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { PayrollAdjustment } from '@/lib/driver-pay/types'
import { AdjustmentEditor, SaveAdjustmentInput } from './adjustment-editor'

interface AddAdjustmentButtonProps {
  truckloadId: number
  // Order this adjustment is attached to. null for load-level.
  orderId: number | null
  attachedTo: string
  // Visual style: subtle (sub-row) or full button (load-level section).
  variant?: 'inline' | 'standalone'
  // Optional metadata for cross-driver deductions.
  action?: 'Picked up' | 'Delivered' | null
  onAdded: (adjustment: PayrollAdjustment) => void
}

export function AddAdjustmentButton({
  truckloadId,
  orderId,
  attachedTo,
  variant = 'inline',
  action = null,
  onAdded,
}: AddAdjustmentButtonProps) {
  const [open, setOpen] = useState(false)

  async function handleSave(input: SaveAdjustmentInput) {
    try {
      const response = await fetch(
        `/api/truckloads/${truckloadId}/adjustments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            orderId,
            action,
            ...input,
          }),
        }
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to add')

      // Build a PayrollAdjustment shape for the parent to splice in.
      const created: PayrollAdjustment = {
        id: data.adjustment.id,
        orderId: data.adjustment.orderId ?? null,
        splitLoadId: null,
        driverName: null,
        date: data.adjustment.date,
        action: data.adjustment.action ?? null,
        footage: 0,
        dimensions: null,
        amount: data.adjustment.amount,
        isManual: true,
        isAddition: data.adjustment.isAddition,
        appliesTo: data.adjustment.appliesTo,
        comment: data.adjustment.comment,
        customerName: data.adjustment.customerName ?? null,
        otherAssignmentInfo: null,
      }
      onAdded(created)
      toast.success('Adjustment added')
    } catch (error) {
      console.error('Error adding adjustment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add')
      throw error
    }
  }

  if (variant === 'standalone') {
    return (
      <AdjustmentEditor
        open={open}
        onOpenChange={setOpen}
        attachedTo={attachedTo}
        onSave={handleSave}
      >
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 rounded hover:bg-blue-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Adjustment
        </button>
      </AdjustmentEditor>
    )
  }

  return (
    <AdjustmentEditor
      open={open}
      onOpenChange={setOpen}
      attachedTo={attachedTo}
      onSave={handleSave}
    >
      <tr className="cursor-pointer hover:bg-black/5">
        <td colSpan={4} className="pl-6 pr-2 py-0.5 text-[11px] text-gray-500 hover:text-blue-700">
          <span className="inline-flex items-center gap-1">
            <Plus className="h-3 w-3" />
            Add adjustment
          </span>
        </td>
      </tr>
    </AdjustmentEditor>
  )
}
