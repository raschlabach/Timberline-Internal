'use client'

import React from 'react'
import { format } from 'date-fns'
import { ChevronRight, Package, Truck } from 'lucide-react'
import {
  calculateTruckloadTotals,
  formatCurrency,
} from '@/lib/driver-pay/calculations'
import { parseLocalDate } from '@/lib/driver-pay/date-helpers'
import type { PayrollDriver, PayrollTruckload } from '@/lib/driver-pay/types'
import { PayMethodControl } from './pay-method-control'
import { VerificationToggles } from './verification-toggles'

interface TruckloadRowProps {
  driver: PayrollDriver
  truckload: PayrollTruckload
  onOpen: () => void
  onUpdate: (updates: Partial<PayrollTruckload>) => void
}

function formatDateRange(start: string, end: string): string {
  const startDate = parseLocalDate(start)
  if (!end || end === start) {
    return format(startDate, 'EEE M/d/yy')
  }
  const endDate = parseLocalDate(end)
  return `${format(startDate, 'EEE M/d')} – ${format(endDate, 'EEE M/d/yy')}`
}

export function TruckloadRow({
  driver,
  truckload,
  onOpen,
  onUpdate,
}: TruckloadRowProps) {
  const totals = calculateTruckloadTotals(
    truckload,
    driver.loadPercentage,
    driver.miscDrivingRate
  )

  const description = truckload.description?.trim() || 'No description'
  const bol = truckload.billOfLadingNumber?.trim() || ''

  const isAuto = truckload.payCalculationMethod === 'automatic'
  const showLoadValue = isAuto

  return (
    <div
      className="border rounded-lg bg-white transition-colors cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      onClick={onOpen}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />

        <div className="flex flex-col min-w-[110px] flex-shrink-0">
          <span className="text-xs font-semibold text-gray-700">
            {formatDateRange(truckload.startDate, truckload.endDate)}
          </span>
          {bol && (
            <span className="text-[10px] text-gray-400 leading-tight">BoL #{bol}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-800 truncate">{description}</div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 leading-tight mt-0.5">
            <span className="inline-flex items-center gap-0.5">
              <Package className="h-3 w-3 text-red-600" />
              {totals.pickupCount}
            </span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-0.5">
              <Truck className="h-3 w-3 text-gray-700" />
              {totals.deliveryCount}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">
          <PayMethodControl
            truckload={truckload}
            onSaved={(updates) => onUpdate(updates)}
          />
        </div>

        <div className="flex flex-col items-end min-w-[100px] flex-shrink-0">
          {showLoadValue ? (
            <>
              <span className="text-[10px] text-gray-500 leading-tight">Load Value</span>
              <span className="text-sm font-medium text-gray-700 leading-tight">
                {formatCurrency(totals.loadValue)}
              </span>
            </>
          ) : (
            <span className="text-[10px] text-gray-400 italic leading-tight">
              n/a for {truckload.payCalculationMethod}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end min-w-[80px] flex-shrink-0">
          <span className="text-[10px] text-gray-500 leading-tight">Add</span>
          {totals.totalAdditions > 0 ? (
            <span className="text-sm font-medium text-green-700 leading-tight">
              +{formatCurrency(totals.totalAdditions)}
            </span>
          ) : (
            <span className="text-sm text-gray-300 leading-tight">—</span>
          )}
        </div>

        <div className="flex flex-col items-end min-w-[80px] flex-shrink-0">
          <span className="text-[10px] text-gray-500 leading-tight">Ded</span>
          {totals.totalDeductions > 0 ? (
            <span className="text-sm font-medium text-red-700 leading-tight">
              −{formatCurrency(totals.totalDeductions)}
            </span>
          ) : (
            <span className="text-sm text-gray-300 leading-tight">—</span>
          )}
        </div>

        <div className="flex flex-col items-end min-w-[100px] flex-shrink-0">
          <span className="text-[10px] text-gray-500 leading-tight">Pay</span>
          <span className="text-base font-bold text-gray-900 leading-tight">
            {formatCurrency(totals.driverPay)}
          </span>
        </div>

        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <VerificationToggles
            truckload={truckload}
            onSaved={(updates) => onUpdate(updates)}
          />
        </div>
      </div>
    </div>
  )
}
