"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Package, CheckCircle2, Calendar, Clock, MapPin, Truck } from 'lucide-react'
import { ApiDriver, ApiTruckload, mapDriverOption, mapTruckloadSummary } from '@/lib/truckload-utils'
import { TruckloadSummary } from '@/types/truckloads'

interface AssignStopsDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedLocations: Array<{
    id: number
    type: 'pickup' | 'delivery'
    customerName: string
  }>
  onAssignmentComplete: () => void
}

export default function AssignStopsDialog({ 
  isOpen, 
  onClose, 
  selectedLocations,
  onAssignmentComplete
}: AssignStopsDialogProps) {
  const [truckloads, setTruckloads] = useState<TruckloadSummary[]>([])
  const [drivers, setDrivers] = useState<{ id: string; fullName: string; color: string }[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set())

  function toggleDriverSelection(driverName: string) {
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
    }
  }, [isOpen])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [truckloadsResponse, driversResponse] = await Promise.all([
        fetch('/api/truckloads'),
        fetch('/api/drivers'),
      ])
      if (!truckloadsResponse.ok) throw new Error('Failed to fetch truckloads')
      if (!driversResponse.ok) throw new Error('Failed to fetch drivers')

      const [truckloadsData, driversData] = await Promise.all([
        truckloadsResponse.json(),
        driversResponse.json(),
      ])

      if (!truckloadsData.success) throw new Error('Failed to fetch truckloads')
      if (!driversData.success) throw new Error('Failed to fetch drivers')

      const driverOptions = (driversData.drivers as ApiDriver[]).map(d => mapDriverOption(d))
      setDrivers(driverOptions)

      const mapped = (truckloadsData.truckloads as ApiTruckload[]).map(t => mapTruckloadSummary(t))
      setTruckloads(mapped)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load truckloads and drivers.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAssign() {
    if (!selectedTruckloadId) {
      toast.error('Please select a truckload')
      return
    }

    setIsLoading(true)

    try {
      for (const location of selectedLocations) {
        const response = await fetch('/api/truckloads/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: location.id,
            truckloadId: selectedTruckloadId,
            assignmentType: location.type
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to assign order ${location.id}`)
        }
      }

      toast.success('Orders assigned successfully')
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
      truckloads: truckloads
        .filter(t => t.driverName === driver.fullName)
        .sort((a, b) => {
          const aTime = a.startDate ? new Date(a.startDate).getTime() : Number.POSITIVE_INFINITY
          const bTime = b.startDate ? new Date(b.startDate).getTime() : Number.POSITIVE_INFINITY
          return aTime - bTime
        })
    }
    return acc
  }, {} as Record<string, { driverName: string; driverColor: string; truckloads: TruckloadSummary[] }>)

  const driverColumns = Object.values(truckloadsByDriver).sort((a, b) =>
    a.driverName.localeCompare(b.driverName)
  )

  const pickupCount = selectedLocations.filter(l => l.type === 'pickup').length
  const deliveryCount = selectedLocations.filter(l => l.type === 'delivery').length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] flex flex-col" style={{ width: '95vw', maxWidth: 'none' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Assign Orders to Truckload
            <div className="flex items-center gap-2 ml-2">
              {pickupCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {pickupCount} Pickup{pickupCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {deliveryCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {deliveryCount} Deliver{deliveryCount !== 1 ? 'ies' : 'y'}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          {/* Selected Orders Summary */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <Label className="text-sm font-medium text-gray-700">Selected Orders ({selectedLocations.length})</Label>
            <ScrollArea className="h-20 mt-2">
              <div className="space-y-1">
                {selectedLocations.map((location) => (
                  <div key={`${location.id}-${location.type}`} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: location.type === 'pickup' ? '#DC2626' : '#000000' }}
                    />
                    <span className={location.type === 'pickup' ? 'text-red-700 font-medium' : 'text-gray-900 font-medium'}>
                      {location.customerName}
                    </span>
                    <span className="text-gray-400 text-xs">
                      ({location.type === 'pickup' ? 'Pickup' : 'Delivery'})
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Driver Selector - Horizontal */}
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

          {/* Truckload Selection Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
              {driverColumns
                .filter((driver) => selectedDrivers.has(driver.driverName))
                .map((driver) => {
                  const completedCount = driver.truckloads.filter(t => t.isCompleted).length

                  return (
                    <Card
                      key={driver.driverName}
                      className="w-full bg-white shadow-lg border-0 h-fit"
                      style={{ borderLeft: `4px solid ${driver.driverColor}` }}
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
                            const isSelected = selectedTruckloadId === truckload.id

                            return (
                              <Card
                                key={truckload.id}
                                className={`p-3 transition-all duration-200 cursor-pointer ${
                                  isSelected
                                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                    : truckload.isCompleted
                                      ? 'border-green-200 bg-green-50/30 hover:bg-green-50/60'
                                      : 'border-orange-200 bg-orange-50/30 hover:bg-orange-50/60'
                                }`}
                                onClick={() => setSelectedTruckloadId(isSelected ? null : truckload.id)}
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
                                    {isSelected && (
                                      <Badge className="bg-primary text-white text-xs px-1.5 py-0.5">
                                        Selected
                                      </Badge>
                                    )}
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
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedTruckloadId || isLoading}>
            {isLoading ? 'Assigning...' : `Assign ${selectedLocations.length} Order${selectedLocations.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
