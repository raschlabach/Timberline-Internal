import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from 'sonner'
import { Card, CardContent } from "@/components/ui/card"
import { format, parseISO, isValid } from 'date-fns'
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Truckload {
  id: number
  driver_id: string
  start_date: string
  end_date: string
  trailer_number: string | null
  bill_of_lading_number: string | null
  description: string | null
  is_completed: boolean
  total_mileage: number
  estimated_duration: number
  driver_name: string | null
  driver_color: string | null
  pickup_footage: number
  delivery_footage: number
  transfer_footage: number
}

interface Driver {
  full_name: string
  color: string
}

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
  const [truckloads, setTruckloads] = useState<Truckload[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchData()
    } else {
      setTruckloads([])
      setSelectedTruckloadId(null)
      setIsLoading(false)
      setIsTransferring(false)
      setDrivers([])
    }
  }, [isOpen])

  const fetchData = async () => {
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
      setDrivers(driversData.drivers)

      // Transform the truckloads data
      const transformedTruckloads = truckloadsData.truckloads
        .filter((t: any) => !t.is_completed && t.id !== currentTruckloadId)
        .map((t: any) => ({
          id: t.id,
          driver_id: t.driverId,
          start_date: t.startDate,
          end_date: t.endDate,
          trailer_number: t.trailerNumber || null,
          bill_of_lading_number: t.billOfLadingNumber || null,
          description: t.description || null,
          is_completed: t.isCompleted || false,
          total_mileage: t.totalMileage || 0,
          estimated_duration: t.estimatedDuration || 0,
          driver_name: t.driverName || null,
          driver_color: t.driverColor || '#808080',
          pickup_footage: t.pickupFootage || 0,
          delivery_footage: t.deliveryFootage || 0,
          transfer_footage: t.transferFootage || 0
        }))
        .sort((a: any, b: any) => {
          const driverNameCompare = (a.driver_name || '').localeCompare(b.driver_name || '');
          if (driverNameCompare !== 0) return driverNameCompare;
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        });

      setTruckloads(transformedTruckloads)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load truckloads and drivers')
    } finally {
      setIsLoading(false)
    }
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
  const truckloadsByDriver = drivers.reduce((acc, driver) => {
    acc[driver.full_name] = {
      driverName: driver.full_name,
      driverColor: driver.color,
      truckloads: truckloads.filter(t => t.driver_name === driver.full_name)
    }
    return acc
  }, {} as Record<string, { driverName: string; driverColor: string; truckloads: Truckload[] }>)

  // Convert to array and sort by driver name
  const driverColumns = Object.values(truckloadsByDriver).sort((a, b) => 
    a.driverName.localeCompare(b.driverName)
  )

  // Calculate dialog width based on number of columns
  const getDialogWidth = () => {
    const columnWidth = 300 // width of each driver column
    const gapWidth = 16 // gap between columns
    const padding = 32 // padding on each side
    const minWidth = 800 // minimum width
    const maxWidth = 95 // maximum width as percentage of viewport

    // Calculate total width needed for all columns
    const totalColumnsWidth = (driverColumns.length * columnWidth) + 
                            ((driverColumns.length - 1) * gapWidth) + 
                            (padding * 2)

    // Get the maximum width allowed (95% of viewport)
    const maxAllowedWidth = (window.innerWidth * maxWidth) / 100

    // Return the larger of the calculated width or minimum width, but not exceeding max allowed
    return Math.min(Math.max(totalColumnsWidth, minWidth), maxAllowedWidth)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="h-[90vh] flex flex-col"
        style={{ 
          width: `${getDialogWidth()}px`,
          maxWidth: 'none' // Override any max-width constraints
        }}
      >
        <DialogHeader>
          <DialogTitle>Transfer Stop</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 overflow-hidden">
          {/* Selected Stop Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <Label>Selected Stop</Label>
            <div className="text-sm">
              <span className={assignmentType === 'pickup' ? 'text-red-600' : ''}>
                {assignmentType === 'pickup' ? 'Pickup' : 'Delivery'}
              </span>
            </div>
          </div>

          {/* Truckload Selection */}
          <div className="space-y-2 flex-1 overflow-hidden">
            <Label>Select Destination Truckload</Label>
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
                              onClick={() => setSelectedTruckloadId(truckload.id)}
                            >
                              <div className="mt-1 text-sm text-gray-600">
                                {formatDateRange(truckload.start_date, truckload.end_date) || (
                                  <span className="text-gray-400">No date range available</span>
                                )}
                              </div>
                              {truckload.trailer_number && (
                                <div className="mt-1 text-sm">
                                  Trailer: <span className="font-medium">{truckload.trailer_number}</span>
                                </div>
                              )}
                              <div className="mt-2 text-sm line-clamp-2">
                                {truckload.description}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                                <div className="whitespace-nowrap">
                                  <span className="text-red-600">Pickup:</span> {truckload.pickup_footage} ft²
                                </div>
                                <div className="whitespace-nowrap">
                                  <span>Delivery:</span> {truckload.delivery_footage} ft²
                                </div>
                                {truckload.transfer_footage > 0 && (
                                  <div className="whitespace-nowrap">
                                    <span className="text-blue-600">Transfer:</span> {truckload.transfer_footage} ft²
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
                {driverColumns.length === 0 && (
                  <div className="text-sm text-gray-500 italic">No available truckloads found</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isTransferring}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedTruckloadId || isTransferring}>
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
function formatDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) return null

  const start = parseISO(startDate)
  const end = parseISO(endDate)

  if (!isValid(start) || !isValid(end)) return null

  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
} 