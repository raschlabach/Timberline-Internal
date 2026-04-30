'use client'

import React from 'react'
import { Split } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatCurrency } from '@/lib/driver-pay/calculations'
import type { PayrollAdjustment } from '@/lib/driver-pay/types'

interface SplitExcludedQuoteProps {
  // Original freight quote, displayed crossed out.
  originalQuote: number | null
  // The split-load adjustment for this order on this truckload (so we can
  // explain the exclusion in the popover).
  splitEntry: PayrollAdjustment | null
}

export function SplitExcludedQuote({
  originalQuote,
  splitEntry,
}: SplitExcludedQuoteProps) {
  const splitAmount = splitEntry?.amount ?? null
  const otherInfo = splitEntry?.otherAssignmentInfo ?? null
  const description = splitEntry?.comment ?? null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-amber-100 transition-colors"
          title="Quote excluded due to split load — click for details"
        >
          <span className="text-sm text-gray-400 line-through">
            {originalQuote !== null ? formatCurrency(originalQuote) : '—'}
          </span>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold uppercase tracking-wide">
            <Split className="h-2.5 w-2.5" />
            Split
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b">
            <Split className="h-4 w-4 text-amber-600" />
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Quote Excluded — Split Load
            </div>
          </div>

          <p className="text-xs text-gray-700 leading-snug">
            This order's freight quote is excluded from this load's value
            because it was split with another driver. Only the misc portion
            counts on this side.
          </p>

          {originalQuote !== null && (
            <div className="text-xs text-gray-700">
              <span className="text-gray-500">Original quote: </span>
              <span className="line-through">{formatCurrency(originalQuote)}</span>
            </div>
          )}

          {splitAmount !== null && (
            <div className="text-xs text-gray-700">
              <span className="text-gray-500">Misc portion handled here: </span>
              <span className="font-semibold text-amber-800">
                {formatCurrency(splitAmount)}
              </span>
            </div>
          )}

          {otherInfo && (
            <div className="text-xs text-gray-700 pt-1 border-t">
              <span className="text-gray-500">Other half:</span>{' '}
              {otherInfo.driverName ?? 'Unknown driver'}
              {otherInfo.assignmentType ? ` (${otherInfo.assignmentType})` : ''}
              {otherInfo.truckloadDate ? ` on ${otherInfo.truckloadDate}` : ''}
            </div>
          )}

          {!otherInfo && (
            <div className="text-xs text-amber-800 italic pt-1 border-t">
              The other half hasn't been assigned to a truckload yet. The
              system will auto-link it when it appears.
            </div>
          )}

          {description && (
            <div className="text-[10px] text-gray-500 pt-1 border-t italic">
              {description}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
