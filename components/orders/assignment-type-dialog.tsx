"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"

interface AssignmentTypeDialogProps {
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
  onAddToPool: (orderId: number, assignmentTypes: ('pickup' | 'delivery')[]) => void
}

export function AssignmentTypeDialog({ 
  isOpen, 
  onClose, 
  orderId, 
  pickupCustomer, 
  deliveryCustomer,
  pickupAssignment,
  deliveryAssignment,
  onAddToPool
}: AssignmentTypeDialogProps) {
  const [selectedTypes, setSelectedTypes] = useState<('pickup' | 'delivery')[]>([])

  // Determine which types are available for selection
  const pickupAvailable = !pickupAssignment
  const deliveryAvailable = !deliveryAssignment

  const handleTypeToggle = (type: 'pickup' | 'delivery') => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type)
      } else {
        return [...prev, type]
      }
    })
  }

  const handleAddToPool = () => {
    if (selectedTypes.length > 0) {
      onAddToPool(orderId, selectedTypes)
      onClose()
      setSelectedTypes([])
    }
  }

  const handleClose = () => {
    onClose()
    setSelectedTypes([])
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Assignment Pool</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Select which parts to add to the assignment pool:</Label>
            
            {/* Pickup Option */}
            <Card 
              className={`cursor-pointer transition-colors ${!pickupAvailable ? 'opacity-50' : 'hover:bg-gray-50'} ${
                selectedTypes.includes('pickup') ? 'ring-2 ring-red-500 bg-red-50' : ''
              }`}
              onClick={() => pickupAvailable && handleTypeToggle('pickup')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="pickup"
                    checked={selectedTypes.includes('pickup')}
                    onCheckedChange={() => handleTypeToggle('pickup')}
                    disabled={!pickupAvailable}
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor="pickup" 
                      className={`text-base font-medium ${!pickupAvailable ? 'text-gray-500' : 'text-red-600'}`}
                    >
                      Pickup
                    </Label>
                    <div className="text-sm text-gray-600 mt-1">
                      {pickupCustomer.name}
                    </div>
                    {!pickupAvailable && (
                      <div className="text-xs text-red-500 mt-1">
                        Already assigned to {pickupAssignment?.driverName || 'Truckload ' + pickupAssignment?.truckloadId}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Option */}
            <Card 
              className={`cursor-pointer transition-colors ${!deliveryAvailable ? 'opacity-50' : 'hover:bg-gray-50'} ${
                selectedTypes.includes('delivery') ? 'ring-2 ring-gray-500 bg-gray-50' : ''
              }`}
              onClick={() => deliveryAvailable && handleTypeToggle('delivery')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="delivery"
                    checked={selectedTypes.includes('delivery')}
                    onCheckedChange={() => handleTypeToggle('delivery')}
                    disabled={!deliveryAvailable}
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor="delivery" 
                      className={`text-base font-medium ${!deliveryAvailable ? 'text-gray-500' : 'text-gray-900'}`}
                    >
                      Delivery
                    </Label>
                    <div className="text-sm text-gray-600 mt-1">
                      {deliveryCustomer.name}
                    </div>
                    {!deliveryAvailable && (
                      <div className="text-xs text-red-500 mt-1">
                        Already assigned to {deliveryAssignment?.driverName || 'Truckload ' + deliveryAssignment?.truckloadId}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {!pickupAvailable && !deliveryAvailable && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-yellow-800 text-sm">
                This order is already fully assigned. Both pickup and delivery have been assigned to truckloads.
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddToPool} 
            disabled={selectedTypes.length === 0}
          >
            Add to Pool ({selectedTypes.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
