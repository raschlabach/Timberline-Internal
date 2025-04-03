"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from 'date-fns'
import { toast } from 'sonner'

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
}

interface Truckload {
  id: number;
  driver_id: string;
  start_date: string;
  end_date: string;
  trailer_number: string | null;
  bill_of_lading_number: string | null;
  description: string | null;
  is_completed: boolean;
  total_mileage: number;
  estimated_duration: number;
  driver_name: string | null;
  driver_color: string | null;
  pickup_footage: number;
  delivery_footage: number;
  transfer_footage: number;
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
  onAssignmentChange 
}: AssignOrderDialogProps) {
  const [assignmentType, setAssignmentType] = useState<'pickup' | 'delivery'>('pickup')
  const [truckloads, setTruckloads] = useState<Truckload[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUnassigning, setIsUnassigning] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchTruckloads()
    }
  }, [isOpen])

  async function fetchTruckloads() {
    try {
      const response = await fetch('/api/truckloads')
      if (!response.ok) throw new Error('Failed to fetch truckloads')
      const data = await response.json()
      if (!data.success) throw new Error('Failed to fetch truckloads')
      setTruckloads(data.truckloads.filter((t: Truckload) => !t.is_completed))
    } catch (error) {
      console.error('Error fetching truckloads:', error)
      toast.error('Failed to load truckloads')
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Order to Truckload</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 overflow-hidden">
          {/* Assignment Type Selection */}
          <div className="space-y-2">
            <Label>Assignment Type</Label>
            <RadioGroup
              value={assignmentType}
              onValueChange={(value) => {
                setAssignmentType(value as 'pickup' | 'delivery')
                setSelectedTruckloadId(null)
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup" className="text-red-600">
                  Pickup - {pickupCustomer.name}
                  {pickupAssignment && (
                    <span className="ml-2 text-sm text-gray-500">
                      (Assigned to {pickupAssignment.driverName || 'Truckload ' + pickupAssignment.truckloadId})
                    </span>
                  )}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delivery" id="delivery" />
                <Label htmlFor="delivery">
                  Delivery - {deliveryCustomer.name}
                  {deliveryAssignment && (
                    <span className="ml-2 text-sm text-gray-500">
                      (Assigned to {deliveryAssignment.driverName || 'Truckload ' + deliveryAssignment.truckloadId})
                    </span>
                  )}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Current Assignment Status */}
          {currentAssignment && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium">Current Assignment</div>
              <div className="text-sm text-gray-600 mt-1">
                Assigned to {currentAssignment.driverName || 'Truckload ' + currentAssignment.truckloadId}
                {currentAssignment.truckloadNumber && ` (${currentAssignment.truckloadNumber})`}
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUnassign}
                disabled={isUnassigning}
                className="mt-2"
              >
                {isUnassigning ? 'Unassigning...' : 'Unassign'}
              </Button>
            </div>
          )}

          {/* Truckload Selection */}
          {!currentAssignment && (
            <div className="space-y-2 flex-1 overflow-hidden">
              <Label>Select Truckload</Label>
              <ScrollArea className="h-full border rounded-md">
                <div className="p-4 space-y-2">
                  {truckloads.map((truckload) => (
                    <div
                      key={truckload.id}
                      className={`
                        p-3 rounded-lg border cursor-pointer transition-colors
                        ${selectedTruckloadId === truckload.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'}
                      `}
                      onClick={() => setSelectedTruckloadId(truckload.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: truckload.driver_color || '#808080' }}
                        />
                        <span className="font-medium">{truckload.driver_name}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {format(new Date(truckload.start_date), 'MMM d')} - {format(new Date(truckload.end_date), 'MMM d, yyyy')}
                      </div>
                      {truckload.trailer_number && (
                        <div className="mt-1 text-sm">
                          Trailer: <span className="font-medium">{truckload.trailer_number}</span>
                        </div>
                      )}
                      <div className="mt-2 text-sm">
                        {truckload.description}
                      </div>
                      <div className="mt-2 flex gap-4 text-sm">
                        <div>
                          <span className="text-red-600">Pickup:</span> {truckload.pickup_footage} ft²
                        </div>
                        <div>
                          <span>Delivery:</span> {truckload.delivery_footage} ft²
                        </div>
                        {truckload.transfer_footage > 0 && (
                          <div>
                            <span className="text-blue-600">Transfer:</span> {truckload.transfer_footage} ft²
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!currentAssignment && (
            <Button onClick={handleAssign} disabled={!selectedTruckloadId || isLoading}>
              {isLoading ? 'Assigning...' : 'Assign'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 