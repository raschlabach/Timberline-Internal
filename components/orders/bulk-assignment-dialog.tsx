"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TruckloadSummary } from '@/types/truckloads'
import { ApiDriver, ApiTruckload, DriverOption, TruckloadView, filterAndSortTruckloads, mapDriverOption, mapTruckloadSummary } from '@/lib/truckload-utils'
import { ChevronDown, ChevronUp, Package, CheckCircle2 } from 'lucide-react'

// Component for truckload selection grid
function TruckloadSelectionGrid({
  driverColumns,
  collapsedDrivers,
  toggleDriverCollapse,
  selectedTruckloadId,
  onTruckloadSelect,
  selectionType
}: {
  driverColumns: Array<{ driverName: string; driverColor: string; truckloads: TruckloadSummary[] }>
  collapsedDrivers: Record<string, boolean>
  toggleDriverCollapse: (driverName: string) => void
  selectedTruckloadId: number | null
  onTruckloadSelect: (truckloadId: number) => void
  selectionType: 'pickup' | 'delivery'
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
      {driverColumns.map((driver) => {
        const isCollapsed = collapsedDrivers[driver.driverName] !== undefined ? collapsedDrivers[driver.driverName] : true
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -ml-1"
                    onClick={() => toggleDriverCollapse(driver.driverName)}
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
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
            {!isCollapsed && (
              <CardContent className="p-3">
                <div className="space-y-2">
                  {driver.truckloads.map((truckload) => (
                    <div
                      key={truckload.id}
                      className={`
                        p-3 rounded-lg border cursor-pointer transition-colors
                        ${selectedTruckloadId === truckload.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:bg-gray-50 border-gray-200'}
                      `}
                      onClick={() => onTruckloadSelect(truckload.id)}
                    >
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        {(() => {
                          // Parse date string manually to avoid timezone shifts
                          const parseDateString = (dateString: string): Date => {
                            if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
                              const parts = dateString.split('-')
                              const year = parseInt(parts[0], 10)
                              const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
                              const day = parseInt(parts[2], 10)
                              return new Date(year, month, day)
                            }
                            return new Date(dateString)
                          }
                          const startDate = parseDateString(truckload.startDate)
                          const endDate = parseDateString(truckload.endDate)
                          return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
                        })()}
                      </div>
                      {truckload.description && (
                        <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                          {truckload.description}
                        </div>
                      )}
                      {truckload.trailerNumber && (
                        <div className="text-xs text-gray-500 mb-2">
                          Trailer: <span className="font-medium">{truckload.trailerNumber}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        <div className="bg-red-50 p-1.5 rounded border border-red-100">
                          <div className="text-red-700 font-semibold">Pickup</div>
                          <div className="text-red-800 font-bold">{truckload.pickupFootage.toLocaleString()} ft²</div>
                        </div>
                        <div className="bg-gray-50 p-1.5 rounded border border-gray-200">
                          <div className="text-gray-700 font-semibold">Delivery</div>
                          <div className="text-gray-800 font-bold">{truckload.deliveryFootage.toLocaleString()} ft²</div>
                        </div>
                        {truckload.transferFootage > 0 ? (
                          <div className="bg-blue-50 p-1.5 rounded border border-blue-100">
                            <div className="text-blue-700 font-semibold">Transfer</div>
                            <div className="text-blue-800 font-bold">{truckload.transferFootage.toLocaleString()} ft²</div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-1.5 rounded border border-gray-200 opacity-50">
                            <div className="text-gray-500 font-semibold">Transfer</div>
                            <div className="text-gray-600 font-bold">0 ft²</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
            )}
            </Card>
        )
      })}
      </div>
  )
}

interface PoolItem {
  orderId: number
  assignmentTypes: ('pickup' | 'delivery')[]
  pickupCustomer: {
    id: number
    name: string
  }
  deliveryCustomer: {
    id: number
    name: string
  }
  footage: number
}

interface BulkAssignmentDialogProps {
  isOpen: boolean
  onClose: () => void
  poolItems: PoolItem[]
  onAssignmentComplete: () => void
}

export function BulkAssignmentDialog({ 
  isOpen, 
  onClose, 
  poolItems,
  onAssignmentComplete
}: BulkAssignmentDialogProps) {
  const [allTruckloads, setAllTruckloads] = useState<TruckloadSummary[]>([])
  const [truckloads, setTruckloads] = useState<TruckloadSummary[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedPickupTruckloadId, setSelectedPickupTruckloadId] = useState<number | null>(null)
  const [selectedDeliveryTruckloadId, setSelectedDeliveryTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [truckloadView, setTruckloadView] = useState<TruckloadView>('current')
  const [collapsedDrivers, setCollapsedDrivers] = useState<Record<string, boolean>>({})

  // Toggle driver column collapse
  const toggleDriverCollapse = (driverName: string) => {
    setCollapsedDrivers(prev => ({
      ...prev,
      [driverName]: !prev[driverName]
    }))
  }

  useEffect(() => {
    if (isOpen) {
      setTruckloadView('current')
      setSelectedPickupTruckloadId(null)
      setSelectedDeliveryTruckloadId(null)
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

  function handlePickupTruckloadSelection(truckloadId: number): void {
    setSelectedPickupTruckloadId(truckloadId)
  }

  function handleDeliveryTruckloadSelection(truckloadId: number): void {
    setSelectedDeliveryTruckloadId(truckloadId)
  }

  async function fetchData(): Promise<void> {
    setIsLoading(true)
    try {
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

      const driverOptions = (driversData.drivers as ApiDriver[]).map(function mapDriver(driver) {
        return mapDriverOption(driver)
      })
      setDrivers(driverOptions)

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

  async function handleAssign(): Promise<void> {
    // Check if we have the required selections
    const hasPickups = pickupCount > 0
    const hasDeliveries = deliveryCount > 0
    
    if (hasPickups && !selectedPickupTruckloadId) {
      toast.error('Please select a truckload for pickups')
      return
    }
    
    if (hasDeliveries && !selectedDeliveryTruckloadId) {
      toast.error('Please select a truckload for deliveries')
      return
    }

    setIsLoading(true)

    try {
      // Assign pickups first
      if (hasPickups && selectedPickupTruckloadId) {
      for (const item of poolItems) {
          if (item.assignmentTypes.includes('pickup')) {
          const response = await fetch('/api/truckloads/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: item.orderId,
                truckloadId: selectedPickupTruckloadId,
                assignmentType: 'pickup'
              })
            })

            if (!response.ok) {
              throw new Error(`Failed to assign order ${item.orderId} pickup`)
            }
          }
        }
      }

      // Then assign deliveries
      if (hasDeliveries && selectedDeliveryTruckloadId) {
        for (const item of poolItems) {
          if (item.assignmentTypes.includes('delivery')) {
            const response = await fetch('/api/truckloads/assign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: item.orderId,
                truckloadId: selectedDeliveryTruckloadId,
                assignmentType: 'delivery'
            })
          })

          if (!response.ok) {
              throw new Error(`Failed to assign order ${item.orderId} delivery`)
            }
          }
        }
      }

      toast.success('All orders assigned successfully')
      onAssignmentComplete()
      onClose()
    } catch (error) {
      console.error('Error assigning orders:', error)
      toast.error('Failed to assign orders')
    } finally {
      setIsLoading(false)
    }
  }

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
    ...Object.values(truckloadsByDriver).sort((a, b) => a.driverName.localeCompare(b.driverName)),
    ...(unassignedTruckloads.length > 0
      ? [{
          driverName: 'Unassigned',
          driverColor: '#9ca3af',
          truckloads: unassignedTruckloads
        }]
      : [])
  ]

  // Calculate total assignments
  const totalAssignments = poolItems.reduce((sum, item) => sum + item.assignmentTypes.length, 0)
  const pickupCount = poolItems.reduce((sum, item) => sum + (item.assignmentTypes.includes('pickup') ? 1 : 0), 0)
  const deliveryCount = poolItems.reduce((sum, item) => sum + (item.assignmentTypes.includes('delivery') ? 1 : 0), 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] flex flex-col" style={{ width: '95vw', maxWidth: 'none' }}>
        <DialogHeader>
          <DialogTitle>Bulk Assign Orders to Truckload</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 overflow-y-auto">
          {/* Assignment Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <Label className="text-lg font-semibold">Assignment Summary</Label>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Assignments:</span>
                <span className="ml-2 font-semibold">{totalAssignments}</span>
              </div>
              <div>
                <span className="text-red-600">Pickups:</span>
                <span className="ml-2 font-semibold">{pickupCount}</span>
              </div>
              <div>
                <span className="text-gray-900">Deliveries:</span>
                <span className="ml-2 font-semibold">{deliveryCount}</span>
              </div>
            </div>
            
            <ScrollArea className="h-24 mt-3">
              <div className="space-y-1">
                {poolItems.map((item, index) => (
                  <div key={`${item.orderId}-${index}`} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Order {item.orderId}</span>
                      <div className="flex gap-1">
                        {item.assignmentTypes.map(type => (
                          <Badge
                            key={type}
                            variant={type === 'pickup' ? 'destructive' : 'default'}
                            className="text-xs"
                          >
                            {type === 'pickup' ? 'Pickup' : 'Delivery'}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-gray-500">
                        ({item.assignmentTypes.includes('pickup') ? item.pickupCustomer.name : item.deliveryCustomer.name})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Truckload Selection - Split into Pickup and Delivery */}
          <div className="space-y-6 flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-lg font-semibold">Select Truckloads</Label>
              <Tabs value={truckloadView} onValueChange={handleTruckloadViewChange}>
                <TabsList>
                  <TabsTrigger value="current">Current</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Pickup Assignment Section */}
            {pickupCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold text-red-600">Pickup Assignments ({pickupCount})</Label>
                  {selectedPickupTruckloadId && (
                    <Badge variant="outline" className="text-xs">
                      Selected
                    </Badge>
                  )}
                        </div>
                <TruckloadSelectionGrid
                  driverColumns={driverColumns}
                  collapsedDrivers={collapsedDrivers}
                  toggleDriverCollapse={toggleDriverCollapse}
                  selectedTruckloadId={selectedPickupTruckloadId}
                  onTruckloadSelect={handlePickupTruckloadSelection}
                  selectionType="pickup"
                />
                                </div>
                              )}

            {/* Delivery Assignment Section */}
            {deliveryCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold text-gray-900">Delivery Assignments ({deliveryCount})</Label>
                  {selectedDeliveryTruckloadId && (
                    <Badge variant="outline" className="text-xs">
                      Selected
                    </Badge>
                                )}
                              </div>
                <TruckloadSelectionGrid
                  driverColumns={driverColumns}
                  collapsedDrivers={collapsedDrivers}
                  toggleDriverCollapse={toggleDriverCollapse}
                  selectedTruckloadId={selectedDeliveryTruckloadId}
                  onTruckloadSelect={handleDeliveryTruckloadSelection}
                  selectionType="delivery"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={
              isLoading || 
              (pickupCount > 0 && !selectedPickupTruckloadId) ||
              (deliveryCount > 0 && !selectedDeliveryTruckloadId)
            }
          >
            {isLoading ? 'Assigning...' : `Assign All (${totalAssignments})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
