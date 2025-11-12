"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from 'date-fns'
import { toast } from 'sonner'

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
  id: string
  full_name: string
  color: string
}

export default function AssignStopsDialog({ 
  isOpen, 
  onClose, 
  selectedLocations,
  onAssignmentComplete
}: AssignStopsDialogProps) {
  const [truckloads, setTruckloads] = useState<Truckload[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  const fetchData = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching truckloads...');
      const truckloadsResponse = await fetch('/api/truckloads');
      if (!truckloadsResponse.ok) {
        console.error('Failed to fetch truckloads:', truckloadsResponse.status, truckloadsResponse.statusText);
        throw new Error('Failed to fetch truckloads');
      }
      const truckloadsData = await truckloadsResponse.json();
      console.log('Fetched truckloads:', truckloadsData);

      console.log('Fetching drivers...');
      const driversResponse = await fetch('/api/drivers');
      if (!driversResponse.ok) {
        console.error('Failed to fetch drivers:', driversResponse.status, driversResponse.statusText);
        throw new Error('Failed to fetch drivers');
      }
      const driversData = await driversResponse.json();
      console.log('Fetched drivers:', driversData);

      // Filter out completed truckloads
      const activeTruckloads = truckloadsData.truckloads.filter((t: any) => !t.is_completed);
      console.log('Active truckloads:', activeTruckloads);

      setTruckloads(activeTruckloads);
      setDrivers(driversData.drivers);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load truckloads and drivers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  async function handleAssign() {
    if (!selectedTruckloadId) {
      toast.error('Please select a truckload')
      return
    }

    setIsLoading(true)

    try {
      // Assign each selected location
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Orders to Truckload</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 overflow-hidden">
          {/* Selected Orders Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <Label>Selected Orders ({selectedLocations.length})</Label>
            <ScrollArea className="h-24">
              <div className="space-y-1">
                {selectedLocations.map((location) => (
                  <div key={`${location.id}-${location.type}`} className="text-sm">
                    <span className={location.type === 'pickup' ? 'text-red-600' : ''}>
                      {location.customerName}
                    </span>
                    <span className="text-gray-500 ml-2">
                      ({location.type === 'pickup' ? 'Pickup' : 'Delivery'})
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Truckload Selection */}
          <div className="space-y-2 flex-1 overflow-hidden">
            <Label>Select Truckload</Label>
            <ScrollArea className="h-full">
              <div className="grid grid-flow-col auto-cols-[300px] gap-4 p-4">
                {driverColumns.map((driver) => (
                  <div key={driver.driverName} className="flex flex-col min-w-[300px]">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b sticky top-0 bg-white">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: driver.driverColor }}
                      />
                      <h3 className="font-medium">{driver.driverName}</h3>
                    </div>
                    <div className="space-y-3">
                      {driver.truckloads.map((truckload) => (
                        <div
                          key={truckload.id}
                          className={`
                            p-4 rounded-lg border cursor-pointer transition-colors bg-white shadow-sm hover:shadow-md
                            ${selectedTruckloadId === truckload.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'}
                          `}
                          onClick={() => setSelectedTruckloadId(truckload.id)}
                        >
                          <div className="text-lg font-semibold text-gray-900 tracking-tight">
                            {format(new Date(truckload.start_date), 'MMM d')} - {format(new Date(truckload.end_date), 'MMM d, yyyy')}
                          </div>
                          <div className="mt-3 text-base font-semibold text-gray-800 leading-tight">
                            {truckload.description || 'No description'}
                          </div>
                          <div className="mt-3 flex gap-4 text-sm text-gray-500">
                            <div>
                              <span className="text-red-600">Pickup:</span> {truckload.pickup_footage} ft²
                            </div>
                            <div>
                              <span>Delivery:</span> {truckload.delivery_footage} ft²
                            </div>
                            <div>
                              <span className="text-blue-600">Transfer:</span> {truckload.transfer_footage} ft²
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedTruckloadId || isLoading}>
            {isLoading ? 'Assigning...' : 'Assign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 