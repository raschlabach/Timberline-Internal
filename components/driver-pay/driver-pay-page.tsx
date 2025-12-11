'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { CalendarIcon, Edit2, Save, X, Plus, Trash2, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { DateRange } from 'react-day-picker'
import { TruckloadInvoiceDialog } from './truckload-invoice-dialog'

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
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [editingSettings, setEditingSettings] = useState(false)
  const [tempSettings, setTempSettings] = useState<DriverPaySettings | null>(null)
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<number | null>(null)
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [newHour, setNewHour] = useState<{ date: string; description: string; hours: number } | null>(null)

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
            hourlyRate: data.drivers[0].hourlyRate
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
        hourlyRate: drivers[0].hourlyRate
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
        hourlyRate: selectedDriver.hourlyRate
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
        hourlyRate: selectedDriver.hourlyRate
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
          hourlyRate: tempSettings.hourlyRate
        })
      })

      const data = await response.json()
      if (data.success) {
        setDrivers(prev => prev.map(driver => 
          driver.driverId === tempSettings.driverId
            ? { ...driver, loadPercentage: tempSettings.loadPercentage, hourlyRate: tempSettings.hourlyRate }
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
    if (!selectedDriver || !newHour || !newHour.date || !newHour.hours) {
      toast.error('Please fill in date and hours')
      return
    }

    try {
      const response = await fetch(`/api/drivers/hours/${selectedDriver.driverId}`, {
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

  // Calculate totals for a truckload
  const calculateTruckloadTotals = (truckload: Truckload) => {
    const totalQuotes = truckload.orders.reduce((sum, order) => sum + (order.freightQuote || 0), 0)
    const totalDeductions = truckload.deductions.reduce((sum, deduction) => sum + deduction.deduction, 0)
    const loadValue = totalQuotes - totalDeductions
    return { totalQuotes, totalDeductions, loadValue }
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
      return sum + tlTotals.totalDeductions
    }, 0)

    const loadValue = totalQuotes - totalDeductions
    const totalHours = selectedDriver.hours.reduce((sum, hour) => sum + hour.hours, 0)
    const weeklyDriverPay = (loadValue * selectedDriver.loadPercentage / 100) + (totalHours * selectedDriver.hourlyRate)

    return {
      totalQuotes,
      totalDeductions,
      loadValue,
      totalHours,
      weeklyDriverPay
    }
  }

  const handleTruckloadClick = (truckloadId: number) => {
    setSelectedTruckloadId(truckloadId)
    setIsInvoiceDialogOpen(true)
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
                    hourlyRate: driver.hourlyRate
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
                        <Label className="text-sm">Hourly Rate:</Label>
                        <Input
                          type="number"
                          value={tempSettings?.hourlyRate || 0}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            hourlyRate: parseFloat(e.target.value) || 0
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
                        <span className="text-gray-600">Hourly Rate: </span>
                        <span className="font-medium">${selectedDriver.hourlyRate.toFixed(2)}</span>
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
                      hours: 0
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

              {/* Truckloads - Compact Boxes */}
              <div>
                <h3 className="font-semibold mb-4">Truckloads</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedDriver.truckloads.map(truckload => {
                    const tlTotals = calculateTruckloadTotals(truckload)
                    return (
                      <Card
                        key={truckload.id}
                        className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => handleTruckloadClick(truckload.id)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">
                              {truckload.billOfLadingNumber ? `BOL ${truckload.billOfLadingNumber}` : `TL ${truckload.id}`}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600">
                            {format(new Date(truckload.startDate), 'MM/dd/yyyy')} - {format(new Date(truckload.endDate), 'MM/dd/yyyy')}
                          </p>
                          {truckload.description && (
                            <p className="text-sm text-gray-700">{truckload.description}</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                            <div>
                              <div className="text-xs text-gray-600">Total Quotes</div>
                              <div className="text-sm font-semibold">${tlTotals.totalQuotes.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600">Deductions</div>
                              <div className="text-sm font-semibold text-red-600">-${tlTotals.totalDeductions.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600">Load Value</div>
                              <div className="text-sm font-semibold">${tlTotals.loadValue.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600">Orders</div>
                              <div className="text-sm font-semibold">{truckload.orders.length}</div>
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
                  <div className="grid grid-cols-5 gap-4">
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
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Total Hours</div>
                      <div className="text-lg font-bold">{totals.totalHours.toFixed(2)}</div>
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

      {/* Invoice Dialog */}
      {selectedTruckloadId && selectedDriverId && (
        <TruckloadInvoiceDialog
          isOpen={isInvoiceDialogOpen}
          onOpenChange={setIsInvoiceDialogOpen}
          truckloadId={selectedTruckloadId}
          driverId={selectedDriverId}
          onDataUpdated={() => {
            // Refresh data when dialog updates quotes or deductions
            fetchPayData()
          }}
        />
      )}
    </div>
  )
}
