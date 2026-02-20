"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from 'date-fns'
import { Loader2, Package, CheckCircle2, Calendar, Clock, MapPin, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { TruckloadSummary } from '@/types/truckloads'
import { ApiDriver, ApiTruckload, DriverOption, mapDriverOption, mapTruckloadSummary } from '@/lib/truckload-utils'

interface BatchTransferStop {
  orderId: number
  assignmentType: 'pickup' | 'delivery'
}

interface BatchTransferDialogProps {
  isOpen: boolean
  onClose: () => void
  onTransferComplete: () => void
  currentTruckloadId: number
  stops: BatchTransferStop[]
}

export function BatchTransferDialog({
  isOpen,
  onClose,
  onTransferComplete,
  currentTruckloadId,
  stops
}: BatchTransferDialogProps) {
  const [truckloads, setTruckloads] = useState<TruckloadSummary[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set())

  function toggleDriverSelection(driverName: string): void {
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
      setSelectedTruckloadId(null)
      setSelectedDrivers(new Set())
      fetchData()
    } else {
      setTruckloads([])
      setSelectedTruckloadId(null)
      setIsLoading(false)
      setIsTransferring(false)
      setDrivers([])
      setSelectedDrivers(new Set())
    }
  }, [isOpen])

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

      const mappedTruckloads = truckloadsData.truckloads
        .map(function mapData(truckload: ApiTruckload) {
          return mapTruckloadSummary(truckload)
        })
        .filter(function filterCurrent(t: TruckloadSummary) {
          return t.id !== currentTruckloadId
        })

      setTruckloads(mappedTruckloads)
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

  async function handleBatchTransfer(): Promise<void> {
    if (!selectedTruckloadId) {
      toast.error('Please select a destination truckload')
      return
    }

    setIsTransferring(true)

    try {
      let successCount = 0

      for (const stop of stops) {
        // Unassign from current truckload
        const unassignResponse = await fetch('/api/truckloads/assign', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: stop.orderId,
            assignmentType: stop.assignmentType
          })
        })

        if (!unassignResponse.ok) {
          const error = await unassignResponse.json()
          throw new Error(error.error || `Failed to unassign order ${stop.orderId}`)
        }

        // Assign to new truckload
        const assignResponse = await fetch('/api/truckloads/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: stop.orderId,
            truckloadId: selectedTruckloadId,
            assignmentType: stop.assignmentType,
            isTransferOrder: true
          })
        })

        if (!assignResponse.ok) {
          const error = await assignResponse.json()
          throw new Error(error.error || `Failed to assign order ${stop.orderId}`)
        }

        successCount++
      }

      toast.success(`${successCount} stop${successCount !== 1 ? 's' : ''} transferred successfully`)
      onTransferComplete()
      onClose()
    } catch (error) {
      console.error('Error batch transferring stops:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to transfer stops')
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
      }).sort(function sortOldestFirst(a, b) {
        const aTime = a.startDate ? new Date(a.startDate).getTime() : Number.POSITIVE_INFINITY
        const bTime = b.startDate ? new Date(b.startDate).getTime() : Number.POSITIVE_INFINITY
        return aTime - bTime
      })
    }
    return acc
  }, {} as Record<string, { driverName: string; driverColor: string; truckloads: TruckloadSummary[] }>)

  const unassignedTruckloads = truckloads.filter(function filterUnassignedTruckloads(truckload) {
    return !truckload.driverName
  })

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

  const pickupCount = stops.filter(s => s.assignmentType === 'pickup').length
  const deliveryCount = stops.filter(s => s.assignmentType === 'delivery').length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[90vh] flex flex-col max-w-[95vw] w-full"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Batch Transfer Stops
            <Badge variant="secondary">{stops.length} stop{stops.length !== 1 ? 's' : ''}</Badge>
            {pickupCount > 0 && (
              <Badge variant="destructive" className="text-xs">{pickupCount} pickup{pickupCount !== 1 ? 's' : ''}</Badge>
            )}
            {deliveryCount > 0 && (
              <Badge className="text-xs bg-gray-800">{deliveryCount} deliver{deliveryCount !== 1 ? 'ies' : 'y'}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          {/* Truckload Selection */}
          <div className="space-y-2 flex-1 overflow-hidden">
            <Label className="text-lg font-semibold">Select Destination Truckload</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Driver Selector */}
                {driverColumns.length > 0 && (
                  <div className="flex items-center gap-2.5 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200">
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
                    .map(function renderDriver(driver) {
                      return (
                        <Card
                          key={driver.driverName}
                          className="w-full bg-white shadow-lg border-0 h-fit"
                          style={{ borderLeft: `4px solid ${driver.driverColor}` }}
                        >
                          <CardHeader className="pb-2 bg-gradient-to-r from-white to-gray-50/50 rounded-t-lg">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base font-semibold text-gray-900">
                                {driver.driverName}
                              </CardTitle>
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Package className="h-2.5 w-2.5" />
                                <span>{driver.truckloads.length} load{driver.truckloads.length !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3">
                            <div className="space-y-3">
                              {driver.truckloads.map(function renderTruckload(truckload) {
                                return (
                                  <Card
                                    key={truckload.id}
                                    className={`p-3 transition-all duration-200 cursor-pointer ${
                                      selectedTruckloadId === truckload.id
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                        : 'border-orange-200 bg-orange-50/30 hover:border-orange-300 hover:shadow-md'
                                    }`}
                                    onClick={() => handleTruckloadSelection(truckload.id)}
                                  >
                                    <div className="space-y-3">
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
                                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">
                                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                                            In Progress
                                          </Badge>
                                        </div>
                                      </div>

                                      <div className="text-xs text-gray-700 leading-tight">
                                        {truckload.description || (
                                          <span className="text-gray-500 italic">No description provided</span>
                                        )}
                                      </div>

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
                                    </div>
                                  </Card>
                                )
                              })}
                              {driver.truckloads.length === 0 && (
                                <div className="text-center py-6">
                                  <div className="p-3 bg-gray-50 rounded border-2 border-dashed border-gray-200">
                                    <Package className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                                    <p className="text-xs text-gray-500 font-medium">No truckloads assigned</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  {driverColumns.length === 0 && !isLoading && (
                    <div className="col-span-full text-center py-12">
                      <div className="text-sm text-gray-500 italic">No available truckloads found</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isTransferring}>
            Cancel
          </Button>
          <Button
            onClick={handleBatchTransfer}
            disabled={!selectedTruckloadId || isTransferring || isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isTransferring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              `Transfer ${stops.length} Stop${stops.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
