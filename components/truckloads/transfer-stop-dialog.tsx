"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, parseISO, isValid } from 'date-fns'
import { Loader2, ChevronDown, ChevronUp, Package, CheckCircle2 } from "lucide-react"
import { TruckloadSummary } from '@/types/truckloads'
import { ApiDriver, ApiTruckload, DriverOption, mapDriverOption, mapTruckloadSummary } from '@/lib/truckload-utils'

interface TransferStopDialogProps {
  isOpen: boolean
  onClose: () => void
  onTransferComplete: () => void
  currentTruckloadId: number
  orderId: number
  assignmentType: 'pickup' | 'delivery'
}

export function TransferStopDialog({
  isOpen,
  onClose,
  onTransferComplete,
  currentTruckloadId,
  orderId,
  assignmentType
}: TransferStopDialogProps) {
  const [allTruckloads, setAllTruckloads] = useState<TruckloadSummary[]>([])
  const [truckloads, setTruckloads] = useState<TruckloadSummary[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [collapsedDrivers, setCollapsedDrivers] = useState<Record<string, boolean>>({})

  // Toggle driver column collapse
  function toggleDriverCollapse(driverName: string): void {
    setCollapsedDrivers(prev => ({
      ...prev,
      [driverName]: !prev[driverName]
    }))
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedTruckloadId(null)
      fetchData()
    } else {
      setAllTruckloads([])
      setTruckloads([])
      setSelectedTruckloadId(null)
      setIsLoading(false)
      setIsTransferring(false)
      setDrivers([])
      setCollapsedDrivers({})
    }
  }, [isOpen])

  useEffect(() => {
    // Filter out current truckload and completed truckloads, then sort
    const filtered = allTruckloads.filter(function filterTruckloads(t) {
      return !t.isCompleted && t.id !== currentTruckloadId
    }).sort(function sortByPickupDate(first, second) {
      const firstTimestamp = first.startDate ? new Date(first.startDate).getTime() : Number.POSITIVE_INFINITY
      const secondTimestamp = second.startDate ? new Date(second.startDate).getTime() : Number.POSITIVE_INFINITY
      return firstTimestamp - secondTimestamp
    })
    setTruckloads(filtered)
  }, [allTruckloads, currentTruckloadId])

  async function fetchData(): Promise<void> {
    setIsLoading(true)
    try {
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

  function handleTruckloadSelection(truckloadId: number): void {
    setSelectedTruckloadId(truckloadId)
  }

  const handleTransfer = async () => {
    if (!selectedTruckloadId) {
      toast.error('Please select a truckload')
      return
    }

    setIsTransferring(true)

    try {
      // First unassign from current truckload
      const unassignResponse = await fetch('/api/truckloads/assign', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          assignmentType
        })
      })

      if (!unassignResponse.ok) {
        const error = await unassignResponse.json()
        throw new Error(error.error || 'Failed to unassign stop')
      }

      // Then assign to new truckload
      const assignResponse = await fetch('/api/truckloads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          truckloadId: selectedTruckloadId,
          assignmentType,
          isTransferOrder: true // Set this to true since we're transferring
        })
      })

      if (!assignResponse.ok) {
        const error = await assignResponse.json()
        throw new Error(error.error || 'Failed to assign stop to new truckload')
      }

      toast.success('Stop transferred successfully')
      onTransferComplete()
      onClose()
    } catch (error) {
      console.error('Error transferring stop:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to transfer stop')
    } finally {
      setIsTransferring(false)
    }
  }

  // Group truckloads by driver
  const truckloadsByDriver = drivers.reduce(function groupByDriver(acc, driver) {
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
    ...Object.values(truckloadsByDriver).sort(function sortDrivers(a, b) {
      return a.driverName.localeCompare(b.driverName)
    }),
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
          <DialogTitle>Transfer Stop</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 overflow-y-auto">
          {/* Selected Stop Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <Label className="text-lg font-semibold">Selected Stop</Label>
            <div className="text-base">
              <span className={assignmentType === 'pickup' ? 'text-red-600 font-semibold' : 'font-semibold'}>
                {assignmentType === 'pickup' ? 'Pickup' : 'Delivery'}
              </span>
            </div>
          </div>

          {/* Truckload Selection */}
          <div className="space-y-2 flex-1 overflow-hidden">
            <Label className="text-lg font-semibold">Select Destination Truckload</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                {driverColumns.map(function renderDriver(driver) {
                  const isCollapsed = collapsedDrivers[driver.driverName] !== undefined ? collapsedDrivers[driver.driverName] : true
                  const completedCount = driver.truckloads.filter(function filterCompleted(t) {
                    return t.isCompleted
                  }).length
                  
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
                            {driver.truckloads.map(function renderTruckload(truckload) {
                              return (
                                <div
                                  key={truckload.id}
                                  className={`
                                    p-3 rounded-lg border cursor-pointer transition-colors
                                    ${selectedTruckloadId === truckload.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:bg-gray-50 border-gray-200'}
                                  `}
                                  onClick={() => handleTruckloadSelection(truckload.id)}
                                >
                                  <div className="text-xs font-medium text-gray-700 mb-1">
                                    {formatDateRange(truckload.startDate, truckload.endDate) || (
                                      <span className="text-gray-400">No date range</span>
                                    )}
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
                      )}
                    </Card>
                  )
                })}
                {driverColumns.length === 0 && !isLoading && (
                  <div className="col-span-full text-center py-12">
                    <div className="text-sm text-gray-500 italic">No available truckloads found</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isTransferring}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedTruckloadId || isTransferring || isLoading}>
            {isTransferring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              'Transfer'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Helper function to format date range
function formatDateRange(startDate: string | undefined, endDate: string | undefined): string | null {
  if (!startDate || !endDate) return null

  const parsedStart = parseISO(startDate)
  const parsedEnd = parseISO(endDate)

  if (!isValid(parsedStart) || !isValid(parsedEnd)) return null

  return `${format(parsedStart, 'MMM d')} - ${format(parsedEnd, 'MMM d, yyyy')}`
} 