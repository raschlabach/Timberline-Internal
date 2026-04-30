'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderBar } from './header-bar'
import { DriverSummaryBar } from './driver-summary-bar'
import { DriverHoursCard } from './driver-hours-card'
import { DriverSettingsDialog } from './driver-settings-dialog'
import { TruckloadList } from './truckload-list'
import { TruckloadDetail } from './truckload-detail'
import { usePayrollData } from './use-payroll-data'
import { usePayrollSettings } from './use-payroll-settings'
import { getLastWeek } from '@/lib/driver-pay/date-helpers'
import type {
  PayCalculationMethod,
  PayrollAdjustment,
  PayrollOrder,
  PayrollTruckload,
} from '@/lib/driver-pay/types'

export default function PayrollPage() {
  const lastWeek = useMemo(() => getLastWeek(), [])
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: lastWeek.start,
    to: lastWeek.end,
  })
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)
  const [expandedTruckloadId, setExpandedTruckloadId] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { drivers, isLoading, setDrivers, refetch } = usePayrollData(dateRange?.from, dateRange?.to)
  const {
    fuelSurchargePercentage,
    isUpdating: isSurchargeUpdating,
    saveFuelSurchargePercentage,
  } = usePayrollSettings()

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.driverId === selectedDriverId) ?? null,
    [drivers, selectedDriverId]
  )

  const expandedTruckload = useMemo(() => {
    if (expandedTruckloadId === null || !selectedDriver) return null
    return selectedDriver.truckloads.find((t) => t.id === expandedTruckloadId) ?? null
  }, [selectedDriver, expandedTruckloadId])

  // Auto-select first driver when data loads and nothing is selected.
  useEffect(() => {
    if (drivers.length > 0 && selectedDriverId === null) {
      setSelectedDriverId(drivers[0].driverId)
    }
  }, [drivers, selectedDriverId])

  // Collapse the detail when switching drivers or date range.
  useEffect(() => {
    setExpandedTruckloadId(null)
  }, [selectedDriverId, dateRange])

  function handleHoursChange(updatedHours: typeof drivers[number]['hours']) {
    if (!selectedDriver) return
    setDrivers((prev) =>
      prev.map((d) =>
        d.driverId === selectedDriver.driverId ? { ...d, hours: updatedHours } : d
      )
    )
  }

  function handleSettingsSaved(values: {
    loadPercentage: number
    miscDrivingRate: number
    maintenanceRate: number
    defaultPayMethod: PayCalculationMethod
  }) {
    if (!selectedDriver) return
    setDrivers((prev) =>
      prev.map((d) => (d.driverId === selectedDriver.driverId ? { ...d, ...values } : d))
    )
  }

  function handleTruckloadUpdate(
    truckloadId: number,
    updates: Partial<PayrollTruckload>
  ) {
    if (!selectedDriver) return
    setDrivers((prev) =>
      prev.map((d) => {
        if (d.driverId !== selectedDriver.driverId) return d
        return {
          ...d,
          truckloads: d.truckloads.map((tl) =>
            tl.id === truckloadId ? { ...tl, ...updates } : tl
          ),
        }
      })
    )
  }

  function handleOrdersReplace(truckloadId: number, orders: PayrollOrder[]) {
    handleTruckloadUpdate(truckloadId, { orders })
  }

  function handleAdjustmentsReplace(
    truckloadId: number,
    adjustments: PayrollAdjustment[]
  ) {
    handleTruckloadUpdate(truckloadId, { adjustments })
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <HeaderBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        drivers={drivers}
        selectedDriverId={selectedDriverId}
        onSelectDriver={setSelectedDriverId}
        fuelSurchargePercentage={fuelSurchargePercentage}
        isSurchargeUpdating={isSurchargeUpdating}
        onSaveSurcharge={saveFuelSurchargePercentage}
      />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading && (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          )}

          {!isLoading && drivers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No driver pay data for this date range.
            </div>
          )}

          {!isLoading && selectedDriver && (
            <>
              <DriverSummaryBar
                driver={selectedDriver}
                onEditSettings={() => setSettingsOpen(true)}
              />

              {expandedTruckload ? (
                <TruckloadDetail
                  driver={selectedDriver}
                  truckload={expandedTruckload}
                  fuelSurchargePercentage={fuelSurchargePercentage}
                  onBack={() => setExpandedTruckloadId(null)}
                  onTruckloadUpdate={(updates) =>
                    handleTruckloadUpdate(expandedTruckload.id, updates)
                  }
                  onOrdersReplace={(orders) =>
                    handleOrdersReplace(expandedTruckload.id, orders)
                  }
                  onAdjustmentsReplace={(adjustments) =>
                    handleAdjustmentsReplace(expandedTruckload.id, adjustments)
                  }
                  onRefetch={refetch}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <TruckloadList
                      driver={selectedDriver}
                      onTruckloadOpen={(id) => setExpandedTruckloadId(id)}
                      onTruckloadUpdate={handleTruckloadUpdate}
                    />
                  </div>
                  <div>
                    <DriverHoursCard
                      driver={selectedDriver}
                      onChange={handleHoursChange}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <DriverSettingsDialog
        driver={selectedDriver}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={handleSettingsSaved}
      />
    </div>
  )
}
