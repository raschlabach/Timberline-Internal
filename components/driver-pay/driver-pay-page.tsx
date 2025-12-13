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
import { CalendarIcon, Edit2, Save, X, Plus, Trash2, DollarSign, AlertTriangle, Calculator } from 'lucide-react'
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
  
  // Restore driver selection from URL
  useEffect(() => {
    if (urlDriverId && drivers.length > 0) {
      const driverIdNum = parseInt(urlDriverId, 10)
      const driverExists = drivers.some(d => d.driverId === driverIdNum)
      if (driverExists && selectedDriverId !== driverIdNum) {
        setSelectedDriverId(driverIdNum)
      }
    }
  }, [urlDriverId, drivers, selectedDriverId])

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
        // Select first driver by default
        if (data.drivers.length > 0 && !selectedDriverId) {
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

  // Update selected driver when drivers change
  useEffect(() => {
    if (drivers.length > 0 && !selectedDriverId) {
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

    try {
      const response = await fetch(`/api/drivers/hours/${selectedDriver.driverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newHour.date,
          description: newHour.description || null,
          hours: newHour.hours,
          type: newHour.type
        })
      })

      const data = await response.json()
      if (data.success) {
        setDrivers(prev => prev.map(driver =>
          driver.driverId === selectedDriver.driverId
            ? { ...driver, hours: [...driver.hours, data.hour] }
            : driver
        ))
        setNewHour(null)
        toast.success('Driver hour added')
      } else {
        toast.error('Failed to add driver hour')
      }
    } catch (error) {
      console.error('Error adding driver hour:', error)
      toast.error('Failed to add driver hour')
    }
  }

  // Delete driver hour
  const deleteDriverHour = async (hourId: number) => {
    if (!selectedDriver) return

    try {
      const response = await fetch(`/api/drivers/hours/${selectedDriver.driverId}?id=${hourId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        setDrivers(prev => prev.map(driver =>
          driver.driverId === selectedDriver.driverId
            ? { ...driver, hours: driver.hours.filter(h => h.id !== hourId) }
            : driver
        ))
        toast.success('Driver hour deleted')
      } else {
        toast.error('Failed to delete driver hour')
      }
    } catch (error) {
      console.error('Error deleting driver hour:', error)
      toast.error('Failed to delete driver hour')
    }
  }

  // Calculate totals for a truckload with detailed breakdown
  const calculateTruckloadTotals = (truckload: Truckload) => {
    const totalQuotes = truckload.orders.reduce((sum, order) => sum + (order.freightQuote || 0), 0)
    
    // Count pickups and deliveries
    const pickupCount = truckload.orders.filter(order => order.assignmentType === 'pickup').length
    const deliveryCount = truckload.orders.filter(order => order.assignmentType === 'delivery').length
    
    // Separate manual and automatic deductions
    const manualDeductions = truckload.deductions.reduce((sum, deduction) => {
      if (deduction.isManual && !deduction.isAddition) {
        return sum + deduction.deduction
      }
      return sum
    }, 0)
    
    const automaticDeductions = truckload.deductions.reduce((sum, deduction) => {
      if (!deduction.isManual) {
        return sum + deduction.deduction
      }
      return sum
    }, 0)
    
    const totalAdditions = truckload.deductions.reduce((sum, deduction) => {
      if (deduction.isManual && deduction.isAddition) {
        return sum + deduction.deduction
      }
      return sum
    }, 0)
    
    // Calculate intermediate totals
    const quotesPlusManualDeductions = totalQuotes - manualDeductions
    const afterAutomaticDeductions = quotesPlusManualDeductions - automaticDeductions
    const loadValue = afterAutomaticDeductions + totalAdditions
    
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
      // Automatic: load value × driver percentage
      driverPay = loadValue * (selectedDriver?.loadPercentage || 30) / 100
    }
    
    return { 
      totalQuotes, 
      manualDeductions,
      quotesPlusManualDeductions,
      automaticDeductions,
      afterAutomaticDeductions,
      totalAdditions,
      loadValue,
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

    const totalDeductions = selectedDriver.truckloads.reduce((sum, tl) => {
      const tlTotals = calculateTruckloadTotals(tl)
      return sum + tlTotals.manualDeductions + tlTotals.automaticDeductions
    }, 0)

    const loadValue = selectedDriver.truckloads.reduce((sum, tl) => {
      const tlTotals = calculateTruckloadTotals(tl)
      return sum + tlTotals.loadValue
    }, 0)
    const miscDrivingHours = selectedDriver.hours
      .filter(h => h.type === 'misc_driving')
      .reduce((sum, hour) => sum + hour.hours, 0)
    const maintenanceHours = selectedDriver.hours
      .filter(h => h.type === 'maintenance')
      .reduce((sum, hour) => sum + hour.hours, 0)
    const miscDrivingTotal = miscDrivingHours * selectedDriver.miscDrivingRate
    const maintenanceTotal = maintenanceHours * selectedDriver.maintenanceRate
    const weeklyDriverPay = (loadValue * selectedDriver.loadPercentage / 100) + 
      miscDrivingTotal + 
      maintenanceTotal

    return {
      totalQuotes,
      totalDeductions,
      loadValue,
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
                    {selectedDriver.hours.map(hour => (
                      <div key={hour.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-4">
                          <span className="text-sm">{format(new Date(hour.date), 'MM/dd/yyyy')}</span>
                          <span className="text-sm text-gray-600">{hour.description || '—'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            hour.type === 'maintenance' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {hour.type === 'maintenance' ? 'Maintenance' : 'Misc Driving'}
                          </span>
                          <span className="text-sm font-medium">{hour.hours.toFixed(2)} hours</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteDriverHour(hour.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
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
                                {format(new Date(truckload.startDate), 'MM/dd')} - {format(new Date(truckload.endDate), 'MM/dd')}
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

                          {/* Calculations - Horizontal Layout */}
                          <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-gray-200">
                            <div className="flex-shrink-0">
                              <div className="text-xs text-gray-600 mb-0.5">Total Quotes</div>
                              <div className="text-sm font-semibold">${tlTotals.totalQuotes.toFixed(2)}</div>
                            </div>
                            <div className="flex-shrink-0">
                              <div className="text-xs text-gray-600 mb-0.5">Manual Deductions</div>
                              <div className="text-sm font-semibold text-red-600">-${tlTotals.manualDeductions.toFixed(2)}</div>
                            </div>
                            <div className="flex-shrink-0">
                              <div className="text-xs text-gray-600 mb-0.5">After Manual</div>
                              <div className="text-sm font-semibold">${tlTotals.quotesPlusManualDeductions.toFixed(2)}</div>
                            </div>
                            <div className="flex-shrink-0">
                              <div className="text-xs text-gray-600 mb-0.5">Auto Deductions</div>
                              <div className="text-sm font-semibold text-red-600">-${tlTotals.automaticDeductions.toFixed(2)}</div>
                            </div>
                            {tlTotals.totalAdditions > 0 && (
                              <div className="flex-shrink-0">
                                <div className="text-xs text-gray-600 mb-0.5">Additions</div>
                                <div className="text-sm font-semibold text-green-600">+${tlTotals.totalAdditions.toFixed(2)}</div>
                              </div>
                            )}
                            <div className="flex-shrink-0">
                              <div className="text-xs text-gray-600 mb-0.5">Load Value</div>
                              <div className="text-base font-bold">${tlTotals.loadValue.toFixed(2)}</div>
                            </div>
                            <div className="flex-shrink-0 pay-method-controls">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="text-xs text-gray-600 mb-0.5">
                                    Driver Pay
                                    {truckload.payCalculationMethod === 'automatic' && ` (${selectedDriver.loadPercentage}%)`}
                                    {truckload.payCalculationMethod === 'hourly' && ` (${truckload.payHours || 0}h × $${selectedDriver.miscDrivingRate.toFixed(2)})`}
                                    {truckload.payCalculationMethod === 'manual' && ' (Manual)'}
                                  </div>
                                  <div className="text-base font-bold text-blue-600">${tlTotals.driverPay.toFixed(2)}</div>
                                </div>
                                {editingPayMethod === truckload.id ? (
                                  <div className="flex flex-col gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant={tempPayMethod?.method === 'automatic' ? 'default' : 'outline'}
                                        className="h-6 text-xs px-2"
                                        onClick={() => setTempPayMethod(prev => prev ? { ...prev, method: 'automatic' } : { method: 'automatic' })}
                                      >
                                        Auto
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={tempPayMethod?.method === 'hourly' ? 'default' : 'outline'}
                                        className="h-6 text-xs px-2"
                                        onClick={() => setTempPayMethod(prev => prev ? { ...prev, method: 'hourly' } : { method: 'hourly', hours: 0 })}
                                      >
                                        Hourly
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={tempPayMethod?.method === 'manual' ? 'default' : 'outline'}
                                        className="h-6 text-xs px-2"
                                        onClick={() => setTempPayMethod(prev => prev ? { ...prev, method: 'manual' } : { method: 'manual', amount: 0 })}
                                      >
                                        Manual
                                      </Button>
                                    </div>
                                    {tempPayMethod?.method === 'hourly' && (
                                      <Input
                                        type="number"
                                        placeholder="Hours"
                                        value={tempPayMethod.hours || ''}
                                        onChange={(e) => setTempPayMethod(prev => prev ? { ...prev, hours: parseFloat(e.target.value) || 0 } : { method: 'hourly', hours: parseFloat(e.target.value) || 0 })}
                                        className="h-6 w-20 text-xs"
                                        step="0.1"
                                        min="0"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                    {tempPayMethod?.method === 'manual' && (
                                      <Input
                                        type="number"
                                        placeholder="Amount"
                                        value={tempPayMethod.amount || ''}
                                        onChange={(e) => setTempPayMethod(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : { method: 'manual', amount: parseFloat(e.target.value) || 0 })}
                                        className="h-6 w-24 text-xs"
                                        step="0.01"
                                        min="0"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                    <div className="flex gap-1">
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
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      startEditPayMethod(truckload)
                                    }}
                                  >
                                    <Calculator className="h-4 w-4" />
                                  </Button>
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
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Total Deductions</div>
                      <div className="text-lg font-bold text-red-600">-${totals.totalDeductions.toFixed(2)}</div>
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
