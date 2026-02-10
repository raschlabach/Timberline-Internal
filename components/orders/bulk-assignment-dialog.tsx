"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from 'date-fns'
import { toast } from 'sonner'
import { TruckloadSummary } from '@/types/truckloads'
import { ApiDriver, ApiTruckload, DriverOption, mapDriverOption, mapTruckloadSummary } from '@/lib/truckload-utils'
import { Package, CheckCircle2, Calendar, Clock, MapPin, Truck } from 'lucide-react'

// Component for truckload selection grid
function TruckloadSelectionGrid({
  driverColumns,
  selectedDrivers,
  toggleDriverSelection,
  selectedPickupTruckloadId,
  selectedDeliveryTruckloadId,
  onPickupSelect,
  onDeliverySelect,
  selectionType
}: {
  driverColumns: Array<{ driverName: string; driverColor: string; truckloads: TruckloadSummary[] }>
  selectedDrivers: Set<string>
  toggleDriverSelection: (driverName: string) => void
  selectedPickupTruckloadId: number | null
  selectedDeliveryTruckloadId: number | null
  onPickupSelect: (truckloadId: number) => void
  onDeliverySelect: (truckloadId: number) => void
  selectionType: 'pickup' | 'delivery'
}) {
  const hasPickupSelection = selectedPickupTruckloadId !== null
  const hasDeliverySelection = selectedDeliveryTruckloadId !== null

  return (
    <>
      {/* Driver Selector - Horizontal */}
      {driverColumns.length > 0 && (
        <div className="flex items-center gap-2.5 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
          <span className="text-sm font-medium text-gray-700 mr-2">Select Drivers:</span>
          {driverColumns.map((driver) => (
            <Button
              key={driver.driverName}
              variant={selectedDrivers.has(driver.driverName) ? "default" : "outline"}
              onClick={() => toggleDriverSelection(driver.driverName)}
              className="text-sm h-9 px-4"
            >
              <div
                className="w-2.5 h-2.5 rounded-full mr-2"
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
                                onClick={() => onPickupSelect(truckload.id)}
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
                                onClick={() => onDeliverySelect(truckload.id)}
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
    </>
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
  const [truckloads, setTruckloads] = useState<TruckloadSummary[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedPickupTruckloadId, setSelectedPickupTruckloadId] = useState<number | null>(null)
  const [selectedDeliveryTruckloadId, setSelectedDeliveryTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set())

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
      setSelectedPickupTruckloadId(null)
      setSelectedDeliveryTruckloadId(null)
      setSelectedDrivers(new Set()) // Reset selection on dialog open
      fetchData()
    }
  }, [isOpen])

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
        fetch('/api/truckloads?activeOnly=true'),
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

      setTruckloads(mappedTruckloads)
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
      }).sort(function sortNewestFirst(a, b) {
        const aTime = a.startDate ? new Date(a.startDate).getTime() : 0
        const bTime = b.startDate ? new Date(b.startDate).getTime() : 0
        return bTime - aTime
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
          {/* Truckload Selection - Split into Pickup and Delivery */}
          <div className="space-y-6 flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-lg font-semibold">Select Truckloads</Label>
            </div>

            {/* Combined Truckload Selection - Shows both pickup and delivery buttons on each truckload */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Select Truckloads
            {pickupCount > 0 && (
                  <span className="text-red-600 ml-2">Pickups: {pickupCount}</span>
                )}
                {deliveryCount > 0 && (
                  <span className="text-gray-900 ml-2">Deliveries: {deliveryCount}</span>
                  )}
              </Label>
                <TruckloadSelectionGrid
                  driverColumns={driverColumns}
                selectedDrivers={selectedDrivers}
                toggleDriverSelection={toggleDriverSelection}
                selectedPickupTruckloadId={selectedPickupTruckloadId}
                selectedDeliveryTruckloadId={selectedDeliveryTruckloadId}
                onPickupSelect={handlePickupTruckloadSelection}
                onDeliverySelect={handleDeliveryTruckloadSelection}
                  selectionType="pickup"
                />
                                </div>
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
