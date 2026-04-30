'use client'

import React from 'react'
import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { parseLocalDate } from '@/lib/driver-pay/date-helpers'
import type { PayrollOrder } from '@/lib/driver-pay/types'

interface HandledByProps {
  order: PayrollOrder
  // Whether this assignment is a transfer (same driver does both halves
  // on this load). When true, we show "Transfer" and skip the alert logic.
  isTransfer: boolean
  // Driver currently being viewed on the payroll page. Used to flag when
  // the OTHER half of this order belongs to a different driver.
  currentDriverName: string
}

function formatDateShort(value: string | null): string {
  if (!value) return ''
  try {
    return format(parseLocalDate(value), 'M/d/yy')
  } catch {
    return value
  }
}

export function HandledBy({ order, isTransfer, currentDriverName }: HandledByProps) {
  if (isTransfer) {
    return (
      <div className="text-xs font-semibold text-blue-700 whitespace-nowrap">
        Transfer
      </div>
    )
  }

  const other = order.otherHalf
  if (!other || !other.driverName) {
    return <div className="text-xs text-gray-300">—</div>
  }

  const isCrossDriver = other.driverName !== currentDriverName
  const dateLabel = formatDateShort(other.assignmentDate)

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        {isCrossDriver && (
          <AlertTriangle
            className="h-4 w-4 text-red-500"
            aria-label={`Other half handled by different driver (${other.driverName})`}
          />
        )}
      </div>
      <div className="text-xs leading-tight">
        <div className={isCrossDriver ? 'font-semibold text-red-700' : 'text-gray-700'}>
          {other.driverName}
        </div>
        {dateLabel && (
          <div className="text-gray-500">{dateLabel}</div>
        )}
      </div>
    </div>
  )
}
