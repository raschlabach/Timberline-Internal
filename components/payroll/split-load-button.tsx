'use client'

import React, { useState } from 'react'
import { Split, Pencil } from 'lucide-react'
import { SplitLoadDialog } from './split-load-dialog'
import type {
  AdjustmentAppliesTo,
  PayrollAdjustment,
  PayrollOrder,
  PayrollTruckload,
} from '@/lib/driver-pay/types'

interface SplitLoadButtonProps {
  truckload: PayrollTruckload
  order: PayrollOrder
  // Adjustments tied to this order on this truckload (filtered upstream).
  // Used to detect whether a split already exists for this order.
  orderAdjustments: PayrollAdjustment[]
  currentDriverName: string
  onChanged: () => void
}

export function SplitLoadButton({
  truckload,
  order,
  orderAdjustments,
  currentDriverName,
  onChanged,
}: SplitLoadButtonProps) {
  const [open, setOpen] = useState(false)

  // Find an existing split-load entry for this order on this truckload.
  // Each order is limited to one active split.
  const existing = orderAdjustments.find(
    (a) => a.splitLoadId !== null && a.orderId === order.orderId
  )

  // To prefill the dialog in edit mode, we need to translate the existing
  // adjustment back into the dialog's input shape:
  //   - mainRole: derived from action (Picked up = pickup is main, etc.)
  //   - mainAppliesTo / miscAppliesTo: from the adjustment + its pair
  // The adjustment's `action` already encodes the misc role's action verb,
  // which matches the misc role. So mainRole = the OPPOSITE of the action.
  let existingSplit: {
    splitLoadId: number
    miscAmount: number
    mainRole: 'pickup' | 'delivery'
    mainAppliesTo: AdjustmentAppliesTo
    miscAppliesTo: AdjustmentAppliesTo
  } | null = null

  if (existing && existing.splitLoadId !== null) {
    // The adjustment we found could be on either the main side or the misc
    // side depending on which truckload we're on. is_addition tells us:
    // - false (deduction) → this is the main side; this entry's appliesTo
    //   is mainAppliesTo. We don't know miscAppliesTo from this alone, so
    //   default it to driver_pay (will be updated when the user saves).
    // - true (addition) → this is the misc side.
    const onMainSide = !existing.isAddition
    existingSplit = {
      splitLoadId: existing.splitLoadId,
      miscAmount: existing.amount,
      // mainRole is whichever role the MAIN side has. The current row's
      // action tells us the OTHER side's action, so flip it.
      mainRole:
        onMainSide
          ? // existing entry is on main; its action is the misc role's verb
            existing.action === 'Picked up'
            ? 'delivery'
            : 'pickup'
          : // existing entry is on misc; its action describes itself
          existing.action === 'Picked up'
          ? 'pickup'
          : 'delivery',
      mainAppliesTo: onMainSide ? existing.appliesTo : 'driver_pay',
      miscAppliesTo: onMainSide ? 'driver_pay' : existing.appliesTo,
    }
  }

  const isEdit = !!existingSplit

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={
          isEdit
            ? 'inline-flex items-center gap-1 pl-2 pr-2 py-0.5 text-[11px] text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 rounded transition-colors border border-amber-300'
            : 'inline-flex items-center gap-1 pl-2 pr-2 py-0.5 text-[11px] text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded transition-colors'
        }
        title={
          isEdit
            ? 'Edit or remove this order\u2019s split load'
            : 'Split this load with another driver'
        }
      >
        {isEdit ? <Pencil className="h-3 w-3" /> : <Split className="h-3 w-3" />}
        {isEdit ? 'Edit Split' : 'Split Load'}
      </button>
      <SplitLoadDialog
        open={open}
        onOpenChange={setOpen}
        truckload={truckload}
        order={order}
        currentDriverName={currentDriverName}
        existingSplit={existingSplit}
        onChanged={onChanged}
      />
    </>
  )
}
