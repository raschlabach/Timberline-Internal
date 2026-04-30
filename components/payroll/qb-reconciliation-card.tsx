'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { FileText, ReceiptText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  calculateTruckloadQb,
  formatCurrency,
  type OrderQbAdjustment,
} from '@/lib/driver-pay/calculations'
import type { PayrollAdjustment, PayrollTruckload } from '@/lib/driver-pay/types'

interface QbReconciliationCardProps {
  truckload: PayrollTruckload
  fuelSurchargePercentage: number
  onAdjustmentsChange: (adjustments: PayrollAdjustment[]) => void
}

// Bottom-of-detail card showing the QuickBooks invoice math broken down,
// with click-to-toggle on each load-value adjustment. The total here
// matches the sum of all per-order QB Totals shown above.
export function QbReconciliationCard({
  truckload,
  fuelSurchargePercentage,
  onAdjustmentsChange,
}: QbReconciliationCardProps) {
  const [pendingId, setPendingId] = useState<number | null>(null)
  const breakdown = calculateTruckloadQb(truckload, fuelSurchargePercentage)

  // Flatten every load-value adjustment (per-order + load-level) into one
  // ordered list so the card mirrors what shows up across the rows above.
  const allQbAdjustments: OrderQbAdjustment[] = [
    ...breakdown.perOrder.flatMap((p) => p.adjustments),
    ...breakdown.loadLevelAdjustments,
  ]

  const billingOrderCount = breakdown.perOrder.filter((p) => p.baseQuote > 0).length

  async function toggleAdjustment(adjustmentId: number, currentlyApplied: boolean) {
    const nextExcluded = currentlyApplied
    setPendingId(adjustmentId)
    const previous = truckload.adjustments
    const optimistic = truckload.adjustments.map((a) =>
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

  if (breakdown.baseQuotesTotal === 0 && allQbAdjustments.length === 0) {
    return null
  }

  return (
    <Card className="p-4 border-amber-200 bg-amber-50/30">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-amber-700" />
          <h3 className="text-base font-bold text-gray-900">
            QuickBooks Reconciliation
          </h3>
          <span className="text-xs text-gray-500">
            (drivers don&rsquo;t see this — admin only)
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">
            QuickBooks Invoice Total
          </div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">
            {formatCurrency(breakdown.qbTotal)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
        <div className="bg-white border rounded p-2">
          <div className="text-xs text-gray-500">
            Base quotes ({billingOrderCount}{' '}
            {billingOrderCount === 1 ? 'order' : 'orders'})
          </div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">
            {formatCurrency(breakdown.baseQuotesTotal)}
          </div>
        </div>
        <div className="bg-white border rounded p-2">
          <div className="text-xs text-gray-500">
            Fuel surcharge ({breakdown.surchargePercentage}%)
          </div>
          <div className="text-base font-semibold text-amber-700 tabular-nums">
            + {formatCurrency(breakdown.surchargeTotal)}
          </div>
        </div>
        <div className="bg-white border rounded p-2">
          <div className="text-xs text-gray-500">Adjustments applied</div>
          <div
            className={`text-base font-semibold tabular-nums ${
              breakdown.appliedAdjustmentsTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {breakdown.appliedAdjustmentsTotal >= 0 ? '+ ' : '− '}
            {formatCurrency(Math.abs(breakdown.appliedAdjustmentsTotal))}
          </div>
        </div>
      </div>

      {allQbAdjustments.length > 0 && (
        <div className="bg-white border rounded">
          <div className="px-3 py-1.5 bg-gray-50 border-b flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">
              Load-value adjustments
            </span>
            <span className="text-[10px] text-gray-500">
              click any row to toggle whether it counts in the QuickBooks total
            </span>
          </div>
          <ul className="divide-y">
            {allQbAdjustments.map((adj) => {
              const isPending = pendingId === adj.adjustmentId
              const sign = adj.isAddition ? '+' : '−'
              return (
                <li key={adj.adjustmentId}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleAdjustment(adj.adjustmentId, adj.appliedToQb)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-sm transition-colors ${
                      isPending
                        ? 'opacity-50 cursor-wait'
                        : 'hover:bg-gray-50 cursor-pointer'
                    } ${adj.appliedToQb ? '' : 'bg-gray-50/50'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`inline-flex items-center justify-center h-5 w-5 rounded border-2 text-[10px] font-bold flex-shrink-0 ${
                          adj.appliedToQb
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : 'bg-white border-gray-300 text-gray-300'
                        }`}
                        aria-hidden
                      >
                        {adj.appliedToQb ? '✓' : ''}
                      </span>
                      <span
                        className={`truncate text-left ${
                          adj.appliedToQb
                            ? 'text-gray-900'
                            : 'text-gray-400 line-through'
                        }`}
                        title={adj.description}
                      >
                        {adj.description}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {adj.isAddition ? 'addition' : 'deduction'}
                      </span>
                    </div>
                    <span
                      className={`font-semibold tabular-nums whitespace-nowrap ${
                        adj.appliedToQb
                          ? adj.isAddition
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                          : 'text-gray-400 line-through'
                      }`}
                    >
                      {sign}
                      {formatCurrency(adj.amount)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="text-[11px] text-gray-500 mt-3 flex items-start gap-1.5">
        <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Excluding an adjustment from QB only changes this total — driver pay
          and load value are unchanged.
        </span>
      </div>
    </Card>
  )
}
