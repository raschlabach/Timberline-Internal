'use client'

import React from 'react'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getThisWeek, getLastWeek } from '@/lib/driver-pay/date-helpers'
import type { PayrollDriver } from '@/lib/driver-pay/types'
import { FuelSurchargePill } from './fuel-surcharge-pill'

interface HeaderBarProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  drivers: PayrollDriver[]
  selectedDriverId: number | null
  onSelectDriver: (driverId: number) => void
  fuelSurchargePercentage: number
  isSurchargeUpdating: boolean
  onSaveSurcharge: (next: number) => Promise<boolean>
}

export function HeaderBar({
  dateRange,
  onDateRangeChange,
  drivers,
  selectedDriverId,
  onSelectDriver,
  fuelSurchargePercentage,
  isSurchargeUpdating,
  onSaveSurcharge,
}: HeaderBarProps) {
  const handleThisWeek = () => {
    const week = getThisWeek()
    onDateRangeChange({ from: week.start, to: week.end })
  }

  const handleLastWeek = () => {
    const week = getLastWeek()
    onDateRangeChange({ from: week.start, to: week.end })
  }

  return (
    <div className="flex-shrink-0 px-6 py-4 border-b bg-white">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>

        <div className="flex items-center gap-2">
          <FuelSurchargePill
            fuelSurchargePercentage={fuelSurchargePercentage}
            isUpdating={isSurchargeUpdating}
            onSave={onSaveSurcharge}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange?.to ? (
                    <>
                      {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                    </>
                  ) : (
                    format(dateRange.from, 'LLL dd, y')
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={onDateRangeChange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={handleThisWeek}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={handleLastWeek}>
            Last Week
          </Button>
        </div>
      </div>

      {drivers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span className="text-sm font-medium text-gray-600 mr-1">Driver:</span>
          {drivers.map((driver) => {
            const isActive = selectedDriverId === driver.driverId
            return (
              <Button
                key={driver.driverId}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSelectDriver(driver.driverId)}
                className="text-xs h-7"
              >
                <div
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: driver.driverColor || '#808080' }}
                />
                {driver.driverName}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
