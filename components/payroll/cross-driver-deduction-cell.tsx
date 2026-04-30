'use client'

import React, { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
  AdjustmentAppliesTo,
  PayrollAdjustment,
  PayrollOrder,
} from '@/lib/driver-pay/types'
import { formatCurrency } from '@/lib/driver-pay/calculations'

interface CrossDriverDeductionCellProps {
  truckloadId: number
  order: PayrollOrder
  isTransfer: boolean
  currentDriverName: string
  allAdjustments: PayrollAdjustment[]
  onAdjustmentsChange: (adjustments: PayrollAdjustment[]) => void
}

// Same formula the legacy invoice page uses: $5 per 16 sq ft.
function calculateDefaultAmount(footage: number): number {
  if (!Number.isFinite(footage) || footage <= 0) return 0
  return Math.round(((footage / 16) * 5) * 100) / 100
}

interface CrossDriverContext {
  action: 'Picked up' | 'Delivered'
  otherDriverName: string
  otherCustomerName: string
}

function getCrossDriverContext(
  order: PayrollOrder,
  currentDriverName: string
): CrossDriverContext | null {
  const other = order.otherHalf
  // For delivery rows: only flag when pickup driver exists AND is different.
  if (order.assignmentType === 'delivery') {
    if (other?.driverName && other.driverName !== currentDriverName) {
      return {
        action: 'Picked up',
        otherDriverName: other.driverName,
        otherCustomerName: order.pickupCustomerName || 'Unknown',
      }
    }
    return null
  }
  // For pickup rows: cross-driver if delivery driver is missing OR different.
  if (!other?.driverName || other.driverName !== currentDriverName) {
    return {
      action: 'Delivered',
      otherDriverName: other?.driverName || 'Unassigned',
      otherCustomerName: order.deliveryCustomerName || 'Unknown',
    }
  }
  return null
}

export function CrossDriverDeductionCell({
  truckloadId,
  order,
  isTransfer,
  currentDriverName,
  allAdjustments,
  onAdjustmentsChange,
}: CrossDriverDeductionCellProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [draftAmount, setDraftAmount] = useState('')
  const [draftAppliesTo, setDraftAppliesTo] = useState<AdjustmentAppliesTo>('driver_pay')
  const [isWorking, setIsWorking] = useState(false)

  // Skip transfer (this driver does both halves) and split loads / RR orders.
  if (isTransfer) {
    return <span className="text-xs text-gray-300">—</span>
  }
  if (order.assignmentQuote !== null && order.assignmentQuote !== undefined) {
    return <span className="text-xs text-gray-300" title="Split load — handled via split load entries">—</span>
  }
  if (order.rrOrder) {
    return <span className="text-xs text-gray-300" title="RR order">—</span>
  }

  const ctx = getCrossDriverContext(order, currentDriverName)
  if (!ctx) {
    return <span className="text-xs text-gray-300">—</span>
  }
  const context = ctx

  // Find an existing cross-driver deduction for this order. Identified by
  // having the matching action set on a manual, non-split-load deduction.
  const existing = allAdjustments.find(
    (a) =>
      a.isManual &&
      a.orderId === order.orderId &&
      !a.splitLoadId &&
      !a.isAddition &&
      a.action === context.action
  )

  const defaultAmount = calculateDefaultAmount(order.footage)
  const defaultComment = `${context.otherDriverName} ${context.action.toLowerCase()}`

  function openEditor() {
    setDraftAmount(
      existing ? String(existing.amount) : defaultAmount.toFixed(2)
    )
    setDraftAppliesTo(existing?.appliesTo ?? 'driver_pay')
    setEditorOpen(true)
  }

  async function handleSave() {
    const parsed = parseFloat(draftAmount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Amount must be a non-negative number')
      return
    }
    setIsWorking(true)
    try {
      if (existing) {
        const response = await fetch(
          `/api/truckloads/${truckloadId}/adjustments/${existing.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              amount: parsed,
              appliesTo: draftAppliesTo,
            }),
          }
        )
        const data = await response.json()
        if (!data.success) throw new Error(data.error || 'Failed to update')
        onAdjustmentsChange(
          allAdjustments.map((a) =>
            a.id === existing.id
              ? { ...a, amount: parsed, appliesTo: draftAppliesTo }
              : a
          )
        )
        toast.success('Deduction updated')
      } else {
        const response = await fetch(
          `/api/truckloads/${truckloadId}/adjustments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              orderId: order.orderId,
              isAddition: false,
              amount: parsed,
              appliesTo: draftAppliesTo,
              comment: defaultComment,
              action: context.action,
            }),
          }
        )
        const data = await response.json()
        if (!data.success) throw new Error(data.error || 'Failed to add')
        const created: PayrollAdjustment = {
          id: data.adjustment.id,
          orderId: data.adjustment.orderId ?? null,
          splitLoadId: null,
          driverName: null,
          date: data.adjustment.date,
          action: data.adjustment.action ?? context.action,
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
        onAdjustmentsChange([...allAdjustments, created])
        toast.success('Deduction added')
      }
      setEditorOpen(false)
    } catch (error) {
      console.error('Error saving cross-driver deduction:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setIsWorking(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setIsWorking(true)
    try {
      const response = await fetch(
        `/api/truckloads/${truckloadId}/adjustments/${existing.id}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to delete')
      onAdjustmentsChange(allAdjustments.filter((a) => a.id !== existing.id))
      toast.success('Deduction removed')
      setEditorOpen(false)
    } catch (error) {
      console.error('Error deleting cross-driver deduction:', error)
      toast.error('Failed to delete')
    } finally {
      setIsWorking(false)
    }
  }

  // EXISTING: SOLID red, looks committed.
  if (existing) {
    return (
      <div className="inline-flex items-center gap-1">
        <Popover open={editorOpen} onOpenChange={setEditorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-700 border border-red-700 shadow-sm whitespace-nowrap"
              title="Edit cross-driver deduction"
            >
              <span>−{formatCurrency(existing.amount)}</span>
              <span className="inline-flex items-center justify-center px-1 rounded bg-red-800/40 text-[10px] font-semibold tracking-wider">
                {existing.appliesTo === 'driver_pay' ? 'DP' : 'LV'}
              </span>
              <Pencil className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <EditorBody
            isExisting
            draftAmount={draftAmount}
            setDraftAmount={setDraftAmount}
            draftAppliesTo={draftAppliesTo}
            setDraftAppliesTo={setDraftAppliesTo}
            defaultAmount={defaultAmount}
            comment={defaultComment}
            onSave={handleSave}
            onDelete={handleDelete}
            onCancel={() => setEditorOpen(false)}
            isWorking={isWorking}
          />
        </Popover>
      </div>
    )
  }

  // NO DEDUCTION YET: dashed "ghost" pill, clearly a suggestion not a fact.
  return (
    <Popover open={editorOpen} onOpenChange={setEditorOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={openEditor}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 bg-transparent hover:bg-red-50 hover:text-red-700 border border-dashed border-gray-400 hover:border-red-400 whitespace-nowrap"
          title={`Quick-add cross-driver deduction: ${defaultComment}`}
        >
          <Plus className="h-3 w-3" />
          <span>Add −{formatCurrency(defaultAmount)}</span>
        </button>
      </PopoverTrigger>
      <EditorBody
        isExisting={false}
        draftAmount={draftAmount}
        setDraftAmount={setDraftAmount}
        draftAppliesTo={draftAppliesTo}
        setDraftAppliesTo={setDraftAppliesTo}
        defaultAmount={defaultAmount}
        comment={defaultComment}
        onSave={handleSave}
        onDelete={handleDelete}
        onCancel={() => setEditorOpen(false)}
        isWorking={isWorking}
      />
    </Popover>
  )
}

interface EditorBodyProps {
  isExisting: boolean
  draftAmount: string
  setDraftAmount: (value: string) => void
  draftAppliesTo: AdjustmentAppliesTo
  setDraftAppliesTo: (value: AdjustmentAppliesTo) => void
  defaultAmount: number
  comment: string
  onSave: () => void
  onDelete: () => void
  onCancel: () => void
  isWorking: boolean
}

function EditorBody({
  isExisting,
  draftAmount,
  setDraftAmount,
  draftAppliesTo,
  setDraftAppliesTo,
  defaultAmount,
  comment,
  onSave,
  onDelete,
  onCancel,
  isWorking,
}: EditorBodyProps) {
  return (
    <PopoverContent
      className="w-72 p-3"
      align="start"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {isExisting ? 'Edit Cross-Driver Deduction' : 'Add Cross-Driver Deduction'}
        </div>

        <div className="text-[11px] text-gray-600 leading-snug border-l-2 border-gray-200 pl-2">
          {comment}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-700">Amount</label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-red-700 font-semibold">−$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              className="h-8 text-sm flex-1"
              autoFocus
            />
            {parseFloat(draftAmount) !== defaultAmount && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraftAmount(defaultAmount.toFixed(2))}
                className="h-8 text-[11px] text-blue-600 hover:text-blue-800 px-2"
                title={`Reset to calculated default ($${defaultAmount.toFixed(2)})`}
              >
                Reset
              </Button>
            )}
          </div>
          <p className="text-[10px] text-gray-400">
            Default = footage ÷ 16 × $5
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-700">Applies To</label>
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              size="sm"
              variant={draftAppliesTo === 'driver_pay' ? 'default' : 'outline'}
              onClick={() => setDraftAppliesTo('driver_pay')}
              className="h-7 text-xs"
            >
              Driver Pay
            </Button>
            <Button
              type="button"
              size="sm"
              variant={draftAppliesTo === 'load_value' ? 'default' : 'outline'}
              onClick={() => setDraftAppliesTo('load_value')}
              className="h-7 text-xs"
            >
              Load Value
            </Button>
          </div>
        </div>

        <div className="flex justify-between items-center gap-1 pt-1">
          <div>
            {isExisting && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDelete}
                disabled={isWorking}
                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isWorking}
              className="h-7"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={isWorking}
              className="h-7"
            >
              {isExisting ? 'Save' : 'Confirm Add'}
            </Button>
          </div>
        </div>
      </div>
    </PopoverContent>
  )
}
