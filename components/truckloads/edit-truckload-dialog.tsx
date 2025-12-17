"use client"

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

interface Driver {
  id: number
  full_name: string
  color: string
}

interface EditTruckloadDialogProps {
  isOpen: boolean
  onClose: () => void
  truckload: {
    id: number
    driverId: number
    startDate: string
    endDate: string
    trailerNumber: string | null
    description: string | null
    billOfLadingNumber?: string | null
  }
  onTruckloadUpdated: () => void
}

export function EditTruckloadDialog({ 
  isOpen, 
  onClose, 
  truckload,
  onTruckloadUpdated 
}: EditTruckloadDialogProps) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  // Helper function to parse date string without timezone issues
  const parseDateString = (dateString: string): Date => {
    // If already in YYYY-MM-DD format, parse manually to avoid timezone shifts
    if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = dateString.split('-')
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
      const day = parseInt(parts[2], 10)
      return new Date(year, month, day)
    }
    // Fallback to regular Date parsing
    return new Date(dateString)
  }

  const [formData, setFormData] = useState({
    driverId: truckload.driverId.toString(),
    trailerNumber: truckload.trailerNumber || "",
    description: truckload.description || "",
    billOfLadingNumber: truckload.billOfLadingNumber || "",
    startDate: truckload.startDate ? truckload.startDate.substring(0, 10) : "",
    startTime: truckload.startDate ? format(parseDateString(truckload.startDate), "HH:mm") : "",
    endDate: truckload.endDate ? truckload.endDate.substring(0, 10) : "",
    endTime: truckload.endDate ? format(parseDateString(truckload.endDate), "HH:mm") : "",
  })

  // Update form data when truckload changes
  useEffect(() => {
    setFormData({
      driverId: truckload.driverId.toString(),
      trailerNumber: truckload.trailerNumber || "",
      description: truckload.description || "",
      billOfLadingNumber: truckload.billOfLadingNumber || "",
      startDate: truckload.startDate ? truckload.startDate.substring(0, 10) : "",
      startTime: truckload.startDate ? format(parseDateString(truckload.startDate), "HH:mm") : "",
      endDate: truckload.endDate ? truckload.endDate.substring(0, 10) : "",
      endTime: truckload.endDate ? format(parseDateString(truckload.endDate), "HH:mm") : "",
    })
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
      if (!response.ok) {
        throw new Error(`Failed to fetch drivers: ${response.status}`)
      }
      const data = await response.json()
      if (!data.drivers) {
        throw new Error('Invalid response format from drivers API')
      }
      setDrivers(data.drivers)
    } catch (error) {
      console.error('Error fetching drivers:', error)
      toast.error('Failed to fetch drivers')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const response = await fetch(`/api/truckloads/${truckload.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          driverId: parseInt(formData.driverId),
          // Send dates as YYYY-MM-DD strings to avoid timezone issues
          startDate: formData.startDate,
          endDate: formData.endDate,
          trailerNumber: formData.trailerNumber || null,
          description: formData.description || null,
          bill_of_lading_number: formData.billOfLadingNumber || null
        })
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json()
          throw new Error(error.message || `Failed to update truckload: ${response.status}`)
        } else {
          throw new Error(`Failed to update truckload: ${response.status}`)
        }
      }
      
      toast.success('Truckload updated successfully')
      onTruckloadUpdated()
      onClose()
    } catch (error) {
      console.error('Error updating truckload:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update truckload')
    }
  }

  async function handleDelete() {
    try {
      const response = await fetch('/api/truckloads', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ id: truckload.id })
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          // API returns { success: false, error: '...' } or { success: false, message: '...' }
          throw new Error(errorData.error || errorData.message || `Failed to delete truckload: ${response.status}`)
        } else {
          throw new Error(`Failed to delete truckload: ${response.status}`)
        }
      }
      
      const result = await response.json()
      if (result.success) {
        toast.success(result.message || 'Truckload deleted successfully')
      onTruckloadUpdated()
      onClose()
      } else {
        throw new Error(result.error || result.message || 'Failed to delete truckload')
      }
    } catch (error) {
      console.error('Error deleting truckload:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete truckload')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Truckload</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                type="date"
                id="startDate"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                type="time"
                id="startTime"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                type="date"
                id="endDate"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                type="time"
                id="endTime"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
            </div>
          </div>

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
                placeholder="Enter trailer number"
              />
            </div>
          </div>

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

          <div className="flex justify-between pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Delete Truckload
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the truckload.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 