"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"

interface TruckloadDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  truckload: {
    id: number
    driverId?: number | null
    driverName: string | null
    driverColor: string | null
    startDate: string
    endDate: string
    description: string | null
    billOfLadingNumber: string | null
    trailerNumber: string | null
    isCompleted: boolean
  }
  onTruckloadUpdated?: () => void
}

interface Driver {
  id: number
  full_name: string
  color: string
}

export function TruckloadDetailsDialog({ 
  isOpen, 
  onClose, truckload, 
  onTruckloadUpdated 
}: TruckloadDetailsDialogProps) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [formData, setFormData] = useState({
    driverId: '',
    startDate: '',
    endDate: '',
    description: '',
    billOfLadingNumber: '',
    trailerNumber: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const queryClient = useQueryClient()

  // Update form data when truckload changes
  useEffect(() => {
    if (truckload) {
      setFormData({
        driverId: truckload.driverId ? truckload.driverId.toString() : '',
        startDate: truckload.startDate ? truckload.startDate.slice(0, 10) : '',
        endDate: truckload.endDate ? truckload.endDate.slice(0, 10) : '',
        description: truckload.description || '',
        billOfLadingNumber: truckload.billOfLadingNumber || '',
        trailerNumber: truckload.trailerNumber || ''
      })
    }
  }, [truckload])

  // Fetch drivers when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchDrivers()
    }
  }, [isOpen])

  async function fetchDrivers() {
    try {
      const response = await fetch('/api/drivers')
      const data = await response.json()
      if (data.success) {
        setDrivers(data.drivers)
      }
    } catch (error) {
      toast.error('Failed to fetch drivers')
    }
  }

  const updateTruckload = useMutation({
    mutationFn: async (updates: any) => {
      const response = await fetch(`/api/truckloads/${truckload.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error("Failed to update truckload")
      const data = await response.json()
      if (!data.success) throw new Error("Failed to update truckload")
      return data.truckload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["truckload", truckload.id] })
      toast.success('Truckload updated successfully')
      onTruckloadUpdated?.()
      onClose()
    },
    onError: (error) => {
      toast.error('Failed to update truckload')
      console.error('Update error:', error)
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validation
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate)
      const endDate = new Date(formData.endDate)
      if (startDate > endDate) {
        toast.error('Start date cannot be after end date')
        return
      }
    }

    if (formData.driverId && !formData.driverId) {
      toast.error('Please select a driver')
      return
    }

    setIsLoading(true)
    
    try {
      const updates: any = {}
      
      if (formData.driverId) {
        updates.driverId = parseInt(formData.driverId)
      }
      if (formData.startDate) {
        // Send date as YYYY-MM-DD string to avoid timezone issues
        updates.startDate = typeof formData.startDate === 'string' 
          ? formData.startDate.split('T')[0] 
          : format(new Date(formData.startDate), 'yyyy-MM-dd')
      }
      if (formData.endDate) {
        // Send date as YYYY-MM-DD string to avoid timezone issues
        updates.endDate = typeof formData.endDate === 'string' 
          ? formData.endDate.split('T')[0] 
          : format(new Date(formData.endDate), 'yyyy-MM-dd')
      }
      if (formData.description !== undefined) {
        updates.description = formData.description
      }
      if (formData.billOfLadingNumber !== undefined) {
        updates.bill_of_lading_number = formData.billOfLadingNumber
      }
      if (formData.trailerNumber !== undefined) {
        updates.trailer_number = formData.trailerNumber
      }

      await updateTruckload.mutateAsync(updates)
    } catch (error) {
      console.error('Error updating truckload:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleCancel() {
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Truckload Details</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Driver */}
          <div className="space-y-2">
            <Label htmlFor="driver">Driver</Label>
            <Select 
              value={formData.driverId} 
              onValueChange={(value) => setFormData({ ...formData, driverId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem 
                    key={driver.id} 
                    value={driver.id.toString()}
                  >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: driver.color }}
                      />
                      <span>{driver.full_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                type="date"
                id="startDate"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                type="date"
                id="endDate"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter truckload description"
              rows={3}
            />
          </div>

          {/* BOL and Trailer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billOfLadingNumber">Bill of Lading Number</Label>
              <Input
                type="text"
                id="billOfLadingNumber"
                value={formData.billOfLadingNumber}
                onChange={(e) => setFormData({ ...formData, billOfLadingNumber: e.target.value })}
                placeholder="BOL number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trailerNumber">Trailer Number</Label>
              <Input
                type="text"
                id="trailerNumber"
                value={formData.trailerNumber}
                onChange={(e) => setFormData({ ...formData, trailerNumber: e.target.value })}
                placeholder="Trailer number"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
