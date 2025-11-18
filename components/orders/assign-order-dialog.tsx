"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format, parseISO, isValid } from 'date-fns'
import { toast } from 'sonner'
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TruckloadSummary } from '@/types/truckloads'
import { ApiDriver, ApiTruckload, DriverOption, TruckloadView, filterAndSortTruckloads, mapDriverOption, mapTruckloadSummary } from '@/lib/truckload-utils'
import { useQueryClient } from '@tanstack/react-query'

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

function getDialogWidth(columnCount: number): number {
  const columnWidth = 300 // width of each driver column
  const gapWidth = 16 // gap between columns
  const padding = 32 // padding on each side
  const minWidth = 800 // minimum width
  const maxWidthPercentage = 95 // maximum width as percentage of viewport

  const totalColumnsWidth = (columnCount * columnWidth) +
    ((Math.max(columnCount - 1, 0)) * gapWidth) +
    (padding * 2)

  const maxAllowedWidth = (typeof window !== 'undefined' ? (window.innerWidth * maxWidthPercentage) / 100 : minWidth)

  return Math.min(Math.max(totalColumnsWidth, minWidth), maxAllowedWidth)
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
  const [assignmentType, setAssignmentType] = useState<'pickup' | 'delivery'>('pickup')
  const [allTruckloads, setAllTruckloads] = useState<TruckloadSummary[]>([])
  const [truckloads, setTruckloads] = useState<TruckloadSummary[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUnassigning, setIsUnassigning] = useState(false)
  const [truckloadView, setTruckloadView] = useState<TruckloadView>('current')

  // Check if pickup assignment is locked
  const isPickupLocked = Boolean(isPickupCompleted && pickupAssignment)

  useEffect(() => {
    if (isOpen) {
      setTruckloadView('current')
      setSelectedTruckloadId(null)
      fetchData()
    }
  }, [isOpen])

  useEffect(() => {
    setTruckloads(filterAndSortTruckloads(allTruckloads, truckloadView))
  }, [allTruckloads, truckloadView])

  useEffect(() => {
    if (selectedTruckloadId && !truckloads.some(function hasSelection(truckload) {
      return truckload.id === selectedTruckloadId
    })) {
      setSelectedTruckloadId(null)
    }
  }, [truckloads, selectedTruckloadId])

  function handleTruckloadViewChange(nextValue: string): void {
    const view = nextValue === 'completed' ? 'completed' : 'current'
    setTruckloadView(view)
  }

  function handleTruckloadSelection(truckloadId: number): void {
    setSelectedTruckloadId(truckloadId)
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

  async function handleUnassign() {
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

      toast.success('Order unassigned successfully')
      // Invalidate queries to refresh truckload manager and orders
      queryClient.invalidateQueries({ queryKey: ['truckloads'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['truckload-stops'] })
      onAssignmentChange()
      onClose()
    } catch (error) {
      console.error('Error unassigning order:', error)
      toast.error('Failed to unassign order')
    } finally {
      setIsUnassigning(false)
    }
  }

  async function handleAssign() {
    if (!selectedTruckloadId) {
      toast.error('Please select a truckload')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/truckloads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          truckloadId: selectedTruckloadId,
          assignmentType,
          isTransferOrder
        })
      })

      if (!response.ok) throw new Error('Failed to assign order')

      toast.success('Order assigned successfully')
      // Invalidate queries to refresh truckload manager and orders
      queryClient.invalidateQueries({ queryKey: ['truckloads'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['truckload-stops'] })
      onAssignmentChange()
      onClose()
    } catch (error) {
      console.error('Error assigning order:', error)
      toast.error('Failed to assign order')
    } finally {
      setIsLoading(false)
    }
  }

  // Get current assignment based on type
  const currentAssignment = assignmentType === 'pickup' ? pickupAssignment : deliveryAssignment

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
        className="max-h-[90vh] flex flex-col"
        style={{ 
          width: `${getDialogWidth(driverColumns.length)}px`,
          maxWidth: 'none' // Override any max-width constraints
        }}
      >
        <DialogHeader>
          <DialogTitle>Assign Order to Truckload</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 overflow-hidden">
          {/* Assignment Type Selection */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Assignment Type</Label>
            <div className="flex gap-4">
              <Button
                variant={assignmentType === 'pickup' ? 'default' : 'outline'}
                className={`flex-1 h-12 text-lg ${
                  assignmentType === 'pickup' ? 'bg-red-600 hover:bg-red-700' : ''
                }`}
                onClick={() => {
                  if (!isPickupLocked) {
                    setAssignmentType('pickup')
                    setSelectedTruckloadId(null)
                  }
                }}
                disabled={isPickupLocked}
              >
                <div className="flex flex-col items-center">
                  <span>Pickup</span>
                  <span className="text-sm font-normal">
                    {pickupCustomer.name}
                    {pickupAssignment && (
                      <span className="ml-1 text-gray-500">
                        (Assigned to {pickupAssignment.driverName || 'Truckload ' + pickupAssignment.truckloadId})
                      </span>
                    )}
                  </span>
                  {isPickupLocked && (
                    <span className="text-xs text-red-500 mt-1">
                      Must unassign current pickup first
                    </span>
                  )}
                </div>
              </Button>
              <Button
                variant={assignmentType === 'delivery' ? 'default' : 'outline'}
                className="flex-1 h-12 text-lg"
                onClick={() => {
                  setAssignmentType('delivery')
                  setSelectedTruckloadId(null)
                }}
              >
                <div className="flex flex-col items-center">
                  <span>Delivery</span>
                  <span className="text-sm font-normal">
                    {deliveryCustomer.name}
                    {deliveryAssignment && (
                      <span className="ml-1 text-gray-500">
                        (Assigned to {deliveryAssignment.driverName || 'Truckload ' + deliveryAssignment.truckloadId})
                      </span>
                    )}
                  </span>
                </div>
              </Button>
            </div>
          </div>

          {/* Current Assignment Status */}
          {currentAssignment && (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <div className="text-lg font-semibold text-gray-800">
                {assignmentType === 'pickup' ? 'Pickup' : 'Delivery'} assigned to{' '}
                {currentAssignment.driverName || 'Truckload ' + currentAssignment.truckloadId}
                {(() => {
                  const truckload = truckloads.find(t => t.id === currentAssignment.truckloadId);
                  if (truckload) {
                    const startDate = format(new Date(truckload.startDate), 'MM/dd');
                    const endDate = format(new Date(truckload.endDate), 'MM/dd');
                    return ` ${startDate} - ${endDate}`;
                  }
                  return '';
                })()}
              </div>
              {(() => {
                const truckload = truckloads.find(t => t.id === currentAssignment.truckloadId);
                if (truckload && truckload.description) {
                  return (
                    <div className="text-base text-gray-600 mt-2">
                      {truckload.description}
                    </div>
                  );
                }
                return null;
              })()}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUnassign}
                disabled={isUnassigning}
                className="mt-3"
              >
                {isUnassigning ? 'Unassigning...' : 'Unassign'}
              </Button>
            </div>
          )}

          {/* Truckload Selection */}
          {!currentAssignment && !isPickupLocked && (
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
              <ScrollArea className="h-full">
                <div className="flex gap-4 p-4">
                  {driverColumns.map((driver) => (
                    <div 
                      key={driver.driverName} 
                      className="w-[300px] flex-shrink-0"
                      style={{ minWidth: '300px' }} // Ensure minimum width
                    >
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-4">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: driver.driverColor }}
                            />
                            <span className="font-medium truncate">{driver.driverName}</span>
                          </div>
                          <div className="space-y-2">
                            {driver.truckloads.map((truckload) => (
                              <div
                                key={truckload.id}
                                className={`
                                  p-3 rounded-lg border cursor-pointer transition-colors
                                  ${selectedTruckloadId === truckload.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'}
                                `}
                                onClick={() => handleTruckloadSelection(truckload.id)}
                              >
                                <div className="mt-1 text-sm text-gray-600">
                                  {formatDateRange(truckload.startDate, truckload.endDate) || (
                                    <span className="text-gray-400">No date range available</span>
                                  )}
                                </div>
                                {truckload.trailerNumber && (
                                  <div className="mt-1 text-sm">
                                    Trailer: <span className="font-medium">{truckload.trailerNumber}</span>
                                  </div>
                                )}
                                <div className="mt-2 text-sm line-clamp-2">
                                  {truckload.description}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                                  <div className="whitespace-nowrap">
                                    <span className="text-red-600">Pickup:</span> {truckload.pickupFootage} ft²
                                  </div>
                                  <div className="whitespace-nowrap">
                                    <span>Delivery:</span> {truckload.deliveryFootage} ft²
                                  </div>
                                  {truckload.transferFootage > 0 && (
                                    <div className="whitespace-nowrap">
                                      <span className="text-blue-600">Transfer:</span> {truckload.transferFootage} ft²
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {driver.truckloads.length === 0 && (
                              <p className="text-sm text-gray-500 text-center py-4">
                                No truckloads assigned
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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
          {!currentAssignment && !isPickupLocked && (
            <Button onClick={handleAssign} disabled={!selectedTruckloadId || isLoading}>
              {isLoading ? 'Assigning...' : 'Assign'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 