'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  formatCurrency,
  type OrderQbBreakdown,
} from '@/lib/driver-pay/calculations'
import type {
  PayrollAdjustment,
  PayrollOrder,
  PayrollTruckload,
} from '@/lib/driver-pay/types'

interface QbSidebarProps {
  truckload: PayrollTruckload
  // Orders in the same order they're rendered in the orders table
  // (already sorted by payrollSequence). One sidebar row per order.
  sortedOrders: PayrollOrder[]
  // Map keyed by `${orderId}-${assignmentId ?? 'none'}` from the parent.
  qbByRowKey: Map<string, OrderQbBreakdown>
  surchargePercentage: number
  allAdjustments: PayrollAdjustment[]
  // Per-row pixel heights measured from the orders side. Each entry is
  // applied as min-height on the matching QB row so the two sides line
  // up regardless of how many adjustments / buttons each order has.
  rowHeights: Record<string, number>
  onAdjustmentsChange: (adjustments: PayrollAdjustment[]) => void
}

// Sidebar that renders to the RIGHT of the orders table. Each row is a
// flex-item div sized to match the matching order tbody's measured
// height. The running QB total accumulates down the column so admins can
// scan along QuickBooks' running totals to find mismatches quickly.
//
// Toggling an adjustment here ONLY changes the QB total — it never
// affects driver pay or load value.
export function QbSidebar({
  truckload,
  sortedOrders,
  qbByRowKey,
  surchargePercentage,
  allAdjustments,
  rowHeights,
  onAdjustmentsChange,
}: QbSidebarProps) {
  const [pendingId, setPendingId] = useState<number | null>(null)

  async function toggleAdjustment(adjustmentId: number, currentlyApplied: boolean) {
    const nextExcluded = currentlyApplied
    setPendingId(adjustmentId)
    const previous = allAdjustments
    const optimistic = allAdjustments.map((a) =>
      a.id === adjustmentId ? { ...a, excludedFromQb: nextExcluded } : a
    )
    onAdjustmentsChange(optimistic)
    try {
      const response = await fetch(
        `/api/truckloads/${truckload.id}/adjustments/${adjustmentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ excludedFromQb: nextExcluded }),
        }
      )
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error toggling QB exclusion:', error)
      toast.error('Failed to update QB exclusion')
      onAdjustmentsChange(previous)
    } finally {
      setPendingId(null)
    }
  }

  // Walk the sorted orders once, accumulating the running QB total.
  // Each row's contribution = breakdown.qbTotal (which already includes
  // applied adjustments). Non-billing rows contribute 0.
  let running = 0
  const rows = sortedOrders.map((order) => {
    const rowKey = `${order.orderId}-${order.assignmentId ?? 'none'}`
    const breakdown = qbByRowKey.get(rowKey) ?? null
    const isBilling = !!breakdown && breakdown.isBillingRow && breakdown.baseQuote > 0
    const rowContribution = isBilling && breakdown ? breakdown.qbTotal : 0
    running += rowContribution
    return {
      key: order.assignmentId ?? `qb-${order.orderId}-${order.assignmentType}`,
      rowKey,
      breakdown,
      isBilling,
      rowContribution,
      runningTotal: running,
    }
  })

  return (
    <div className="flex-shrink-0 self-stretch">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-sm font-semibold text-amber-700">QuickBooks</h3>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap"
          title="Fuel surcharge applied to billable freight quotes"
        >
          +{surchargePercentage}% fuel
        </span>
      </div>

      {/* 6px gap matches the orders table's `border-spacing: 0 6px` so
          each QB block sits next to its order block. Each block uses
          min-height driven by ResizeObserver measurement of the order
          tbody, guaranteeing alignment. */}
      <div className="flex flex-col" style={{ gap: '6px', minWidth: 220 }}>
        {rows.map((row) => {
          const heightPx = rowHeights[row.rowKey]
          const minHeightStyle =
            typeof heightPx === 'number' && heightPx > 0
              ? { minHeight: heightPx }
              : undefined

          if (!row.isBilling || !row.breakdown) {
            return (
              <div
                key={row.key}
                style={minHeightStyle}
                className="flex flex-col px-3 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-md"
              >
                <div className="text-right text-xs text-gray-300 italic">
                  not billed
                </div>
                {/* Running total persists through non-billed rows so
                    the column still tracks QB pagination. */}
                <div className="mt-auto pt-1 text-right">
                  <span className="text-[10px] text-gray-400">running:</span>{' '}
                  <span className="text-xs font-medium text-gray-500 tabular-nums">
                    {formatCurrency(row.runningTotal)}
                  </span>
                </div>
              </div>
            )
          }

          const breakdown = row.breakdown

          return (
            <div
              key={row.key}
              style={minHeightStyle}
              className="flex flex-col px-3 py-2 bg-amber-50 border-2 border-amber-200 rounded-md"
            >
              {/* Top: this row's contribution and running total */}
              <div className="flex items-baseline justify-between gap-3 whitespace-nowrap">
                <div className="text-[10px] text-gray-500 leading-tight">
                  +{formatCurrency(row.rowContribution)} this row
                </div>
                <div
                  className="text-base font-bold text-emerald-700 tabular-nums leading-tight"
                  title="Running QuickBooks total through this row"
                >
                  {formatCurrency(row.runningTotal)}
                </div>
              </div>

              {/* Quote breakdown line (small, below the totals) */}
              <div className="text-[10px] text-gray-500 text-right leading-tight">
                {formatCurrency(breakdown.baseQuote)} +{' '}
                {formatCurrency(breakdown.surchargeAmount)} fuel
              </div>

              {/* Adjustments — clickable to toggle inclusion in QB total */}
              {breakdown.adjustments.length > 0 ? (
                <div className="flex flex-col items-stretch gap-0.5 mt-1.5 pt-1.5 border-t border-amber-200">
                  {breakdown.adjustments.map((adj) => {
                    const isPending = pendingId === adj.adjustmentId
                    const sign = adj.isAddition ? '+' : '−'
                    const amount = formatCurrency(adj.amount)
                    const stateClass = adj.appliedToQb
                      ? adj.isAddition
                        ? 'text-emerald-700 hover:bg-emerald-50'
                        : 'text-rose-700 hover:bg-rose-50'
                      : 'text-gray-400 line-through hover:bg-gray-100'
                    const desc =
                      adj.description.length > 26
                        ? adj.description.slice(0, 25) + '…'
                        : adj.description
                    return (
                      <button
                        key={adj.adjustmentId}
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          toggleAdjustment(adj.adjustmentId, adj.appliedToQb)
                        }
                        title={
                          adj.appliedToQb
                            ? `Click to EXCLUDE from QuickBooks total: ${adj.description} (${sign}${amount})`
                            : `Click to INCLUDE in QuickBooks total: ${adj.description} (${sign}${amount})`
                        }
                        className={`inline-flex items-center justify-end gap-2 w-full text-[11px] leading-tight px-1.5 py-0.5 rounded transition-colors ${stateClass} ${
                          isPending ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                        }`}
                      >
                        <span className="truncate flex-1 text-right">{desc}</span>
                        <span className="font-semibold tabular-nums whitespace-nowrap">
                          {sign}
                          {amount}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
