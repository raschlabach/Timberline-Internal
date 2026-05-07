'use client'

import React from 'react'
import { AlertTriangle, MapPin, Split } from 'lucide-react'
import type { PayrollAdjustment, PayrollOrder } from '@/lib/driver-pay/types'

interface OrderWarningsProps {
  order: PayrollOrder
  isTransfer: boolean
  // The full adjustments list for this truckload — used to detect an
  // active split load even when assignmentQuote is null but a split
  // entry was created (e.g. via the payroll-page split flow).
  allAdjustments: PayrollAdjustment[]
}

// Renders the legacy invoice-page warning labels for the new payroll
// page, shown to the LEFT of each order's adjustments box.
//
// Three signals, ported from the legacy rules:
//
//  1. Active split load — amber. The order has a separate
//     assignmentQuote OR a cross-driver-freight-deductions row with a
//     splitLoadId tied to it. Informational; the split flow handles it.
//
//  2. Should be a split load — orange. The order matches one of the
//     legacy "needs split" conditions (middlefield, 424 footage non-
//     transfer, or transfer) AND no active split exists yet. Action
//     required.
//
//  3. Middlefield — yellow. Order-level flag, shown whenever the order
//     is middlefield. Adds a "+ backhaul" suffix when both flags are set
//     (a noteworthy double-flag the legacy page also called out).
export function OrderWarnings({
  order,
  isTransfer,
  allAdjustments,
}: OrderWarningsProps) {
  const hasAssignmentQuote =
    order.assignmentQuote !== null && order.assignmentQuote !== undefined
  const hasSplitAdjustment = allAdjustments.some(
    (a) => a.orderId === order.orderId && a.splitLoadId !== null
  )
  const hasActiveSplitLoad = hasAssignmentQuote || hasSplitAdjustment

  const shouldBeSplitLoad =
    !hasActiveSplitLoad &&
    (order.middlefield ||
      (order.footage === 424 && !isTransfer) ||
      isTransfer)

  let shouldBeSplitReason = ''
  if (shouldBeSplitLoad) {
    if (order.middlefield) {
      shouldBeSplitReason = 'Middlefield order — should be a split load'
    } else if (isTransfer) {
      shouldBeSplitReason =
        'Transfer order (pickup + delivery on same load) — should be a split load'
    } else {
      shouldBeSplitReason = '424 ft² order — should be a split load'
    }
  }

  // Bail early if no warnings apply so the parent layout stays tight.
  if (!hasActiveSplitLoad && !shouldBeSplitLoad && !order.middlefield) {
    return null
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {hasActiveSplitLoad && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border bg-amber-100 border-amber-300 text-amber-900"
          title="Active split load on this order — managed via the split icon"
        >
          <Split className="h-3 w-3" />
          Split Load
        </span>
      )}

      {shouldBeSplitLoad && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border bg-orange-100 border-orange-400 text-orange-900"
          title={shouldBeSplitReason}
        >
          <AlertTriangle className="h-3 w-3" />
          Should be split
        </span>
      )}

      {order.middlefield && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border bg-yellow-100 border-yellow-400 text-yellow-900"
          title={
            order.backhaul
              ? 'Middlefield order (also flagged backhaul)'
              : 'Middlefield order'
          }
        >
          <MapPin className="h-3 w-3" />
          Middlefield
        </span>
      )}
    </div>
  )
}
