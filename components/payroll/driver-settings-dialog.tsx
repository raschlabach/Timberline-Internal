'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PayCalculationMethod, PayrollDriver } from '@/lib/driver-pay/types'

interface DriverSettingsDialogProps {
  driver: PayrollDriver | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (updated: {
    loadPercentage: number
    miscDrivingRate: number
    maintenanceRate: number
    defaultPayMethod: PayCalculationMethod
  }) => void
}

export function DriverSettingsDialog({
  driver,
  open,
  onOpenChange,
  onSaved,
}: DriverSettingsDialogProps) {
  const [loadPercentage, setLoadPercentage] = useState('')
  const [miscDrivingRate, setMiscDrivingRate] = useState('')
  const [maintenanceRate, setMaintenanceRate] = useState('')
  const [defaultPayMethod, setDefaultPayMethod] = useState<PayCalculationMethod>('automatic')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (driver) {
      setLoadPercentage(String(driver.loadPercentage))
      setMiscDrivingRate(String(driver.miscDrivingRate))
      setMaintenanceRate(String(driver.maintenanceRate))
      setDefaultPayMethod(driver.defaultPayMethod)
    }
  }, [driver])

  async function handleSave() {
    if (!driver) return
    const lp = parseFloat(loadPercentage)
    const mdr = parseFloat(miscDrivingRate)
    const mr = parseFloat(maintenanceRate)

    if (![lp, mdr, mr].every((v) => Number.isFinite(v) && v >= 0)) {
      toast.error('All values must be valid non-negative numbers')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/drivers/pay-settings/${driver.driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          loadPercentage: lp,
          miscDrivingRate: mdr,
          maintenanceRate: mr,
          defaultPayMethod,
        }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to save settings')

      onSaved({
        loadPercentage: lp,
        miscDrivingRate: mdr,
        maintenanceRate: mr,
        defaultPayMethod,
      })
      onOpenChange(false)
      toast.success('Driver settings saved')
    } catch (error) {
      console.error('Error saving driver settings:', error)
      toast.error('Failed to save driver settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Driver Settings</DialogTitle>
          <DialogDescription>
            {driver ? `Pay settings for ${driver.driverName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 items-center gap-3">
            <Label htmlFor="loadPercentage" className="text-sm">
              Load %
            </Label>
            <Input
              id="loadPercentage"
              type="number"
              value={loadPercentage}
              onChange={(e) => setLoadPercentage(e.target.value)}
              className="col-span-2"
              step="0.01"
              min="0"
              max="100"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <Label htmlFor="miscDrivingRate" className="text-sm">
              Misc Driving Rate
            </Label>
            <Input
              id="miscDrivingRate"
              type="number"
              value={miscDrivingRate}
              onChange={(e) => setMiscDrivingRate(e.target.value)}
              className="col-span-2"
              step="0.01"
              min="0"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <Label htmlFor="maintenanceRate" className="text-sm">
              Maintenance Rate
            </Label>
            <Input
              id="maintenanceRate"
              type="number"
              value={maintenanceRate}
              onChange={(e) => setMaintenanceRate(e.target.value)}
              className="col-span-2"
              step="0.01"
              min="0"
            />
          </div>

          <div className="grid grid-cols-3 items-start gap-3 pt-2 border-t">
            <Label className="text-sm pt-1.5">Default Pay Method</Label>
            <div className="col-span-2 space-y-2">
              <div className="grid grid-cols-3 gap-1">
                <Button
                  type="button"
                  variant={defaultPayMethod === 'automatic' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDefaultPayMethod('automatic')}
                  className="h-8 text-xs"
                >
                  Auto
                </Button>
                <Button
                  type="button"
                  variant={defaultPayMethod === 'hourly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDefaultPayMethod('hourly')}
                  className="h-8 text-xs"
                >
                  Hourly
                </Button>
                <Button
                  type="button"
                  variant={defaultPayMethod === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDefaultPayMethod('manual')}
                  className="h-8 text-xs"
                >
                  Manual
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 leading-tight">
                Used as the starting method when a new truckload is created for
                this driver. Existing loads are unchanged.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
