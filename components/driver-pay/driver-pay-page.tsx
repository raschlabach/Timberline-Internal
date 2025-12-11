'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { format } from 'date-fns'
import { CalendarIcon, ChevronDown, ChevronRight, Edit2, Save, X, Plus, Trash2, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { DateRange } from 'react-day-picker'

interface DriverPayPageProps {}

interface DriverPaySettings {
  driverId: number
  loadPercentage: number
  hourlyRate: number
}

interface DriverHour {
  id: number
  date: string
  description: string | null
  hours: number
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
}

interface Order {
  orderId: number
  assignmentType: 'pickup' | 'delivery'
  freightQuote: number | null
  footage: number
  pickupCustomerName: string | null
  deliveryCustomerName: string | null
}

interface Truckload {
  id: number
  startDate: string
  endDate: string
  billOfLadingNumber: string | null
  description: string | null
  orders: Order[]
  deductions: Deduction[]
}

interface DriverData {
  driverId: number
  driverName: string
  driverColor: string | null
  loadPercentage: number
  hourlyRate: number
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

export default function DriverPayPage({}: DriverPayPageProps) {
  const lastWeek = getLastWeekRange()
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: lastWeek.start,
    to: lastWeek.end
  })
  const [drivers, setDrivers] = useState<DriverData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [collapsedDrivers, setCollapsedDrivers] = useState<Set<number>>(new Set())
  const [editingSettings, setEditingSettings] = useState<Set<number>>(new Set())
  const [tempSettings, setTempSettings] = useState<Map<number, DriverPaySettings>>(new Map())
  const [updatingQuotes, setUpdatingQuotes] = useState<Set<string>>(new Set())
  const [editingDeductions, setEditingDeductions] = useState<Map<string, Deduction>>(new Map())
  const [editingHours, setEditingHours] = useState<Map<number, DriverHour>>(new Map())
  const [newHour, setNewHour] = useState<{ driverId: number; date: string; description: string; hours: number } | null>(null)

  const quoteUpdateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})

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
        // Initialize temp settings for all drivers
        const settingsMap = new Map<number, DriverPaySettings>()
        data.drivers.forEach(driver => {
          settingsMap.set(driver.driverId, {
            driverId: driver.driverId,
            loadPercentage: driver.loadPercentage,
            hourlyRate: driver.hourlyRate
          })
        })
        setTempSettings(settingsMap)
      } else {
        toast.error('Failed to load driver pay data')
      }
    } catch (error) {
      console.error('Error fetching pay data:', error)
      toast.error('Failed to load driver pay data')
    } finally {
      setIsLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchPayData()
  }, [fetchPayData])

  // Toggle driver collapse
  const toggleDriverCollapse = (driverId: number) => {
    setCollapsedDrivers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(driverId)) {
        newSet.delete(driverId)
      } else {
        newSet.add(driverId)
      }
      return newSet
    })
  }

  // Start editing driver settings
  const startEditSettings = (driverId: number) => {
    setEditingSettings(prev => new Set(prev).add(driverId))
  }

  // Cancel editing driver settings
  const cancelEditSettings = (driverId: number) => {
    setEditingSettings(prev => {
      const newSet = new Set(prev)
      newSet.delete(driverId)
      return newSet
    })
    // Reset temp settings to original
    const driver = drivers.find(d => d.driverId === driverId)
    if (driver) {
      setTempSettings(prev => {
        const newMap = new Map(prev)
        newMap.set(driverId, {
          driverId: driver.driverId,
          loadPercentage: driver.loadPercentage,
          hourlyRate: driver.hourlyRate
        })
        return newMap
      })
    }
  }

  // Save driver settings
  const saveDriverSettings = async (driverId: number) => {
    const settings = tempSettings.get(driverId)
    if (!settings) return

    try {
      const response = await fetch(`/api/drivers/pay-settings/${driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadPercentage: settings.loadPercentage,
          hourlyRate: settings.hourlyRate
        })
      })

      const data = await response.json()
      if (data.success) {
        // Update driver in state
        setDrivers(prev => prev.map(driver => 
          driver.driverId === driverId
            ? { ...driver, loadPercentage: settings.loadPercentage, hourlyRate: settings.hourlyRate }
            : driver
        ))
        setEditingSettings(prev => {
          const newSet = new Set(prev)
          newSet.delete(driverId)
          return newSet
        })
        toast.success('Driver settings saved')
      } else {
        toast.error('Failed to save driver settings')
      }
    } catch (error) {
      console.error('Error saving driver settings:', error)
      toast.error('Failed to save driver settings')
    }
  }

  // Update order quote
  const updateOrderQuote = useCallback(async (orderId: number, newQuote: string, truckloadId: number, driverId: number) => {
    const key = `${truckloadId}-${orderId}`
    setUpdatingQuotes(prev => new Set(prev).add(key))

    // Clear existing timeout
    if (quoteUpdateTimeouts.current[key]) {
      clearTimeout(quoteUpdateTimeouts.current[key])
    }

    // Set new timeout
    quoteUpdateTimeouts.current[key] = setTimeout(async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            freightQuote: newQuote ? parseFloat(newQuote) : null
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update quote')
        }

        // Update local state
        setDrivers(prev => prev.map(driver => 
          driver.driverId === driverId
            ? {
                ...driver,
                truckloads: driver.truckloads.map(tl =>
                  tl.id === truckloadId
                    ? {
                        ...tl,
                        orders: tl.orders.map(order =>
                          order.orderId === orderId
                            ? { ...order, freightQuote: newQuote ? parseFloat(newQuote) : null }
                            : order
                        )
                      }
                    : tl
                )
              }
            : driver
        ))
      } catch (error) {
        console.error('Error updating quote:', error)
        toast.error('Failed to update quote')
      } finally {
        setUpdatingQuotes(prev => {
          const newSet = new Set(prev)
          newSet.delete(key)
          return newSet
        })
        delete quoteUpdateTimeouts.current[key]
      }
    }, 1000)
  }, [])

  // Update deduction
  const updateDeduction = useCallback(async (truckloadId: number, deductionId: number, updates: Partial<Deduction>, driverId: number) => {
    const key = `${truckloadId}-${deductionId}`
    const currentDeduction = editingDeductions.get(key) || 
      drivers.find(d => d.driverId === driverId)?.truckloads
        .find(tl => tl.id === truckloadId)?.deductions.find(d => d.id === deductionId)

    if (!currentDeduction) return

    const updated = { ...currentDeduction, ...updates }
    setEditingDeductions(prev => new Map(prev).set(key, updated))

    // Update local state immediately
    setDrivers(prev => prev.map(driver =>
      driver.driverId === driverId
        ? {
            ...driver,
            truckloads: driver.truckloads.map(tl =>
              tl.id === truckloadId
                ? {
                    ...tl,
                    deductions: tl.deductions.map(d =>
                      d.id === deductionId ? updated : d
                    )
                  }
                : tl
            )
          }
        : driver
    ))

    // Save to database
    setTimeout(async () => {
      try {
        const allDeductions = drivers.find(d => d.driverId === driverId)?.truckloads
          .find(tl => tl.id === truckloadId)?.deductions.map(d => {
            const edited = editingDeductions.get(`${truckloadId}-${d.id}`)
            return edited || d
          }) || []

        const response = await fetch(`/api/truckloads/${truckloadId}/cross-driver-freight`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: allDeductions.map(item => ({
              driverName: item.driverName || null,
              date: item.date,
              action: item.action || null,
              footage: item.footage,
              dimensions: item.dimensions || null,
              deduction: item.deduction,
              isManual: item.isManual,
              comment: item.comment || null
            }))
          })
        })

        if (!response.ok) {
          throw new Error('Failed to save deduction')
        }

        setEditingDeductions(prev => {
          const newMap = new Map(prev)
          newMap.delete(key)
          return newMap
        })
      } catch (error) {
        console.error('Error saving deduction:', error)
        toast.error('Failed to save deduction')
      }
    }, 1000)
  }, [drivers, editingDeductions])

  // Add driver hour
  const addDriverHour = async (driverId: number) => {
    if (!newHour || !newHour.date || !newHour.hours) {
      toast.error('Please fill in date and hours')
      return
    }

    try {
      const response = await fetch(`/api/drivers/hours/${driverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newHour.date,
          description: newHour.description || null,
          hours: newHour.hours
        })
      })

      const data = await response.json()
      if (data.success) {
        setDrivers(prev => prev.map(driver =>
          driver.driverId === driverId
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
  const deleteDriverHour = async (driverId: number, hourId: number) => {
    try {
      const response = await fetch(`/api/drivers/hours/${driverId}?id=${hourId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        setDrivers(prev => prev.map(driver =>
          driver.driverId === driverId
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

  // Calculate totals for a driver
  const calculateDriverTotals = (driver: DriverData) => {
    const totalQuotes = driver.truckloads.reduce((sum, tl) =>
      sum + tl.orders.reduce((orderSum, order) =>
        orderSum + (order.freightQuote || 0), 0
      ), 0
    )

    const totalDeductions = driver.truckloads.reduce((sum, tl) =>
      sum + tl.deductions.reduce((deductionSum, deduction) =>
        deductionSum + deduction.deduction, 0
      ), 0
    )

    const loadValue = totalQuotes - totalDeductions
    const totalHours = driver.hours.reduce((sum, hour) => sum + hour.hours, 0)
    const weeklyDriverPay = (loadValue * driver.loadPercentage / 100) + (totalHours * driver.hourlyRate)

    return {
      totalQuotes,
      totalDeductions,
      loadValue,
      totalHours,
      weeklyDriverPay
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Driver Pay</h1>
        
        {/* Date Range Selector */}
        <div className="flex items-center gap-4">
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
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-12">Loading...</div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No drivers found for selected date range</div>
          ) : (
            drivers.map(driver => {
              const totals = calculateDriverTotals(driver)
              const isCollapsed = collapsedDrivers.has(driver.driverId)
              const isEditingSettings = editingSettings.has(driver.driverId)
              const settings = tempSettings.get(driver.driverId) || {
                driverId: driver.driverId,
                loadPercentage: driver.loadPercentage,
                hourlyRate: driver.hourlyRate
              }

              return (
                <Card key={driver.driverId} className="p-4">
                  <div className="space-y-4">
                    {/* Driver Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDriverCollapse(driver.driverId)}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: driver.driverColor || '#808080' }}
                        />
                        <h2 className="text-xl font-semibold">{driver.driverName}</h2>
                      </div>

                      {/* Driver Settings */}
                      <div className="flex items-center gap-4">
                        {isEditingSettings ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Load %:</Label>
                              <Input
                                type="number"
                                value={settings.loadPercentage}
                                onChange={(e) => setTempSettings(prev => new Map(prev).set(driver.driverId, {
                                  ...settings,
                                  loadPercentage: parseFloat(e.target.value) || 0
                                }))}
                                className="w-20 h-8"
                                step="0.01"
                                min="0"
                                max="100"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Hourly Rate:</Label>
                              <Input
                                type="number"
                                value={settings.hourlyRate}
                                onChange={(e) => setTempSettings(prev => new Map(prev).set(driver.driverId, {
                                  ...settings,
                                  hourlyRate: parseFloat(e.target.value) || 0
                                }))}
                                className="w-24 h-8"
                                step="0.01"
                                min="0"
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={() => saveDriverSettings(driver.driverId)}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelEditSettings(driver.driverId)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="text-sm">
                              <span className="text-gray-600">Load %: </span>
                              <span className="font-medium">{driver.loadPercentage}%</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600">Hourly Rate: </span>
                              <span className="font-medium">${driver.hourlyRate.toFixed(2)}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditSettings(driver.driverId)}
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {!isCollapsed && (
                      <>
                        {/* Driver Hours */}
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Driver Hours</h3>
                            {!newHour || newHour.driverId !== driver.driverId ? (
                              <Button
                                size="sm"
                                onClick={() => setNewHour({
                                  driverId: driver.driverId,
                                  date: format(new Date(), 'yyyy-MM-dd'),
                                  description: '',
                                  hours: 0
                                })}
                              >
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
                                <Button
                                  size="sm"
                                  onClick={() => addDriverHour(driver.driverId)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setNewHour(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                          {driver.hours.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead className="text-right">Hours</TableHead>
                                  <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {driver.hours.map(hour => (
                                  <TableRow key={hour.id}>
                                    <TableCell>{format(new Date(hour.date), 'MM/dd/yyyy')}</TableCell>
                                    <TableCell>{hour.description || '—'}</TableCell>
                                    <TableCell className="text-right">{hour.hours.toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteDriverHour(driver.driverId, hour.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-sm text-gray-500 text-center py-4">No hours recorded</div>
                          )}
                        </div>

                        {/* Truckloads */}
                        {driver.truckloads.map(truckload => (
                          <Card key={truckload.id} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-semibold">
                                    {truckload.billOfLadingNumber ? `BOL ${truckload.billOfLadingNumber}` : `TL ${truckload.id}`}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    {format(new Date(truckload.startDate), 'MM/dd/yyyy')} - {format(new Date(truckload.endDate), 'MM/dd/yyyy')}
                                  </p>
                                </div>
                              </div>

                              {/* Orders */}
                              {truckload.orders.length > 0 && (
                                <div>
                                  <h5 className="font-medium mb-2">Orders</h5>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Pickup</TableHead>
                                        <TableHead>Delivery</TableHead>
                                        <TableHead className="text-right">Quote</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {truckload.orders.map(order => {
                                        const key = `${truckload.id}-${order.orderId}`
                                        const isUpdating = updatingQuotes.has(key)
                                        return (
                                          <TableRow key={order.orderId}>
                                            <TableCell className="capitalize">{order.assignmentType}</TableCell>
                                            <TableCell>{order.pickupCustomerName || '—'}</TableCell>
                                            <TableCell>{order.deliveryCustomerName || '—'}</TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                value={order.freightQuote || ''}
                                                onChange={(e) => updateOrderQuote(order.orderId, e.target.value, truckload.id, driver.driverId)}
                                                className="w-24 h-8 text-right"
                                                step="0.01"
                                                min="0"
                                                disabled={isUpdating}
                                              />
                                            </TableCell>
                                          </TableRow>
                                        )
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}

                              {/* Deductions */}
                              {truckload.deductions.length > 0 && (
                                <div>
                                  <h5 className="font-medium mb-2">Deductions</h5>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Driver</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead className="text-right">Deduction</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {truckload.deductions.map(deduction => (
                                        <TableRow key={deduction.id}>
                                          <TableCell>{format(new Date(deduction.date), 'MM/dd/yyyy')}</TableCell>
                                          <TableCell>{deduction.driverName || '—'}</TableCell>
                                          <TableCell>{deduction.action || '—'}</TableCell>
                                          <TableCell>
                                            <Input
                                              type="number"
                                              value={deduction.deduction}
                                              onChange={(e) => updateDeduction(truckload.id, deduction.id, { deduction: parseFloat(e.target.value) || 0 }, driver.driverId)}
                                              className="w-24 h-8 text-right"
                                              step="0.01"
                                              min="0"
                                            />
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}

                        {/* Totals */}
                        <Card className="p-4 bg-gray-50">
                          <div className="grid grid-cols-5 gap-4">
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-0.5">Total Quotes</div>
                              <div className="text-lg font-bold">
                                ${totals.totalQuotes.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-0.5">Total Deductions</div>
                              <div className="text-lg font-bold text-red-600">
                                -${totals.totalDeductions.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-0.5">Load Value</div>
                              <div className="text-lg font-bold">
                                ${totals.loadValue.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-0.5">Total Hours</div>
                              <div className="text-lg font-bold">
                                {totals.totalHours.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-0.5">Weekly Driver Pay</div>
                              <div className="text-xl font-bold text-green-600">
                                ${totals.weeklyDriverPay.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </>
                    )}
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

