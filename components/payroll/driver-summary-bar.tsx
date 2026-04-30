'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  calculateDriverWeeklyTotals,
  formatCurrency,
} from '@/lib/driver-pay/calculations'
import type { PayrollDriver } from '@/lib/driver-pay/types'

interface DriverSummaryBarProps {
  driver: PayrollDriver
  onEditSettings: () => void
}

interface SummaryStatProps {
  label: string
  value: string
  sublabel?: string
  emphasis?: 'default' | 'primary' | 'positive'
}

function SummaryStat({ label, value, sublabel, emphasis = 'default' }: SummaryStatProps) {
  const valueClass =
    emphasis === 'primary'
      ? 'text-blue-700'
      : emphasis === 'positive'
      ? 'text-green-700'
      : 'text-gray-900'
  return (
    <div className="flex flex-col min-w-[110px]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className={`text-base font-bold leading-tight ${valueClass}`}>{value}</span>
      {sublabel && <span className="text-[11px] text-gray-500 leading-tight">{sublabel}</span>}
    </div>
  )
}

interface PayBreakdownProps {
  totals: ReturnType<typeof calculateDriverWeeklyTotals>
}

function PayBreakdown({ totals }: PayBreakdownProps) {
  const showAuto = totals.automaticLoadCount > 0
  const showHourly = totals.hourlyLoadCount > 0
  const showManual = totals.manualLoadCount > 0
  const hasAnyBreakdown = showAuto || showHourly || showManual

  return (
    <div className="flex flex-col min-w-[170px]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        Load Pay
      </span>
      {hasAnyBreakdown ? (
        <div className="space-y-0.5 mb-0.5">
          {showAuto && (
            <div className="flex items-center justify-between text-[11px] leading-tight">
              <span className="text-gray-500">
                Auto ({totals.automaticLoadCount})
              </span>
              <span className="font-medium text-gray-700 ml-2">
                {formatCurrency(totals.automaticPayTotal)}
              </span>
            </div>
          )}
          {showHourly && (
            <div className="flex items-center justify-between text-[11px] leading-tight">
              <span className="text-gray-500">
                Hourly ({totals.hourlyLoadCount})
              </span>
              <span className="font-medium text-gray-700 ml-2">
                {formatCurrency(totals.hourlyPayTotal)}
              </span>
            </div>
          )}
          {showManual && (
            <div className="flex items-center justify-between text-[11px] leading-tight">
              <span className="text-gray-500">
                Manual ({totals.manualLoadCount})
              </span>
              <span className="font-medium text-gray-700 ml-2">
                {formatCurrency(totals.manualPayTotal)}
              </span>
            </div>
          )}
        </div>
      ) : null}
      <div className="flex items-center justify-between border-t border-gray-200 pt-0.5">
        <span className="text-[11px] font-semibold text-gray-700">Total</span>
        <span className="text-base font-bold leading-tight text-gray-900 ml-2">
          {formatCurrency(totals.truckloadDriverPayTotal)}
        </span>
      </div>
    </div>
  )
}

export function DriverSummaryBar({ driver, onEditSettings }: DriverSummaryBarProps) {
  const totals = calculateDriverWeeklyTotals(driver)
  const truckloadCount = driver.truckloads.length

  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex flex-col min-w-[140px]">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: driver.driverColor || '#808080' }}
            />
            <span className="font-semibold text-gray-900 truncate">
              {driver.driverName}
            </span>
          </div>
          <span className="text-[11px] text-gray-500 leading-tight ml-5">
            Default: {driver.defaultPayMethod === 'automatic'
              ? 'Auto'
              : driver.defaultPayMethod === 'hourly'
              ? 'Hourly'
              : 'Manual'}
          </span>
        </div>

        <div className="h-10 w-px bg-gray-200" />

        <SummaryStat label="Loads" value={String(truckloadCount)} />
        <SummaryStat
          label="Load Value"
          value={formatCurrency(totals.loadValue)}
          sublabel={`${driver.loadPercentage}% rate`}
        />
        <PayBreakdown totals={totals} />

        <div className="h-10 w-px bg-gray-200" />

        <SummaryStat
          label="Misc Driving"
          value={`${totals.miscDrivingHours.toFixed(2)} hr`}
          sublabel={`${formatCurrency(totals.miscDrivingTotal)} @ $${driver.miscDrivingRate.toFixed(2)}/hr`}
        />
        <SummaryStat
          label="Maintenance"
          value={`${totals.maintenanceHours.toFixed(2)} hr`}
          sublabel={`${formatCurrency(totals.maintenanceTotal)} @ $${driver.maintenanceRate.toFixed(2)}/hr`}
        />

        <div className="h-10 w-px bg-gray-200" />

        <SummaryStat
          label="Weekly Pay"
          value={formatCurrency(totals.weeklyDriverPay)}
          emphasis="primary"
        />

        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={onEditSettings} className="h-8">
            <Edit2 className="h-3.5 w-3.5 mr-1" />
            Settings
          </Button>
        </div>
      </div>
    </Card>
  )
}
