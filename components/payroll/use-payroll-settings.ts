'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface UsePayrollSettingsResult {
  fuelSurchargePercentage: number
  isLoading: boolean
  isUpdating: boolean
  // Refresh from the server (e.g. after another tab updated it).
  refresh: () => Promise<void>
  // Persist a new value. Server enforces admin auth.
  saveFuelSurchargePercentage: (next: number) => Promise<boolean>
}

// Hook owning the global payroll settings fetched from
// /api/payroll/settings. Loads once on mount; admin updates via
// saveFuelSurchargePercentage. Non-admin users get a graceful 403
// surfaced as a toast.
export function usePayrollSettings(): UsePayrollSettingsResult {
  const [fuelSurchargePercentage, setFuelSurchargePercentage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/payroll/settings', {
        credentials: 'include',
      })
      const data = await response.json()
      if (data?.success && data.settings) {
        setFuelSurchargePercentage(
          Number.isFinite(data.settings.fuelSurchargePercentage)
            ? data.settings.fuelSurchargePercentage
            : 0
        )
      }
    } catch (error) {
      console.error('Error loading payroll settings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveFuelSurchargePercentage = useCallback(
    async (next: number): Promise<boolean> => {
      if (!Number.isFinite(next) || next < 0 || next > 100) {
        toast.error('Surcharge must be between 0 and 100')
        return false
      }
      setIsUpdating(true)
      try {
        const response = await fetch('/api/payroll/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fuelSurchargePercentage: next }),
        })
        const data = await response.json()
        if (!response.ok || !data?.success) {
          toast.error(data?.error || 'Failed to update surcharge')
          return false
        }
        const updated = data.settings?.fuelSurchargePercentage
        if (Number.isFinite(updated)) {
          setFuelSurchargePercentage(updated)
        }
        toast.success(`Fuel surcharge updated to ${next.toFixed(2)}%`)
        return true
      } catch (error) {
        console.error('Error saving payroll settings:', error)
        toast.error('Failed to update surcharge')
        return false
      } finally {
        setIsUpdating(false)
      }
    },
    []
  )

  return {
    fuelSurchargePercentage,
    isLoading,
    isUpdating,
    refresh,
    saveFuelSurchargePercentage,
  }
}
