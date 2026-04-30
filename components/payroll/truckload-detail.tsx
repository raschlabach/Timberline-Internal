'use client'

import React from 'react'
import { format } from 'date-fns'
import { ArrowLeft, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { OrdersList } from './orders-list'
import { PaySummary } from './pay-summary'
import { LoadLevelAdjustments } from './load-level-adjustments'
import { PayMethodControl } from './pay-method-control'
import { VerificationToggles } from './verification-toggles'
import { parseLocalDate } from '@/lib/driver-pay/date-helpers'
import type {
  PayrollAdjustment,
  PayrollDriver,
  PayrollOrder,
  PayrollTruckload,
} from '@/lib/driver-pay/types'

interface TruckloadDetailProps {
  driver: PayrollDriver
  truckload: PayrollTruckload
  onBack: () => void
  onTruckloadUpdate: (updates: Partial<PayrollTruckload>) => void
  onOrdersReplace: (orders: PayrollOrder[]) => void
  onAdjustmentsReplace: (adjustments: PayrollAdjustment[]) => void
  // Re-fetches all data from the server (after a split load is created).
  onRefetch: () => void
}

export function TruckloadDetail({
  driver,
  truckload,
  onBack,
  onTruckloadUpdate,
  onOrdersReplace,
  onAdjustmentsReplace,
  onRefetch,
}: TruckloadDetailProps) {
  const startDate = parseLocalDate(truckload.startDate)
  const endDate = truckload.endDate ? parseLocalDate(truckload.endDate) : null
  const sameDay =
    !endDate || format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')

  function handleOrderUpdate(orderId: number, updates: Partial<PayrollOrder>) {
    const newOrders = truckload.orders.map((o) =>
      o.orderId === orderId ? { ...o, ...updates } : o
    )
    onOrdersReplace(newOrders)
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="flex-shrink-0 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">
                  {sameDay
                    ? format(startDate, 'EEEE, MMM d, yyyy')
                    : `${format(startDate, 'EEE M/d')} – ${format(
                        endDate as Date,
                        'EEE M/d, yyyy'
                      )}`}
                </h2>
                {truckload.billOfLadingNumber && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                    <FileText className="h-3 w-3" />
                    BoL #{truckload.billOfLadingNumber}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-700 mt-0.5">
                {truckload.description?.trim() || (
                  <span className="text-gray-400 italic">No description</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <PayMethodControl
              truckload={truckload}
              onSaved={(updates) => onTruckloadUpdate(updates)}
            />
            <VerificationToggles
              truckload={truckload}
              onSaved={(updates) => onTruckloadUpdate(updates)}
            />
          </div>
        </div>
      </Card>

      <OrdersList
        truckload={truckload}
        driverName={driver.driverName}
        onOrderUpdate={handleOrderUpdate}
        onOrdersReordered={onOrdersReplace}
        onAdjustmentsChange={onAdjustmentsReplace}
        onRefetch={onRefetch}
      />

      <LoadLevelAdjustments
        truckload={truckload}
        onAdjustmentsChange={onAdjustmentsReplace}
      />

      <PaySummary driver={driver} truckload={truckload} />
    </div>
  )
}
