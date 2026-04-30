'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { TruckloadRow } from './truckload-row'
import { parseLocalDate } from '@/lib/driver-pay/date-helpers'
import type { PayrollDriver, PayrollTruckload } from '@/lib/driver-pay/types'

interface TruckloadListProps {
  driver: PayrollDriver
  onTruckloadOpen: (truckloadId: number) => void
  onTruckloadUpdate: (truckloadId: number, updates: Partial<PayrollTruckload>) => void
}

export function TruckloadList({
  driver,
  onTruckloadOpen,
  onTruckloadUpdate,
}: TruckloadListProps) {
  const sortedTruckloads = [...driver.truckloads].sort((a, b) => {
    const aTime = parseLocalDate(a.startDate).getTime()
    const bTime = parseLocalDate(b.startDate).getTime()
    return aTime - bTime
  })

  if (sortedTruckloads.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-gray-400 italic">
        No truckloads for this driver in this date range.
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {sortedTruckloads.map((truckload) => (
        <TruckloadRow
          key={truckload.id}
          driver={driver}
          truckload={truckload}
          onOpen={() => onTruckloadOpen(truckload.id)}
          onUpdate={(updates) => onTruckloadUpdate(truckload.id, updates)}
        />
      ))}
    </div>
  )
}
