'use client'

import React, { useEffect, useState } from 'react'
import { Split, Clock, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/driver-pay/calculations'
import { parseLocalDate } from '@/lib/driver-pay/date-helpers'
import type {
  AdjustmentAppliesTo,
  PayrollAdjustment,
  PayrollOrder,
  PayrollTruckload,
} from '@/lib/driver-pay/types'

interface ExistingSplit {
  splitLoadId: number
  miscAmount: number
  mainRole: 'pickup' | 'delivery'
  mainAppliesTo: AdjustmentAppliesTo
  miscAppliesTo: AdjustmentAppliesTo
}

interface SplitLoadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  truckload: PayrollTruckload
  order: PayrollOrder
  currentDriverName: string
  // When provided, the dialog opens in edit mode with these values
  // pre-filled. Saving deletes the existing split first then creates a new
  // one with the user's values.
  existingSplit?: ExistingSplit | null
  // Called after the split is created/updated/deleted so the parent
  // refetches.
  onChanged: () => void
}

export function SplitLoadDialog({
  open,
  onOpenChange,
  truckload,
  order,
  currentDriverName,
  existingSplit,
  onChanged,
}: SplitLoadDialogProps) {
  const fullQuote = order.fullQuote ?? order.freightQuote ?? 0
  const otherHalf = order.otherHalf
  const isEdit = !!existingSplit

  const [miscAmount, setMiscAmount] = useState<string>('')
  const [mainRole, setMainRole] = useState<'pickup' | 'delivery'>(
    order.assignmentType === 'pickup' ? 'pickup' : 'delivery'
  )
  const [mainAppliesTo, setMainAppliesTo] = useState<AdjustmentAppliesTo>('driver_pay')
  const [miscAppliesTo, setMiscAppliesTo] = useState<AdjustmentAppliesTo>('driver_pay')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset form when opened. In edit mode, pre-fill from the existing split.
  useEffect(() => {
    if (open) {
      if (existingSplit) {
        setMiscAmount(String(existingSplit.miscAmount))
        setMainRole(existingSplit.mainRole)
        setMainAppliesTo(existingSplit.mainAppliesTo)
        setMiscAppliesTo(existingSplit.miscAppliesTo)
      } else {
        setMiscAmount('')
        setMainRole(order.assignmentType === 'pickup' ? 'pickup' : 'delivery')
        setMainAppliesTo('driver_pay')
        setMiscAppliesTo('driver_pay')
      }
    }
  }, [open, order.assignmentType, existingSplit])

  const miscAmountNum = parseFloat(miscAmount)
  const validAmount = Number.isFinite(miscAmountNum) && miscAmountNum > 0

  const mainPay = validAmount ? fullQuote - miscAmountNum : null

  // The "other half" is auto-determined from the order itself.
  const isPending = !otherHalf || !otherHalf.driverName
  const miscRoleLabel = mainRole === 'pickup' ? 'delivery' : 'pickup'

  // Whether THIS truckload is the main side or the misc side.
  const thisIsMain = order.assignmentType === mainRole

  const otherDriverName = otherHalf?.driverName ?? null
  const mainDriverName = thisIsMain ? currentDriverName : (otherDriverName ?? 'Unassigned')
  const miscDriverName = thisIsMain ? (otherDriverName ?? 'Unassigned') : currentDriverName

  // Description previews
  const mainSidePreview = validAmount
    ? `*Split Load* ${miscDriverName} receives ${formatCurrency(
        miscAmountNum
      )} for ${miscRoleLabel}`
    : ''
  const miscSidePreview = validAmount
    ? `*Split Load* receives ${formatCurrency(
        miscAmountNum
      )} for ${miscRoleLabel} from ${mainDriverName}`
    : ''

  async function handleSave() {
    if (!validAmount) {
      toast.error('Misc amount must be a positive number')
      return
    }
    if (miscAmountNum >= fullQuote) {
      toast.error(
        `Misc amount must be less than the full quote (${formatCurrency(fullQuote)})`
      )
      return
    }

    setIsSaving(true)
    try {
      // In edit mode, delete the existing split first so the create-side
      // logic can run cleanly.
      if (existingSplit) {
        const deleteResponse = await fetch(
          `/api/truckloads/${truckload.id}/payroll-splits/${existingSplit.splitLoadId}`,
          { method: 'DELETE', credentials: 'include' }
        )
        const deleteData = await deleteResponse.json()
        if (!deleteData.success) {
          throw new Error(deleteData.error || 'Failed to remove existing split')
        }
      }

      const response = await fetch(
        `/api/truckloads/${truckload.id}/payroll-splits`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            orderId: order.orderId,
            miscAmount: miscAmountNum,
            mainRole,
            mainAppliesTo,
            miscAppliesTo,
          }),
        }
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to create split')
      toast.success(
        isEdit
          ? 'Split load updated'
          : isPending
          ? 'Split load created — waiting for the other half'
          : 'Split load created'
      )
      onChanged()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving split load:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save split')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!existingSplit) return
    if (!confirm('Remove this split load? Both sides will be deleted and the misc-side quote will be restored.')) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/truckloads/${truckload.id}/payroll-splits/${existingSplit.splitLoadId}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to remove split')
      toast.success('Split load removed')
      onChanged()
      onOpenChange(false)
    } catch (error) {
      console.error('Error removing split load:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove split')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-amber-600" />
            {isEdit ? 'Edit Split Load' : 'Split Load'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Edit the values below to update both sides of the split load. Or remove the split entirely.'
              : "Move part of an order's pay to another driver. Use this when one driver handled the pickup and another the delivery (or vice versa)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order context */}
          <div className="bg-gray-50 rounded p-2.5 text-sm">
            <div className="font-semibold text-gray-900">
              Order #{order.orderId}
            </div>
            <div className="text-gray-700 text-xs mt-0.5">
              {order.pickupCustomerName || 'Unknown pickup'} → {order.deliveryCustomerName || 'Unknown delivery'}
            </div>
            <div className="text-gray-600 text-xs mt-0.5">
              Full freight quote: <strong>{formatCurrency(fullQuote)}</strong>
            </div>
          </div>

          {/* Other half — auto-detected, read-only */}
          {isPending ? (
            <div className="bg-amber-50 border border-amber-200 rounded p-2.5 flex items-start gap-2">
              <Clock className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-amber-900">
                  Other half not yet assigned
                </div>
                <div className="text-amber-800 leading-snug mt-0.5">
                  The {miscRoleLabel} side of this order isn't on a truckload yet.
                  This will create a <strong>delay</strong>: only this driver's
                  side records now. The matching entry is created automatically
                  the moment the {miscRoleLabel} is assigned to a truck.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded p-2.5 flex items-start gap-2">
              <ArrowRightLeft className="h-4 w-4 text-blue-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-blue-900">Other half</div>
                <div className="text-blue-800 mt-0.5">
                  <strong>{otherHalf!.driverName}</strong>
                  {otherHalf!.assignmentType ? ` (${otherHalf!.assignmentType})` : ''}
                  {otherHalf!.assignmentDate ? (
                    <> on {format(parseLocalDate(otherHalf!.assignmentDate), 'EEE M/d/yy')}</>
                  ) : null}
                </div>
                <div className="text-blue-700 leading-snug mt-1 text-[11px]">
                  The matching entry will be created on this truckload automatically.
                </div>
              </div>
            </div>
          )}

          {/* Misc amount */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Misc amount (the dollar value being split)
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={miscAmount}
                onChange={(e) => setMiscAmount(e.target.value)}
                placeholder="0.00"
                className="h-9"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-gray-500 leading-tight">
              The driver who took the most work gets `full quote − misc`. The
              other driver gets just the misc amount.
            </p>
          </div>

          {/* Main role picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Who took the main work?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mainRole === 'pickup' ? 'default' : 'outline'}
                onClick={() => setMainRole('pickup')}
                className="h-auto py-2 px-3 flex flex-col items-start text-left"
              >
                <span className="text-xs font-bold">Pickup driver</span>
                <span className="text-[10px] font-normal opacity-80 truncate w-full">
                  {validAmount && mainPay !== null
                    ? `gets ${formatCurrency(mainPay)}`
                    : 'gets full quote − misc'}
                </span>
              </Button>
              <Button
                type="button"
                variant={mainRole === 'delivery' ? 'default' : 'outline'}
                onClick={() => setMainRole('delivery')}
                className="h-auto py-2 px-3 flex flex-col items-start text-left"
              >
                <span className="text-xs font-bold">Delivery driver</span>
                <span className="text-[10px] font-normal opacity-80 truncate w-full">
                  {validAmount && mainPay !== null
                    ? `gets ${formatCurrency(mainPay)}`
                    : 'gets full quote − misc'}
                </span>
              </Button>
            </div>
          </div>

          {/* Applies to selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Main driver — deduction applies to:
              </Label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={mainAppliesTo === 'driver_pay' ? 'default' : 'outline'}
                  onClick={() => setMainAppliesTo('driver_pay')}
                  className="h-7 text-[11px]"
                >
                  Driver Pay
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mainAppliesTo === 'load_value' ? 'default' : 'outline'}
                  onClick={() => setMainAppliesTo('load_value')}
                  className="h-7 text-[11px]"
                >
                  Load Value
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Misc driver — addition applies to:
              </Label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={miscAppliesTo === 'driver_pay' ? 'default' : 'outline'}
                  onClick={() => setMiscAppliesTo('driver_pay')}
                  className="h-7 text-[11px]"
                >
                  Driver Pay
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={miscAppliesTo === 'load_value' ? 'default' : 'outline'}
                  onClick={() => setMiscAppliesTo('load_value')}
                  className="h-7 text-[11px]"
                >
                  Load Value
                </Button>
              </div>
            </div>
          </div>

          {/* Preview of what will be created */}
          {validAmount && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs space-y-1.5">
              <div className="font-semibold text-amber-900">What this will do:</div>
              <div className="text-gray-700">
                <strong>{mainDriverName}'s load</strong> ({mainRole}):{' '}
                <span className="text-red-700 font-medium">
                  −{formatCurrency(miscAmountNum)}
                </span>{' '}
                from {mainAppliesTo === 'load_value' ? 'load value' : 'driver pay'}
                <div className="text-[10px] text-gray-500 italic mt-0.5">
                  {mainSidePreview}
                </div>
              </div>
              {!isPending ? (
                <div className="text-gray-700 pt-1 border-t border-amber-200">
                  <strong>{miscDriverName}'s load</strong> ({miscRoleLabel}):{' '}
                  freight quote excluded,{' '}
                  <span className="text-green-700 font-medium">
                    +{formatCurrency(miscAmountNum)}
                  </span>{' '}
                  to {miscAppliesTo === 'load_value' ? 'load value' : 'driver pay'}
                  <div className="text-[10px] text-gray-500 italic mt-0.5">
                    {miscSidePreview}
                  </div>
                </div>
              ) : (
                <div className="text-amber-800 pt-1 border-t border-amber-200 italic">
                  Pending: misc-side entry will be created automatically when
                  the {miscRoleLabel} is assigned.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 flex-wrap">
          <div>
            {isEdit && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isDeleting ? 'Removing…' : 'Remove Split Load'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isDeleting || !validAmount}
            >
              {isSaving
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                ? 'Save Changes'
                : 'Create Split Load'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
