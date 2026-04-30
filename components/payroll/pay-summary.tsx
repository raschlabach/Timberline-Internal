'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import {
  calculateTruckloadTotals,
  formatCurrency,
} from '@/lib/driver-pay/calculations'
import type { PayrollDriver, PayrollTruckload } from '@/lib/driver-pay/types'

interface PaySummaryProps {
  driver: PayrollDriver
  truckload: PayrollTruckload
}

interface MathLineProps {
  label: string
  value: number
  type?: 'add' | 'subtract' | 'neutral'
  bold?: boolean
}

function MathLine({ label, value, type = 'neutral', bold = false }: MathLineProps) {
  const sign = type === 'subtract' ? '−' : type === 'add' ? '+' : ''
  const valueColor =
    type === 'subtract'
      ? 'text-red-700'
      : type === 'add'
      ? 'text-green-700'
      : 'text-gray-900'

  return (
    <div
      className={`flex items-center justify-between text-sm py-1 ${
        bold ? 'font-bold' : ''
      }`}
    >
      <span className={bold ? 'text-gray-900' : 'text-gray-600'}>{label}</span>
      <span className={`font-medium ${valueColor}`}>
        {type !== 'neutral' && value === 0 ? '—' : `${sign}${formatCurrency(value)}`}
      </span>
    </div>
  )
}

export function PaySummary({ driver, truckload }: PaySummaryProps) {
  const totals = calculateTruckloadTotals(
    truckload,
    driver.loadPercentage,
    driver.miscDrivingRate
  )

  const isAuto = truckload.payCalculationMethod === 'automatic'
  const isHourly = truckload.payCalculationMethod === 'hourly'
  const isManual = truckload.payCalculationMethod === 'manual'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card className="p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Load Value
        </h4>
        <div className="space-y-0.5">
          <MathLine label="Order quotes" value={totals.totalQuotes} />
          {totals.pickupDeliveryDeductionsFromLoadValue > 0 && (
            <MathLine
              label="Pickup/delivery deductions"
              value={totals.pickupDeliveryDeductionsFromLoadValue}
              type="subtract"
            />
          )}
          {totals.manualDeductionsFromLoadValue > 0 && (
            <MathLine
              label="Manual deductions"
              value={totals.manualDeductionsFromLoadValue}
              type="subtract"
            />
          )}
          {totals.splitLoadDeductionsFromLoadValue > 0 && (
            <MathLine
              label="Split load deductions"
              value={totals.splitLoadDeductionsFromLoadValue}
              type="subtract"
            />
          )}
          {totals.manualAdditionsToLoadValue > 0 && (
            <MathLine
              label="Manual additions"
              value={totals.manualAdditionsToLoadValue}
              type="add"
            />
          )}
          {totals.splitLoadAdditionsToLoadValue > 0 && (
            <MathLine
              label="Split load additions"
              value={totals.splitLoadAdditionsToLoadValue}
              type="add"
            />
          )}
          <div className="border-t pt-1 mt-1">
            <MathLine label="Load Value" value={totals.loadValue} bold />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Driver Pay
          {isHourly && <span className="ml-2 text-amber-700">· Hourly</span>}
          {isManual && <span className="ml-2 text-purple-700">· Manual</span>}
        </h4>
        <div className="space-y-0.5">
          {isAuto && (
            <>
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600">
                  Load Value × {driver.loadPercentage}%
                </span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(totals.baseDriverPay)}
                </span>
              </div>
              {totals.pickupDeliveryDeductionsFromDriverPay > 0 && (
                <MathLine
                  label="Pickup/delivery deductions"
                  value={totals.pickupDeliveryDeductionsFromDriverPay}
                  type="subtract"
                />
              )}
              {totals.manualDeductionsFromDriverPay > 0 && (
                <MathLine
                  label="Manual deductions"
                  value={totals.manualDeductionsFromDriverPay}
                  type="subtract"
                />
              )}
              {totals.splitLoadDeductionsFromDriverPay > 0 && (
                <MathLine
                  label="Split load deductions"
                  value={totals.splitLoadDeductionsFromDriverPay}
                  type="subtract"
                />
              )}
              {totals.manualAdditionsToDriverPay > 0 && (
                <MathLine
                  label="Manual additions"
                  value={totals.manualAdditionsToDriverPay}
                  type="add"
                />
              )}
              {totals.splitLoadAdditionsToDriverPay > 0 && (
                <MathLine
                  label="Split load additions"
                  value={totals.splitLoadAdditionsToDriverPay}
                  type="add"
                />
              )}
            </>
          )}

          {isHourly && (
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-600">
                {(truckload.payHours ?? 0).toFixed(2)} hr × $
                {driver.miscDrivingRate.toFixed(2)}/hr
              </span>
              <span className="font-medium text-gray-900">
                {formatCurrency(totals.driverPay)}
              </span>
            </div>
          )}

          {isManual && (
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-600">Manual amount</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(totals.driverPay)}
              </span>
            </div>
          )}

          <div className="border-t pt-1 mt-1">
            <MathLine label="Final Driver Pay" value={totals.driverPay} bold />
          </div>
        </div>
      </Card>
    </div>
  )
}
