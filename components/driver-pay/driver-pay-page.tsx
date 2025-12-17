'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format, parse } from 'date-fns'

// Helper to parse YYYY-MM-DD dates as local dates (avoid timezone issues)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}
import { CalendarIcon, Edit2, Save, X, Plus, Trash2, DollarSign, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { DateRange } from 'react-day-picker'

interface DriverPayPageProps {}

interface DriverPaySettings {
  driverId: number
  loadPercentage: number
  miscDrivingRate: number
  maintenanceRate: number
}

interface DriverHour {
  id: number
  date: string
  description: string | null
  hours: number
  type: 'misc_driving' | 'maintenance'
}

interface Deduction {
  id: number
  driverName: string | null
  date: string
  action: string | null
  footage: number
  dimensions: string | null
  deduction: number
  isManual: boolean
  comment: string | null
  isAddition?: boolean
  appliesTo?: 'load_value' | 'driver_pay' // For manual items: whether it applies to load value or driver pay. Defaults to 'driver_pay'
  customerName?: string | null // Customer name for pickup/delivery (for automatic items)
}

interface Order {
  orderId: number
  assignmentType: 'pickup' | 'delivery'
  freightQuote: number | null
  footage: number
  pickupCustomerName: string | null
  deliveryCustomerName: string | null
  middlefield?: boolean
}

interface Truckload {
  id: number
  startDate: string
  endDate: string
  billOfLadingNumber: string | null
  description: string | null
  orders: Order[]
  deductions: Deduction[]
  payCalculationMethod?: 'automatic' | 'hourly' | 'manual'
  payHours?: number | null
  payManualAmount?: number | null
  calculatedLoadValue?: number | null
  calculatedDriverPay?: number | null
  calculatedAt?: string | null
}

interface DriverData {
  driverId: number
  driverName: string
  driverColor: string | null
  loadPercentage: number
  miscDrivingRate: number
  maintenanceRate: number
  truckloads: Truckload[]
  hours: DriverHour[]
}

interface PayDataResponse {
  success: boolean
  drivers: DriverData[]
}

// Calculate last week (Sunday-Saturday)
function getLastWeekRange(): { start: Date; end: Date } {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - dayOfWeek - 7)
  lastSunday.setHours(0, 0, 0, 0)
  
  const lastSaturday = new Date(lastSunday)
  lastSaturday.setDate(lastSunday.getDate() + 6)
  lastSaturday.setHours(23, 59, 59, 999)
  
  return { start: lastSunday, end: lastSaturday }
}

// Calculate this week (Sunday-Saturday)
function getThisWeekRange(): { start: Date; end: Date } {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
  const thisSunday = new Date(today)
  thisSunday.setDate(today.getDate() - dayOfWeek)
  thisSunday.setHours(0, 0, 0, 0)
  
  const thisSaturday = new Date(thisSunday)
  thisSaturday.setDate(thisSunday.getDate() + 6)
  thisSaturday.setHours(23, 59, 59, 999)
  
  return { start: thisSunday, end: thisSaturday }
}

export default function DriverPayPage({}: DriverPayPageProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Read URL parameters for state restoration
  const urlDriverId = searchParams?.get('driverId')
  const urlStartDate = searchParams?.get('startDate')
  const urlEndDate = searchParams?.get('endDate')
  
  const lastWeek = getLastWeekRange()
  
  // Initialize date range from URL or default to last week
  const initialDateRange = useMemo(() => {
    if (urlStartDate && urlEndDate) {
      try {
        const start = parse(urlStartDate, 'yyyy-MM-dd', new Date())
        const end = parse(urlEndDate, 'yyyy-MM-dd', new Date())
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          return { from: start, to: end }
        }
      } catch (e) {
        // Fall back to default
      }
    }
    return { from: lastWeek.start, to: lastWeek.end }
  }, [urlStartDate, urlEndDate, lastWeek])
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange)
  const [drivers, setDrivers] = useState<DriverData[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [editingSettings, setEditingSettings] = useState(false)
  const [tempSettings, setTempSettings] = useState<DriverPaySettings | null>(null)
  const [newHour, setNewHour] = useState<{ date: string; description: string; hours: number; type: 'misc_driving' | 'maintenance' } | null>(null)
  const [editingHour, setEditingHour] = useState<{ id: number; date: string; description: string; hours: number; type: 'misc_driving' | 'maintenance' } | null>(null)
  const [editingPayMethod, setEditingPayMethod] = useState<number | null>(null)
  const [tempPayMethod, setTempPayMethod] = useState<{ method: 'automatic' | 'hourly' | 'manual'; hours?: number; amount?: number } | null>(null)
  const hasInitializedFromUrl = useRef(false)
  
  // Restore date range from URL when params change (only on initial load, not when user changes it)
  useEffect(() => {
    if (urlStartDate && urlEndDate && !hasInitializedFromUrl.current) {
      try {
        const start = parse(urlStartDate, 'yyyy-MM-dd', new Date())
        const end = parse(urlEndDate, 'yyyy-MM-dd', new Date())
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          setDateRange({ from: start, to: end })
          hasInitializedFromUrl.current = true
        }
      } catch (e) {
        // Invalid date format, ignore
        hasInitializedFromUrl.current = true
      }
    } else if (!urlStartDate && !urlEndDate && !hasInitializedFromUrl.current) {
      // If no URL params, mark as initialized so we don't interfere
      hasInitializedFromUrl.current = true
    }
  }, [urlStartDate, urlEndDate])
  
  // Restore driver selection from URL (only on initial load, not when user manually selects)
  const hasRestoredFromUrl = useRef(false)
  useEffect(() => {
    if (urlDriverId && drivers.length > 0 && !hasRestoredFromUrl.current) {
      const driverIdNum = parseInt(urlDriverId, 10)
      const driverExists = drivers.some(d => d.driverId === driverIdNum)
      if (driverExists) {
        setSelectedDriverId(driverIdNum)
        hasRestoredFromUrl.current = true
      }
    } else if (!urlDriverId && hasRestoredFromUrl.current) {
      // Reset flag if URL param is removed
      hasRestoredFromUrl.current = false
    }
  }, [urlDriverId, drivers])

  // Fetch driver pay data
  const fetchPayData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return

    setIsLoading(true)
    try {
      const startDate = format(dateRange.from, 'yyyy-MM-dd')
      const endDate = format(dateRange.to, 'yyyy-MM-dd')
      
      const response = await fetch(`/api/drivers/pay-data?startDate=${startDate}&endDate=${endDate}`)
      const data: PayDataResponse = await response.json()
      
      if (data.success) {
        setDrivers(data.drivers)
        // Select first driver by default (only if not restoring from URL)
        if (data.drivers.length > 0 && !selectedDriverId && !hasRestoredFromUrl.current) {
          setSelectedDriverId(data.drivers[0].driverId)
          setTempSettings({
            driverId: data.drivers[0].driverId,
            loadPercentage: data.drivers[0].loadPercentage,
            miscDrivingRate: data.drivers[0].miscDrivingRate,
            maintenanceRate: data.drivers[0].maintenanceRate
          })
        }
      } else {
        toast.error('Failed to load driver pay data')
      }
    } catch (error) {
      console.error('Error fetching pay data:', error)
      toast.error('Failed to load driver pay data')
    } finally {
      setIsLoading(false)
    }
  }, [dateRange, selectedDriverId])

  useEffect(() => {
    fetchPayData()
  }, [fetchPayData])

  // Update selected driver when drivers change (only if no driver is selected and not restoring from URL)
  useEffect(() => {
    if (drivers.length > 0 && !selectedDriverId && !hasRestoredFromUrl.current) {
      setSelectedDriverId(drivers[0].driverId)
      setTempSettings({
        driverId: drivers[0].driverId,
        loadPercentage: drivers[0].loadPercentage,
        miscDrivingRate: drivers[0].miscDrivingRate,
        maintenanceRate: drivers[0].maintenanceRate
      })
    }
  }, [drivers, selectedDriverId])

  const selectedDriver = useMemo(() => 
    drivers.find(d => d.driverId === selectedDriverId) || null,
    [drivers, selectedDriverId]
  )

  // Start editing driver settings
  const startEditSettings = () => {
    if (selectedDriver) {
      setTempSettings({
        driverId: selectedDriver.driverId,
        loadPercentage: selectedDriver.loadPercentage,
        miscDrivingRate: selectedDriver.miscDrivingRate,
        maintenanceRate: selectedDriver.maintenanceRate
      })
      setEditingSettings(true)
    }
  }

  // Cancel editing driver settings
  const cancelEditSettings = () => {
    if (selectedDriver) {
      setTempSettings({
        driverId: selectedDriver.driverId,
        loadPercentage: selectedDriver.loadPercentage,
        miscDrivingRate: selectedDriver.miscDrivingRate,
        maintenanceRate: selectedDriver.maintenanceRate
      })
    }
    setEditingSettings(false)
  }

  // Save driver settings
  const saveDriverSettings = async () => {
    if (!tempSettings) return

    try {
      const response = await fetch(`/api/drivers/pay-settings/${tempSettings.driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadPercentage: tempSettings.loadPercentage,
          miscDrivingRate: tempSettings.miscDrivingRate,
          maintenanceRate: tempSettings.maintenanceRate
        })
      })

      const data = await response.json()
      if (data.success) {
        setDrivers(prev => prev.map(driver => 
          driver.driverId === tempSettings.driverId
            ? { 
                ...driver, 
                loadPercentage: tempSettings.loadPercentage, 
                miscDrivingRate: tempSettings.miscDrivingRate,
                maintenanceRate: tempSettings.maintenanceRate
              }
            : driver
        ))
        setEditingSettings(false)
        toast.success('Driver settings saved')
      } else {
        toast.error('Failed to save driver settings')
      }
    } catch (error) {
      console.error('Error saving driver settings:', error)
      toast.error('Failed to save driver settings')
    }
  }

  // Add driver hour
  const addDriverHour = async () => {
    if (!selectedDriver || !newHour || !newHour.date || !newHour.hours || !newHour.type) {
      toast.error('Please fill in date, hours, and type')
      return
    }

    // Validate hours is a positive number
    if (newHour.hours <= 0) {
      toast.error('Hours must be greater than 0')
      return
    }

    try {
      // Parse date as local date to avoid timezone issues (YYYY-MM-DD format)
      const dateStr = newHour.date
      // Ensure date is in YYYY-MM-DD format (date input already provides this)
      
      const response = await fetch(`/api/drivers/hours/${selectedDriver.driverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: dateStr, // Already in YYYY-MM-DD format from date input
          description: newHour.description || null,
          hours: parseFloat(String(newHour.hours)),
          type: newHour.type
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to add driver hour`)
      }

      const data = await response.json()
      if (data.success && data.hour) {
        setDrivers(prev => prev.map(driver =>
          driver.driverId === selectedDriver.driverId
            ? { ...driver, hours: [...driver.hours, data.hour] }
            : driver
        ))
        setNewHour(null)
        toast.success('Driver hour added')
      } else {
        throw new Error(data.error || 'Failed to add driver hour')
      }
    } catch (error) {
      console.error('Error adding driver hour:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add driver hour')
    }
  }

  // Update driver hour
  const updateDriverHour = async () => {
    if (!selectedDriver || !editingHour || !editingHour.date || !editingHour.hours || !editingHour.type) {
      toast.error('Please fill in date, hours, and type')
      return
    }

    // Validate hours is a positive number
    if (editingHour.hours <= 0) {
      toast.error('Hours must be greater than 0')
      return
    }

    try {
      const dateStr = editingHour.date
      
      const response = await fetch(`/api/drivers/hours/${selectedDriver.driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editingHour.id,
          date: dateStr,
          description: editingHour.description || null,
          hours: parseFloat(String(editingHour.hours)),
          type: editingHour.type
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update driver hour`)
      }

      const data = await response.json()
      if (data.success && data.hour) {
        setDrivers(prev => prev.map(driver =>
          driver.driverId === selectedDriver.driverId
            ? { ...driver, hours: driver.hours.map(h => h.id === editingHour.id ? data.hour : h) }
            : driver
        ))
        setEditingHour(null)
        toast.success('Driver hour updated')
      } else {
        throw new Error(data.error || 'Failed to update driver hour')
      }
    } catch (error) {
      console.error('Error updating driver hour:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update driver hour')
    }
  }

  // Delete driver hour
  const deleteDriverHour = async (hourId: number) => {
    if (!selectedDriver) return

    try {
      const response = await fetch(`/api/drivers/hours/${selectedDriver.driverId}?id=${hourId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to delete driver hour`)
      }

      const data = await response.json()
      if (data.success) {
        setDrivers(prev => prev.map(driver =>
          driver.driverId === selectedDriver.driverId
            ? { ...driver, hours: driver.hours.filter(h => h.id !== hourId) }
            : driver
        ))
        toast.success('Driver hour deleted')
      } else {
        throw new Error(data.error || 'Failed to delete driver hour')
      }
    } catch (error) {
      console.error('Error deleting driver hour:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete driver hour')
    }
  }

  // Calculate totals for a truckload with detailed breakdown
  const calculateTruckloadTotals = (truckload: Truckload) => {
    // Group orders by orderId to combine transfer orders (same as Invoice page)
    const orderGroups = new Map<number, Order[]>()
    truckload.orders.forEach(order => {
      const existing = orderGroups.get(order.orderId) || []
      existing.push(order)
      orderGroups.set(order.orderId, existing)
    })
    
    // Calculate total quotes from grouped orders (each order counted once, same as Invoice page)
    const totalQuotes = Array.from(orderGroups.values()).reduce((sum, groupOrders) => {
      // For transfer orders (both pickup and delivery), only count once
      // For non-transfer orders, count each one
      const hasPickup = groupOrders.some(o => o.assignmentType === 'pickup')
      const hasDelivery = groupOrders.some(o => o.assignmentType === 'delivery')
      const isTransfer = hasPickup && hasDelivery
      
      if (isTransfer) {
        // For transfers, use the first order's quote (they should be the same)
        const order = groupOrders[0]
        if (order.freightQuote) {
          // Parse quote string (could be "$123.45" or "123.45" or a number)
          const quoteStr = String(order.freightQuote)
          const quoteValue = parseFloat(quoteStr.replace(/[^0-9.-]/g, ''))
          return sum + (isNaN(quoteValue) ? 0 : quoteValue)
        }
      } else {
        // For non-transfers, sum all orders in the group
        return sum + groupOrders.reduce((groupSum, order) => {
          if (order.freightQuote) {
            const quoteStr = String(order.freightQuote)
            const quoteValue = parseFloat(quoteStr.replace(/[^0-9.-]/g, ''))
            return groupSum + (isNaN(quoteValue) ? 0 : quoteValue)
          }
          return groupSum
        }, 0)
      }
      return sum
    }, 0)
    
    // Count pickups and deliveries (using grouped orders to avoid double-counting transfers)
    const pickupCount = Array.from(orderGroups.values()).reduce((count, groupOrders) => {
      const hasPickup = groupOrders.some(o => o.assignmentType === 'pickup')
      const hasDelivery = groupOrders.some(o => o.assignmentType === 'delivery')
      const isTransfer = hasPickup && hasDelivery
      // For transfers, count as 1 pickup and 1 delivery
      // For non-transfers, count each assignment type
      if (isTransfer) {
        return count + 1
      } else {
        return count + groupOrders.filter(o => o.assignmentType === 'pickup').length
      }
    }, 0)
    
    const deliveryCount = Array.from(orderGroups.values()).reduce((count, groupOrders) => {
      const hasPickup = groupOrders.some(o => o.assignmentType === 'pickup')
      const hasDelivery = groupOrders.some(o => o.assignmentType === 'delivery')
      const isTransfer = hasPickup && hasDelivery
      // For transfers, count as 1 pickup and 1 delivery
      // For non-transfers, count each assignment type
      if (isTransfer) {
        return count + 1
      } else {
        return count + groupOrders.filter(o => o.assignmentType === 'delivery').length
      }
    }, 0)
    
    // Separate deductions/additions by where they apply
    // Manual items that apply to load value
    const manualDeductionsFromLoadValue = truckload.deductions.reduce((sum, deduction) => {
      if (deduction.isManual && !deduction.isAddition && deduction.appliesTo === 'load_value') {
        return sum + deduction.deduction
      }
      return sum
    }, 0)
    
    const manualAdditionsToLoadValue = truckload.deductions.reduce((sum, deduction) => {
      if (deduction.isManual && deduction.isAddition && deduction.appliesTo === 'load_value') {
        return sum + deduction.deduction
      }
      return sum
    }, 0)
    
    // Automatic deductions (always from driver pay)
    const automaticDeductions = truckload.deductions.reduce((sum, deduction) => {
      if (!deduction.isManual) {
        return sum + deduction.deduction
      }
      return sum
    }, 0)
    
    // Manual items that apply to driver pay
    const manualDeductionsFromDriverPay = truckload.deductions.reduce((sum, deduction) => {
      if (deduction.isManual && !deduction.isAddition && (deduction.appliesTo === 'driver_pay' || !deduction.appliesTo)) {
        return sum + deduction.deduction
      }
      return sum
    }, 0)
    
    const manualAdditionsToDriverPay = truckload.deductions.reduce((sum, deduction) => {
      if (deduction.isManual && deduction.isAddition && (deduction.appliesTo === 'driver_pay' || !deduction.appliesTo)) {
        return sum + deduction.deduction
      }
      return sum
    }, 0)
    
    // Use saved calculated values from Invoice page if available, otherwise calculate
    // Load value: prefer saved value, fallback to calculation
    const loadValue = truckload.calculatedLoadValue !== null && truckload.calculatedLoadValue !== undefined
      ? truckload.calculatedLoadValue
      : totalQuotes - manualDeductionsFromLoadValue + manualAdditionsToLoadValue
    
    if (truckload.calculatedLoadValue !== null && truckload.calculatedLoadValue !== undefined) {
      console.log(`[DriverPay] Using saved loadValue=${truckload.calculatedLoadValue} for truckload ${truckload.id} (calculated would be ${totalQuotes - manualDeductionsFromLoadValue + manualAdditionsToLoadValue})`)
    } else {
      console.log(`[DriverPay] Calculating loadValue=${loadValue} for truckload ${truckload.id} (no saved value)`)
    }
    
    // Calculate base driver pay (load value × percentage)
    const baseDriverPay = loadValue * (selectedDriver?.loadPercentage || 30) / 100
    
    // Calculate driver pay based on selected method
    let driverPay = 0
    const payMethod = truckload.payCalculationMethod || 'automatic'
    
    if (payMethod === 'hourly' && truckload.payHours !== null && truckload.payHours !== undefined && selectedDriver) {
      // Hourly: hours × driver hourly rate (use misc driving rate)
      driverPay = truckload.payHours * selectedDriver.miscDrivingRate
    } else if (payMethod === 'manual' && truckload.payManualAmount !== null && truckload.payManualAmount !== undefined) {
      // Manual: use entered amount
      driverPay = truckload.payManualAmount
    } else {
      // Automatic: prefer saved calculated driver pay, fallback to calculation
      if (truckload.calculatedDriverPay !== null && truckload.calculatedDriverPay !== undefined) {
        driverPay = truckload.calculatedDriverPay
        console.log(`[DriverPay] Using saved driverPay=${truckload.calculatedDriverPay} for truckload ${truckload.id} (calculated would be ${baseDriverPay - automaticDeductions - manualDeductionsFromDriverPay + manualAdditionsToDriverPay})`)
      } else {
        // Fallback calculation: base driver pay - automatic deductions - manual deductions from driver pay + manual additions to driver pay
        driverPay = baseDriverPay - automaticDeductions - manualDeductionsFromDriverPay + manualAdditionsToDriverPay
        console.log(`[DriverPay] Calculating driverPay=${driverPay} for truckload ${truckload.id} (no saved value, baseDriverPay=${baseDriverPay}, autoDed=${automaticDeductions}, manualDedDP=${manualDeductionsFromDriverPay}, manualAddDP=${manualAdditionsToDriverPay})`)
      }
    }
    
    return { 
      totalQuotes, 
      manualDeductionsFromLoadValue,
      manualAdditionsToLoadValue,
      loadValue,
      baseDriverPay,
      automaticDeductions,
      manualDeductionsFromDriverPay,
      manualAdditionsToDriverPay,
      driverPay,
      pickupCount,
      deliveryCount
    }
  }

  // Calculate totals for selected driver
  const calculateDriverTotals = () => {
    if (!selectedDriver) return null

    const totalQuotes = selectedDriver.truckloads.reduce((sum, tl) => {
      const tlTotals = calculateTruckloadTotals(tl)
      return sum + tlTotals.totalQuotes
    }, 0)

    const totalLoadValue = selectedDriver.truckloads.reduce((sum, tl) => {
      const tlTotals = calculateTruckloadTotals(tl)
      return sum + tlTotals.loadValue
    }, 0)

    // Sum all driver pay from truckloads (already includes all deductions/additions)
    const totalDriverPayFromLoads = selectedDriver.truckloads.reduce((sum, tl) => {
      const tlTotals = calculateTruckloadTotals(tl)
      return sum + tlTotals.driverPay
    }, 0)

    const miscDrivingHours = selectedDriver.hours
      .filter(h => h.type === 'misc_driving')
      .reduce((sum, hour) => sum + (typeof hour.hours === 'number' ? hour.hours : parseFloat(String(hour.hours)) || 0), 0)
    const maintenanceHours = selectedDriver.hours
      .filter(h => h.type === 'maintenance')
      .reduce((sum, hour) => sum + (typeof hour.hours === 'number' ? hour.hours : parseFloat(String(hour.hours)) || 0), 0)
    const miscDrivingTotal = miscDrivingHours * selectedDriver.miscDrivingRate
    const maintenanceTotal = maintenanceHours * selectedDriver.maintenanceRate
    
    // Weekly driver pay = sum of all truckload driver pays + misc driving + maintenance
    const weeklyDriverPay = totalDriverPayFromLoads + 
      miscDrivingTotal + 
      maintenanceTotal

    return {
      totalQuotes,
      loadValue: totalLoadValue,
      miscDrivingHours,
      miscDrivingTotal,
      maintenanceHours,
      maintenanceTotal,
      weeklyDriverPay
    }
  }

  const handleTruckloadClick = (truckloadId: number, e?: React.MouseEvent) => {
    // Don't navigate if clicking on pay method controls
    if (e && (e.target as HTMLElement).closest('.pay-method-controls')) {
      e.stopPropagation()
      return
    }
    
    if (!selectedDriverId) return
    
    const params = new URLSearchParams({
      truckloadId: String(truckloadId),
      driverId: String(selectedDriverId),
      startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
      endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
      from: 'driver-pay'
    })
    router.push(`/dashboard/invoices?${params.toString()}`)
  }

  const startEditPayMethod = (truckload: Truckload) => {
    setEditingPayMethod(truckload.id)
    setTempPayMethod({
      method: truckload.payCalculationMethod || 'automatic',
      hours: truckload.payHours || undefined,
      amount: truckload.payManualAmount || undefined
    })
  }

  const cancelEditPayMethod = () => {
    setEditingPayMethod(null)
    setTempPayMethod(null)
  }

  const savePayMethod = async (truckloadId: number) => {
    if (!tempPayMethod) return

    try {
      const updateData: any = {
        payCalculationMethod: tempPayMethod.method
      }

      if (tempPayMethod.method === 'hourly') {
        updateData.payHours = tempPayMethod.hours || 0
        updateData.payManualAmount = null
      } else if (tempPayMethod.method === 'manual') {
        updateData.payManualAmount = tempPayMethod.amount || 0
        updateData.payHours = null
      } else {
        // automatic
        updateData.payHours = null
        updateData.payManualAmount = null
      }

      const response = await fetch(`/api/truckloads/${truckloadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      })

      const data = await response.json()
      if (data.success) {
        // Update local state
        setDrivers(prev => prev.map(driver =>
          driver.driverId === selectedDriverId
            ? {
                ...driver,
                truckloads: driver.truckloads.map(tl =>
                  tl.id === truckloadId
                    ? {
                        ...tl,
                        payCalculationMethod: tempPayMethod.method,
                        payHours: tempPayMethod.method === 'hourly' ? (tempPayMethod.hours || null) : null,
                        payManualAmount: tempPayMethod.method === 'manual' ? (tempPayMethod.amount || null) : null
                      }
                    : tl
                )
              }
            : driver
        ))
        setEditingPayMethod(null)
        setTempPayMethod(null)
        toast.success('Pay method updated')
      } else {
        toast.error('Failed to update pay method')
      }
    } catch (error) {
      console.error('Error updating pay method:', error)
      toast.error('Failed to update pay method')
    }
  }

  const totals = calculateDriverTotals()

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Driver Pay</h1>
        
        {/* Date Range Selector */}
        <div className="flex items-center gap-4 mb-4">
          <Label className="text-sm font-medium">Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[300px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange?.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const thisWeek = getThisWeekRange()
              setDateRange({ from: thisWeek.start, to: thisWeek.end })
            }}
          >
            This Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const lastWeek = getLastWeekRange()
              setDateRange({ from: lastWeek.start, to: lastWeek.end })
            }}
          >
            Last Week
          </Button>
        </div>

        {/* Driver Selector - Horizontal */}
        {drivers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-sm font-medium mr-2">Drivers:</Label>
            {drivers.map(driver => (
              <Button
                key={driver.driverId}
                variant={selectedDriverId === driver.driverId ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  // Mark that we've manually selected, so URL restoration won't override
                  hasRestoredFromUrl.current = true
                  setSelectedDriverId(driver.driverId)
                  setTempSettings({
                    driverId: driver.driverId,
                    loadPercentage: driver.loadPercentage,
                    miscDrivingRate: driver.miscDrivingRate,
                    maintenanceRate: driver.maintenanceRate
                  })
                  setEditingSettings(false)
                }}
                className="text-xs h-7"
              >
                <div
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: driver.driverColor || '#808080' }}
                />
                {driver.driverName}
              </Button>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">Loading...</div>
          ) : !selectedDriver ? (
            <div className="text-center py-12 text-gray-500">Select a driver to view their pay information</div>
          ) : (
            <div className="space-y-6">
              {/* Driver Settings */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: selectedDriver.driverColor || '#808080' }}
                    />
                    <h2 className="text-xl font-semibold">{selectedDriver.driverName}</h2>
                  </div>

                  {editingSettings ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Load %:</Label>
                        <Input
                          type="number"
                          value={tempSettings?.loadPercentage || 0}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            loadPercentage: parseFloat(e.target.value) || 0
                          } : null)}
                          className="w-20 h-8"
                          step="0.01"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Misc Driving Rate:</Label>
                        <Input
                          type="number"
                          value={tempSettings?.miscDrivingRate || 0}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            miscDrivingRate: parseFloat(e.target.value) || 0
                          } : null)}
                          className="w-24 h-8"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Maintenance Rate:</Label>
                        <Input
                          type="number"
                          value={tempSettings?.maintenanceRate || 0}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            maintenanceRate: parseFloat(e.target.value) || 0
                          } : null)}
                          className="w-24 h-8"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <Button size="sm" onClick={saveDriverSettings}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditSettings}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-gray-600">Load %: </span>
                        <span className="font-medium">{selectedDriver.loadPercentage}%</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Misc Driving Rate: </span>
                        <span className="font-medium">${selectedDriver.miscDrivingRate.toFixed(2)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Maintenance Rate: </span>
                        <span className="font-medium">${selectedDriver.maintenanceRate.toFixed(2)}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={startEditSettings}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Driver Hours */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Driver Hours</h3>
                  {!newHour ? (
                    <Button size="sm" onClick={() => setNewHour({
                      date: format(new Date(), 'yyyy-MM-dd'),
                      description: '',
                      hours: 0,
                      type: 'misc_driving'
                    })}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Hours
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={newHour.date}
                        onChange={(e) => setNewHour(prev => prev ? { ...prev, date: e.target.value } : null)}
                        className="w-40 h-8"
                      />
                      <Input
                        type="text"
                        placeholder="Description"
                        value={newHour.description}
                        onChange={(e) => setNewHour(prev => prev ? { ...prev, description: e.target.value } : null)}
                        className="w-48 h-8"
                      />
                      <Input
                        type="number"
                        placeholder="Hours"
                        value={newHour.hours || ''}
                        onChange={(e) => setNewHour(prev => prev ? { ...prev, hours: parseFloat(e.target.value) || 0 } : null)}
                        className="w-24 h-8"
                        step="0.25"
                        min="0"
                      />
                      <select
                        value={newHour.type}
                        onChange={(e) => setNewHour(prev => prev ? { ...prev, type: e.target.value as 'misc_driving' | 'maintenance' } : null)}
                        className="w-32 h-8 border rounded px-2 text-sm"
                      >
                        <option value="misc_driving">Misc Driving</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                      <Button size="sm" onClick={addDriverHour}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setNewHour(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                {selectedDriver.hours.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDriver.hours.map(hour => {
                      const isEditing = editingHour?.id === hour.id
                      return (
                        <div key={hour.id} className="flex items-center justify-between p-2 border rounded">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                type="date"
                                value={editingHour.date}
                                onChange={(e) => setEditingHour(prev => prev ? { ...prev, date: e.target.value } : null)}
                                className="w-40 h-8"
                              />
                              <Input
                                type="text"
                                placeholder="Description"
                                value={editingHour.description}
                                onChange={(e) => setEditingHour(prev => prev ? { ...prev, description: e.target.value } : null)}
                                className="w-48 h-8"
                              />
                              <Input
                                type="number"
                                placeholder="Hours"
                                value={editingHour.hours || ''}
                                onChange={(e) => setEditingHour(prev => prev ? { ...prev, hours: parseFloat(e.target.value) || 0 } : null)}
                                className="w-24 h-8"
                                step="0.25"
                                min="0"
                              />
                              <select
                                value={editingHour.type}
                                onChange={(e) => setEditingHour(prev => prev ? { ...prev, type: e.target.value as 'misc_driving' | 'maintenance' } : null)}
                                className="w-32 h-8 border rounded px-2 text-sm"
                              >
                                <option value="misc_driving">Misc Driving</option>
                                <option value="maintenance">Maintenance</option>
                              </select>
                              <Button size="sm" onClick={updateDriverHour}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingHour(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-4">
                                <span className="text-sm">{format(parseLocalDate(hour.date), 'MM/dd/yyyy')}</span>
                                <span className="text-sm text-gray-600">{hour.description || '—'}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  hour.type === 'maintenance' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {hour.type === 'maintenance' ? 'Maintenance' : 'Misc Driving'}
                                </span>
                                <span className="text-sm font-medium">{(typeof hour.hours === 'number' ? hour.hours : parseFloat(String(hour.hours)) || 0).toFixed(2)} hours</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingHour({
                                    id: hour.id,
                                    date: hour.date,
                                    description: hour.description || '',
                                    hours: hour.hours,
                                    type: hour.type
                                  })}
                                >
                                  <Edit2 className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteDriverHour(hour.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4">No hours recorded</div>
                )}
              </Card>

              {/* Truckloads - Vertical List */}
              <div>
                <h3 className="font-semibold mb-3">Truckloads</h3>
                <div className="space-y-2">
                  {selectedDriver.truckloads.map(truckload => {
                    const tlTotals = calculateTruckloadTotals(truckload)
                    const hasMiddlefield = truckload.orders.some(order => order.middlefield === true)
                    return (
                      <Card
                        key={truckload.id}
                        className={`p-4 cursor-pointer hover:shadow-md transition-shadow print:break-inside-avoid ${
                          hasMiddlefield ? 'border-2 border-red-500' : ''
                        }`}
                        onClick={(e) => handleTruckloadClick(truckload.id, e)}
                      >
                        <div className="space-y-3">
                          {/* Header: Dates, Description, Pickups/Deliveries */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-xl mb-1">
                                {format(parseLocalDate(truckload.startDate), 'MM/dd')} - {format(parseLocalDate(truckload.endDate), 'MM/dd')}
                              </h4>
                              {truckload.description && (
                                <p className="text-sm text-gray-700 mb-1">{truckload.description}</p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-gray-600">
                                <span>{tlTotals.pickupCount} Pickups</span>
                                <span>•</span>
                                <span>{tlTotals.deliveryCount} Deliveries</span>
                                {truckload.billOfLadingNumber && (
                                  <>
                                    <span>•</span>
                                    <span>BOL {truckload.billOfLadingNumber}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {hasMiddlefield && (
                              <div className="flex items-center gap-1 text-red-600 flex-shrink-0">
                                <AlertTriangle className="h-5 w-5" />
                                <span className="text-sm font-semibold">Middlefield</span>
                              </div>
                            )}
                          </div>

                          {/* Calculations - Detailed Breakdown */}
                          <div className="pt-3 border-t border-gray-200 space-y-2">
                            {/* Step 1: Load Value Calculation */}
                            <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Load Value</div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium">Total Quotes</span>
                                  <span className="font-semibold">${tlTotals.totalQuotes.toFixed(2)}</span>
                                </div>
                                
                                {/* Manual Deductions from Load Value - Detailed */}
                                {truckload.deductions.filter(d => d.isManual && !d.isAddition && d.appliesTo === 'load_value' && d.deduction > 0).length > 0 && (
                                  <div className="bg-red-50 rounded px-2 py-1">
                                    <div className="text-xs font-semibold text-red-700 mb-0.5">Manual Deductions (LV)</div>
                                    {truckload.deductions
                                      .filter(d => d.isManual && !d.isAddition && d.appliesTo === 'load_value' && d.deduction > 0)
                                      .map((ded) => (
                                        <div key={ded.id} className="flex items-center justify-between text-xs">
                                          <span className="text-red-700 truncate flex-1">{ded.comment || 'No description'}</span>
                                          <span className="text-red-600 font-semibold ml-1">-${ded.deduction.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    <div className="flex items-center justify-between text-xs mt-0.5 pt-0.5 border-t border-red-200">
                                      <span className="text-red-700 font-medium">Subtotal</span>
                                      <span className="text-red-600 font-bold">-${tlTotals.manualDeductionsFromLoadValue.toFixed(2)}</span>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Manual Additions to Load Value - Detailed */}
                                {truckload.deductions.filter(d => d.isManual && d.isAddition && d.appliesTo === 'load_value' && d.deduction > 0).length > 0 && (
                                  <div className="bg-green-50 rounded px-2 py-1">
                                    <div className="text-xs font-semibold text-green-700 mb-0.5">Manual Additions (LV)</div>
                                    {truckload.deductions
                                      .filter(d => d.isManual && d.isAddition && d.appliesTo === 'load_value' && d.deduction > 0)
                                      .map((ded) => (
                                        <div key={ded.id} className="flex items-center justify-between text-xs">
                                          <span className="text-green-700 truncate flex-1">{ded.comment || 'No description'}</span>
                                          <span className="text-green-600 font-semibold ml-1">+${ded.deduction.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    <div className="flex items-center justify-between text-xs mt-0.5 pt-0.5 border-t border-green-200">
                                      <span className="text-green-700 font-medium">Subtotal</span>
                                      <span className="text-green-600 font-bold">+${tlTotals.manualAdditionsToLoadValue.toFixed(2)}</span>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between text-xs bg-blue-100 rounded px-2 py-1 border border-blue-300">
                                  <span className="font-semibold text-blue-900">Load Value</span>
                                  <span className="font-bold text-blue-900">${tlTotals.loadValue.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Step 2: Base Driver Pay */}
                            <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                              <div className="text-xs font-semibold text-blue-700 mb-0.5">Base Driver Pay ({selectedDriver.loadPercentage}%)</div>
                              <div className="text-sm font-bold text-blue-600">${tlTotals.baseDriverPay.toFixed(2)}</div>
                            </div>

                            {/* Step 3: Deductions & Additions - Detailed */}
                            {(truckload.deductions.filter(d => !d.isManual && d.deduction > 0).length > 0 || 
                              truckload.deductions.filter(d => d.isManual && !d.isAddition && (d.appliesTo === 'driver_pay' || !d.appliesTo) && d.deduction > 0).length > 0 ||
                              truckload.deductions.filter(d => d.isManual && d.isAddition && (d.appliesTo === 'driver_pay' || !d.appliesTo) && d.deduction > 0).length > 0) && (
                              <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                                <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Adjustments</div>
                                <div className="space-y-1">
                                  {/* Automatic Deductions - Detailed */}
                                  {truckload.deductions.filter(d => !d.isManual && d.deduction > 0).length > 0 && (
                                    <div className="bg-red-50 rounded px-2 py-1">
                                      <div className="text-xs font-semibold text-red-700 mb-0.5">Auto Deductions</div>
                                      {truckload.deductions
                                        .filter(d => !d.isManual && d.deduction > 0)
                                        .map((ded) => (
                                          <div key={ded.id} className="flex items-center justify-between text-xs">
                                            <span className="text-red-700 truncate flex-1">
                                              {ded.driverName || 'Unknown'} - {ded.date ? new Date(ded.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : ''} - {ded.action || ''} from {ded.customerName || 'Unknown'}
                                            </span>
                                            <span className="text-red-600 font-semibold ml-1">-${ded.deduction.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      <div className="flex items-center justify-between text-xs mt-0.5 pt-0.5 border-t border-red-200">
                                        <span className="text-red-700 font-medium">Subtotal</span>
                                        <span className="text-red-600 font-bold">-${tlTotals.automaticDeductions.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Manual Deductions from Driver Pay - Detailed */}
                                  {truckload.deductions.filter(d => d.isManual && !d.isAddition && (d.appliesTo === 'driver_pay' || !d.appliesTo) && d.deduction > 0).length > 0 && (
                                    <div className="bg-red-50 rounded px-2 py-1">
                                      <div className="text-xs font-semibold text-red-700 mb-0.5">Manual Deductions (DP)</div>
                                      {truckload.deductions
                                        .filter(d => d.isManual && !d.isAddition && (d.appliesTo === 'driver_pay' || !d.appliesTo) && d.deduction > 0)
                                        .map((ded) => (
                                          <div key={ded.id} className="flex items-center justify-between text-xs">
                                            <span className="text-red-700 truncate flex-1">{ded.comment || 'No description'}</span>
                                            <span className="text-red-600 font-semibold ml-1">-${ded.deduction.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      <div className="flex items-center justify-between text-xs mt-0.5 pt-0.5 border-t border-red-200">
                                        <span className="text-red-700 font-medium">Subtotal</span>
                                        <span className="text-red-600 font-bold">-${tlTotals.manualDeductionsFromDriverPay.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Manual Additions to Driver Pay - Detailed */}
                                  {truckload.deductions.filter(d => d.isManual && d.isAddition && (d.appliesTo === 'driver_pay' || !d.appliesTo) && d.deduction > 0).length > 0 && (
                                    <div className="bg-green-50 rounded px-2 py-1">
                                      <div className="text-xs font-semibold text-green-700 mb-0.5">Manual Additions (DP)</div>
                                      {truckload.deductions
                                        .filter(d => d.isManual && d.isAddition && (d.appliesTo === 'driver_pay' || !d.appliesTo) && d.deduction > 0)
                                        .map((ded) => (
                                          <div key={ded.id} className="flex items-center justify-between text-xs">
                                            <span className="text-green-700 truncate flex-1">{ded.comment || 'No description'}</span>
                                            <span className="text-green-600 font-semibold ml-1">+${ded.deduction.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      <div className="flex items-center justify-between text-xs mt-0.5 pt-0.5 border-t border-green-200">
                                        <span className="text-green-700 font-medium">Subtotal</span>
                                        <span className="text-green-600 font-bold">+${tlTotals.manualAdditionsToDriverPay.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="flex-shrink-0 pay-method-controls">
                              <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                                <div className="text-xs text-gray-600 mb-0.5">
                                  Driver Pay
                                  {truckload.payCalculationMethod === 'automatic' && ` (${selectedDriver.loadPercentage}%)`}
                                  {truckload.payCalculationMethod === 'hourly' && ` (${truckload.payHours || 0}h × $${selectedDriver.miscDrivingRate.toFixed(2)})`}
                                  {truckload.payCalculationMethod === 'manual' && ' (Manual)'}
                                </div>
                                <div className="text-base font-bold text-blue-600 mb-1">${tlTotals.driverPay.toFixed(2)}</div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant={(editingPayMethod === truckload.id ? tempPayMethod?.method : truckload.payCalculationMethod) === 'automatic' ? 'default' : 'outline'}
                                    className="h-6 text-xs px-2"
                                    onClick={() => {
                                      if (editingPayMethod !== truckload.id) {
                                        startEditPayMethod(truckload)
                                      }
                                      setTempPayMethod(prev => prev ? { ...prev, method: 'automatic' } : { method: 'automatic' })
                                    }}
                                  >
                                    Auto
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={(editingPayMethod === truckload.id ? tempPayMethod?.method : truckload.payCalculationMethod) === 'hourly' ? 'default' : 'outline'}
                                    className="h-6 text-xs px-2"
                                    onClick={() => {
                                      if (editingPayMethod !== truckload.id) {
                                        startEditPayMethod(truckload)
                                      }
                                      setTempPayMethod(prev => prev ? { ...prev, method: 'hourly', hours: truckload.payHours || 0 } : { method: 'hourly', hours: truckload.payHours || 0 })
                                    }}
                                  >
                                    Hourly
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={(editingPayMethod === truckload.id ? tempPayMethod?.method : truckload.payCalculationMethod) === 'manual' ? 'default' : 'outline'}
                                    className="h-6 text-xs px-2"
                                    onClick={() => {
                                      if (editingPayMethod !== truckload.id) {
                                        startEditPayMethod(truckload)
                                      }
                                      setTempPayMethod(prev => prev ? { ...prev, method: 'manual', amount: truckload.payManualAmount || 0 } : { method: 'manual', amount: truckload.payManualAmount || 0 })
                                    }}
                                  >
                                    Manual
                                  </Button>
                                </div>
                                {((editingPayMethod === truckload.id ? tempPayMethod?.method : truckload.payCalculationMethod) === 'hourly') && (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      placeholder="Hours"
                                      value={editingPayMethod === truckload.id ? (tempPayMethod?.hours || '') : (truckload.payHours || '')}
                                      onChange={(e) => {
                                        if (editingPayMethod !== truckload.id) {
                                          startEditPayMethod(truckload)
                                        }
                                        setTempPayMethod(prev => prev ? { ...prev, hours: parseFloat(e.target.value) || 0 } : { method: 'hourly', hours: parseFloat(e.target.value) || 0 })
                                      }}
                                      className="h-6 w-20 text-xs"
                                      step="0.1"
                                      min="0"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {editingPayMethod === truckload.id && (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-6 text-xs px-2"
                                          onClick={() => savePayMethod(truckload.id)}
                                        >
                                          <Save className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-xs px-2"
                                          onClick={cancelEditPayMethod}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                                {((editingPayMethod === truckload.id ? tempPayMethod?.method : truckload.payCalculationMethod) === 'manual') && (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      placeholder="Amount"
                                      value={editingPayMethod === truckload.id ? (tempPayMethod?.amount || '') : (truckload.payManualAmount || '')}
                                      onChange={(e) => {
                                        if (editingPayMethod !== truckload.id) {
                                          startEditPayMethod(truckload)
                                        }
                                        setTempPayMethod(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : { method: 'manual', amount: parseFloat(e.target.value) || 0 })
                                      }}
                                      className="h-6 w-24 text-xs"
                                      step="0.01"
                                      min="0"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {editingPayMethod === truckload.id && (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-6 text-xs px-2"
                                          onClick={() => savePayMethod(truckload.id)}
                                        >
                                          <Save className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-xs px-2"
                                          onClick={cancelEditPayMethod}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
                {selectedDriver.truckloads.length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-8">No truckloads in this date range</div>
                )}
              </div>

              {/* Driver Totals */}
              {totals && (
                <Card className="p-4 bg-gray-50">
                  <h3 className="font-semibold mb-4">Weekly Summary</h3>
                  <div className="grid grid-cols-6 gap-4">
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Total Quotes</div>
                      <div className="text-lg font-bold">${totals.totalQuotes.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Load Value</div>
                      <div className="text-lg font-bold">${totals.loadValue.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Misc Driving Hours</div>
                      <div className="text-lg font-bold">
                        {totals.miscDrivingHours.toFixed(2)} <span className="text-sm font-normal text-gray-500">(${totals.miscDrivingTotal.toFixed(2)})</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Maintenance Hours</div>
                      <div className="text-lg font-bold">
                        {totals.maintenanceHours.toFixed(2)} <span className="text-sm font-normal text-gray-500">(${totals.maintenanceTotal.toFixed(2)})</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Weekly Driver Pay</div>
                      <div className="text-xl font-bold text-green-600">${totals.weeklyDriverPay.toFixed(2)}</div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

    </div>
  )
}
