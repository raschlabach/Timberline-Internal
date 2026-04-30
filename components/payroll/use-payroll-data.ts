'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { adaptDriversResponse } from '@/lib/driver-pay/api-adapter'
import type { PayrollDriver } from '@/lib/driver-pay/types'
import { formatYmd } from '@/lib/driver-pay/date-helpers'

interface UsePayrollDataResult {
  drivers: PayrollDriver[]
  isLoading: boolean
  refetch: () => Promise<void>
  setDrivers: React.Dispatch<React.SetStateAction<PayrollDriver[]>>
}

export function usePayrollData(
  startDate: Date | undefined,
  endDate: Date | undefined
): UsePayrollDataResult {
  const [drivers, setDrivers] = useState<PayrollDriver[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return
    setIsLoading(true)
    try {
      // Reconcile any pending split-load delays first. If a split was created
      // earlier with no other-truckload (because the delivery wasn't yet
      // assigned), and that other half has since landed on a truckload, this
      // call creates the matching pair entry automatically.
      try {
        await fetch('/api/payroll/reconcile-splits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })
      } catch {
        // Reconcile failures shouldn't block the page from loading.
      }

      const params = new URLSearchParams({
        startDate: formatYmd(startDate),
        endDate: formatYmd(endDate),
      })
      const response = await fetch(`/api/drivers/pay-data?${params.toString()}`)
      const raw = await response.json()
      if (!raw?.success) {
        toast.error('Failed to load driver pay data')
        setDrivers([])
        return
      }
      setDrivers(adaptDriversResponse(raw))
    } catch (error) {
      console.error('Error fetching payroll data:', error)
      toast.error('Failed to load driver pay data')
      setDrivers([])
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { drivers, isLoading, refetch: fetchData, setDrivers }
}
