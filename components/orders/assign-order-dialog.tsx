"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { format, parseISO, isValid } from 'date-fns'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TruckloadSummary } from '@/types/truckloads'
import { ApiDriver, ApiTruckload, DriverOption, TruckloadView, filterAndSortTruckloads, mapDriverOption, mapTruckloadSummary } from '@/lib/truckload-utils'
import { useQueryClient } from '@tanstack/react-query'
import { Package, CheckCircle2, Calendar, Clock, MapPin, Truck, Info } from 'lucide-react'
import { Badge } from "@/components/ui/badge"

interface AssignOrderDialogProps {
  isOpen: boolean
  onClose: () => void
  orderId: number
  pickupCustomer: {
    id: number
    name: string
  }
  deliveryCustomer: {
    id: number
    name: string
  }
  pickupAssignment?: {
    truckloadId: number
    truckloadNumber?: string
    driverName?: string
  }
  deliveryAssignment?: {
    truckloadId: number
    truckloadNumber?: string
    driverName?: string
  }
  isTransferOrder?: boolean
  onAssignmentChange: () => void
  isPickupCompleted?: boolean
}


function formatDateRange(startDate: string | undefined, endDate: string | undefined): string | null {
  if (!startDate || !endDate) return null

  const parsedStart = parseISO(startDate)
  const parsedEnd = parseISO(endDate)

  if (!isValid(parsedStart) || !isValid(parsedEnd)) return null

  return `${format(parsedStart, 'MMM d')} - ${format(parsedEnd, 'MMM d, yyyy')}`
}

export function AssignOrderDialog({ 
  isOpen, 
  onClose, 
  orderId, 
  pickupCustomer, 
  deliveryCustomer,
  pickupAssignment,
  deliveryAssignment,
  isTransferOrder,
  onAssignmentChange,
  isPickupCompleted = false
}: AssignOrderDialogProps) {
  const queryClient = useQueryClient()
  const [allTruckloads, setAllTruckloads] = useState<TruckloadSummary[]>([])
  const [truckloads, setTruckloads] = useState<TruckloadSummary[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedPickupTruckloadId, setSelectedPickupTruckloadId] = useState<number | null>(null)
  const [selectedDeliveryTruckloadId, setSelectedDeliveryTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUnassigning, setIsUnassigning] = useState(false)
  const [truckloadView, setTruckloadView] = useState<TruckloadView>('current')
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set())

  // Check if pickup assignment is locked
  const isPickupLocked = Boolean(isPickupCompleted && pickupAssignment)

  // Toggle driver selection
  const toggleDriverSelection = (driverName: string) => {
    setSelectedDrivers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(driverName)) {
        newSet.delete(driverName)
      } else {
        newSet.add(driverName)
      }
      return newSet
    })
  }

  useEffect(() => {
    if (isOpen) {
      setTruckloadView('current')
      setSelectedPickupTruckloadId(null)
      setSelectedDeliveryTruckloadId(null)
      setSelectedDrivers(new Set()) // Reset selection on dialog open
      fetchData()
    }
  }, [isOpen])

  useEffect(() => {
    setTruckloads(filterAndSortTruckloads(allTruckloads, truckloadView))
  }, [allTruckloads, truckloadView])

  useEffect(() => {
    if (selectedPickupTruckloadId && !truckloads.some(function hasSelection(truckload) {
      return truckload.id === selectedPickupTruckloadId
    })) {
      setSelectedPickupTruckloadId(null)
    }
    if (selectedDeliveryTruckloadId && !truckloads.some(function hasSelection(truckload) {
      return truckload.id === selectedDeliveryTruckloadId
    })) {
      setSelectedDeliveryTruckloadId(null)
    }
  }, [truckloads, selectedPickupTruckloadId, selectedDeliveryTruckloadId])

  function handleTruckloadViewChange(nextValue: string): void {
    const view = nextValue === 'completed' ? 'completed' : 'current'
    setTruckloadView(view)
  }

  function handlePickupSelection(truckloadId: number): void {
    setSelectedPickupTruckloadId(truckloadId)
  }

  function handleDeliverySelection(truckloadId: number): void {
    setSelectedDeliveryTruckloadId(truckloadId)
  }

  async function fetchData(): Promise<void> {
    try {
      setIsLoading(true)
      // Fetch both truckloads and drivers in parallel
      const [truckloadsResponse, driversResponse] = await Promise.all([
        fetch('/api/truckloads'),
        fetch('/api/drivers')
      ])

      if (!truckloadsResponse.ok) throw new Error('Failed to fetch truckloads')
      if (!driversResponse.ok) throw new Error('Failed to fetch drivers')

      const [truckloadsData, driversData] = await Promise.all([
        truckloadsResponse.json(),
        driversResponse.json()
      ])

      if (!truckloadsData.success) throw new Error('Failed to fetch truckloads')
      if (!driversData.success) throw new Error('Failed to fetch drivers')

      // Transform and set drivers
      const driverOptions = (driversData.drivers as ApiDriver[]).map(function mapDriver(driver) {
        return mapDriverOption(driver)
      })
      setDrivers(driverOptions)

      // Transform the truckloads data
      const mappedTruckloads = truckloadsData.truckloads.map(function mapData(truckload: ApiTruckload) {
        return mapTruckloadSummary(truckload)
      })

      setAllTruckloads(mappedTruckloads)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load truckloads and drivers')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUnassign(assignmentType: 'pickup' | 'delivery') {
    setIsUnassigning(true)

    try {
      const response = await fetch('/api/truckloads/assign', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          assignmentType
        })
      })

      if (!response.ok) throw new Error('Failed to unassign order')

      toast.success(`${assignmentType === 'pickup' ? 'Pickup' : 'Delivery'} unassigned successfully`)
      // Invalidate queries to refresh truckload manager and orders
      queryClient.invalidateQueries({ queryKey: ['truckloads'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['truckload-stops'] })
      onAssignmentChange()
      // Don't close dialog, allow user to continue assigning
    } catch (error) {
      console.error('Error unassigning order:', error)
      toast.error('Failed to unassign order')
    } finally {
      setIsUnassigning(false)
    }
  }

  async function handleAssign() {
    // At least one assignment must be selected
    if (!selectedPickupTruckloadId && !selectedDeliveryTruckloadId) {
      toast.error('Please select at least one truckload for pickup or delivery')
      return
    }

    setIsLoading(true)

    try {
      const assignments: Promise<Response>[] = []

      // Assign pickup if selected
      if (selectedPickupTruckloadId) {
        assignments.push(
          fetch('/api/truckloads/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              truckloadId: selectedPickupTruckloadId,
              assignmentType: 'pickup',
              isTransferOrder: false
            })
          })
        )
      }

      // Assign delivery if selected
      if (selectedDeliveryTruckloadId) {
        assignments.push(
          fetch('/api/truckloads/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              truckloadId: selectedDeliveryTruckloadId,
              assignmentType: 'delivery',
              isTransferOrder: false
            })
          })
        )
      }

      const responses = await Promise.all(assignments)
      
      for (const response of responses) {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to assign order')
        }
      }

      const assignedTypes = []
      if (selectedPickupTruckloadId) assignedTypes.push('pickup')
      if (selectedDeliveryTruckloadId) assignedTypes.push('delivery')
      
      toast.success(`Order ${assignedTypes.join(' and ')} assigned successfully`)
      // Invalidate queries to refresh truckload manager and orders
      queryClient.invalidateQueries({ queryKey: ['truckloads'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['truckload-stops'] })
      onAssignmentChange()
      onClose()
    } catch (error) {
      console.error('Error assigning order:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign order')
    } finally {
      setIsLoading(false)
    }
  }

  // No need for currentAssignment - we'll show both separately

  // Group truckloads by driver
  const truckloadsByDriver = drivers.reduce((acc, driver) => {
    acc[driver.fullName] = {
      driverName: driver.fullName,
      driverColor: driver.color,
      truckloads: truckloads.filter(function filterDriverTruckloads(t) {
        return t.driverName === driver.fullName
      })
    }
    return acc
  }, {} as Record<string, { driverName: string; driverColor: string; truckloads: TruckloadSummary[] }>)

  const unassignedTruckloads = truckloads.filter(function filterUnassignedTruckloads(truckload) {
    return !truckload.driverName
  })

  // Convert to array and sort by driver name
  const driverColumns = [
    ...Object.values(truckloadsByDriver).sort((a, b) => 
      a.driverName.localeCompare(b.driverName)
    ),
    ...(unassignedTruckloads.length > 0
      ? [{
          driverName: 'Unassigned',
          driverColor: '#9ca3af',
          truckloads: unassignedTruckloads
        }]
      : [])
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-h-[90vh] flex flex-col max-w-[95vw] w-full"
      >
        <DialogHeader>
          <DialogTitle>Assign Order to Truckload</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 overflow-y-auto">
          {/* Current Assignments Status */}
          <div className="space-y-3">
            {pickupAssignment && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-red-800 mb-1">Pickup Assigned</div>
                    <div className="text-base text-gray-800">
                      {pickupCustomer.name} → {pickupAssignment.driverName || 'Truckload ' + pickupAssignment.truckloadId}
                    </div>
                    {(() => {
                      const truckload = truckloads.find(t => t.id === pickupAssignment.truckloadId);
                      if (truckload) {
                        const startDate = format(new Date(truckload.startDate), 'MM/dd');
                        const endDate = format(new Date(truckload.endDate), 'MM/dd');
                        return (
                          <div className="text-sm text-gray-600 mt-1">
                            {truckload.description || `${startDate} - ${endDate}`}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  {!isPickupLocked && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleUnassign('pickup')}
                      disabled={isUnassigning}
                    >
                      {isUnassigning ? 'Unassigning...' : 'Unassign Pickup'}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {deliveryAssignment && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-1">Delivery Assigned</div>
                    <div className="text-base text-gray-800">
                      {deliveryCustomer.name} → {deliveryAssignment.driverName || 'Truckload ' + deliveryAssignment.truckloadId}
                    </div>
                    {(() => {
                      const truckload = truckloads.find(t => t.id === deliveryAssignment.truckloadId);
                      if (truckload) {
                        const startDate = format(new Date(truckload.startDate), 'MM/dd');
                        const endDate = format(new Date(truckload.endDate), 'MM/dd');
                        return (
                          <div className="text-sm text-gray-600 mt-1">
                            {truckload.description || `${startDate} - ${endDate}`}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleUnassign('delivery')}
                    disabled={isUnassigning}
                  >
                    {isUnassigning ? 'Unassigning...' : 'Unassign Delivery'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Truckload Selection */}
          {!isPickupLocked && (
            <div className="space-y-2 flex-1 overflow-hidden">
              <Label>Select Truckload</Label>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600">
                  Showing {truckloadView === 'current' ? 'current' : 'completed'} truckloads sorted by earliest pickup
                </span>
                <Tabs value={truckloadView} onValueChange={handleTruckloadViewChange}>
                  <TabsList>
                    <TabsTrigger value="current">Current</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Driver Selector - Horizontal */}
              {driverColumns.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700 mr-2">Select Drivers:</span>
                  {driverColumns.map((driver) => (
                    <Button
                      key={driver.driverName}
                      variant={selectedDrivers.has(driver.driverName) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDriverSelection(driver.driverName)}
                      className="text-xs h-7"
                    >
                      <div
                        className="w-2 h-2 rounded-full mr-1.5"
                        style={{ backgroundColor: driver.driverColor }}
                      />
                      {driver.driverName}
                    </Button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                {driverColumns
                  .filter((driver) => selectedDrivers.has(driver.driverName))
                  .map((driver) => {
                    const completedCount = driver.truckloads.filter(t => t.isCompleted).length
                    
                    return (
                      <Card 
                        key={driver.driverName} 
                        className="w-full bg-white shadow-lg border-0 h-fit"
                        style={{
                          borderLeft: `4px solid ${driver.driverColor}`,
                        }}
                      >
                        <CardHeader className="pb-2 bg-gradient-to-r from-white to-gray-50/50 rounded-t-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <div 
                                className="w-3 h-3 rounded-full shadow-sm" 
                                style={{ backgroundColor: driver.driverColor }}
                              />
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold text-gray-900">
                                  {driver.driverName}
                                </CardTitle>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <Package className="h-2.5 w-2.5" />
                                    <span>{driver.truckloads.length} load{driver.truckloads.length !== 1 ? 's' : ''}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                                    <span>{completedCount} complete</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="space-y-3">
                            {driver.truckloads.map((truckload) => {
                              const isPickupSelected = selectedPickupTruckloadId === truckload.id
                              const isDeliverySelected = selectedDeliveryTruckloadId === truckload.id
                              const hasPickupSelection = selectedPickupTruckloadId !== null
                              const hasDeliverySelection = selectedDeliveryTruckloadId !== null
                              
                              return (
                                <Card 
                                  key={truckload.id}
                                  className={`p-3 transition-all duration-200 ${
                                    (isPickupSelected || isDeliverySelected)
                                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                      : truckload.isCompleted 
                                        ? 'border-green-200 bg-green-50/30' 
                                        : 'border-orange-200 bg-orange-50/30'
                                  }`}
                                >
                                  <div className="space-y-3">
                                    {/* Header with date and status */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3 text-gray-500" />
                                          <span className="text-xs font-semibold text-gray-900">
                                            {(() => {
                                              // Parse date as local date to avoid timezone conversion
                                              const dateParts = truckload.startDate.split('-')
                                              const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
                                              return format(date, 'MMM dd')
                                            })()}
                                          </span>
                                        </div>
                                        {truckload.isCompleted ? (
                                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs px-1.5 py-0.5">
                                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                            Complete
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">
                                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                                            In Progress
                                          </Badge>
                                        )}
                                      </div>
                                    </div>

                                    {/* Description */}
                                    <div className="text-xs text-gray-700 leading-tight">
                                      {truckload.description || (
                                        <span className="text-gray-500 italic">No description provided</span>
                                      )}
                                    </div>

                                    {/* Footage breakdown */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="bg-red-50 p-2 rounded border border-red-100">
                                        <div className="flex items-center gap-0.5 mb-0.5">
                                          <MapPin className="h-2.5 w-2.5 text-red-600" />
                                          <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">Pickup</div>
                                        </div>
                                        <div className="text-xs font-bold text-red-800">{truckload.pickupFootage.toLocaleString()} ft²</div>
                                      </div>
                                      <div className="bg-gray-50 p-2 rounded border border-gray-200">
                                        <div className="flex items-center gap-0.5 mb-0.5">
                                          <Truck className="h-2.5 w-2.5 text-gray-600" />
                                          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Delivery</div>
                                        </div>
                                        <div className="text-xs font-bold text-gray-800">{truckload.deliveryFootage.toLocaleString()} ft²</div>
                                      </div>
                                      <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                        <div className="flex items-center gap-0.5 mb-0.5">
                                          <Package className="h-2.5 w-2.5 text-blue-600" />
                                          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Transfer</div>
                                        </div>
                                        <div className="text-xs font-bold text-blue-800">{truckload.transferFootage.toLocaleString()} ft²</div>
                                      </div>
                                    </div>

                                    {/* Pickup and Delivery Selection Buttons */}
                                    <div className="flex gap-2 pt-2">
                                      <Button
                                        variant={isPickupSelected ? "default" : "outline"}
                                        size="sm"
                                        className={`flex-1 h-8 text-xs ${
                                          isPickupSelected 
                                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                                            : hasPickupSelection && !isPickupSelected
                                              ? 'opacity-50 cursor-not-allowed'
                                              : 'hover:bg-red-50'
                                        }`}
                                        onClick={() => handlePickupSelection(truckload.id)}
                                        disabled={hasPickupSelection && !isPickupSelected}
                                      >
                                        Pickup
                                      </Button>
                                      <Button
                                        variant={isDeliverySelected ? "default" : "outline"}
                                        size="sm"
                                        className={`flex-1 h-8 text-xs ${
                                          isDeliverySelected 
                                            ? 'bg-gray-700 hover:bg-gray-800 text-white' 
                                            : hasDeliverySelection && !isDeliverySelected
                                              ? 'opacity-50 cursor-not-allowed'
                                              : 'hover:bg-gray-50'
                                        }`}
                                        onClick={() => handleDeliverySelection(truckload.id)}
                                        disabled={hasDeliverySelection && !isDeliverySelected}
                                      >
                                        Delivery
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              )
                            })}
                            {driver.truckloads.length === 0 && (
                              <div className="text-center py-6">
                                <div className="p-3 bg-gray-50 rounded border-2 border-dashed border-gray-200">
                                  <Package className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                                  <p className="text-xs text-gray-500 font-medium">
                                No truckloads assigned
                              </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
            </div>
          )}

          {isPickupLocked && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-yellow-800">
                This order's pickup is already completed and assigned. You must unassign the current pickup before assigning a new one.
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!isPickupLocked && (
            <Button 
              onClick={handleAssign} 
              disabled={(!selectedPickupTruckloadId && !selectedDeliveryTruckloadId) || isLoading}
            >
              {isLoading ? 'Assigning...' : 'Assign'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 