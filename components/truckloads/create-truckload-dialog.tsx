"use client"

import { useState, useEffect } from 'react'
import { format, startOfWeek } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner'
import { Truck } from 'lucide-react'

interface Driver {
  id: number
  fullName: string
  color: string
}

interface CreateTruckloadDialogProps {
  onTruckloadCreated?: () => void
}

interface FormData {
  driverId: string
  trailerNumber: string
  billOfLadingNumber: string
  description: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  totalMileage: number
  estimatedDuration: number
}

export function CreateTruckloadDialog({ onTruckloadCreated }: CreateTruckloadDialogProps) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const today = new Date()
  const sundayOfCurrentWeek = startOfWeek(today, { weekStartsOn: 0 })
  const [formData, setFormData] = useState<FormData>({
    driverId: "",
    trailerNumber: "",
    billOfLadingNumber: "",
    description: "",
    startDate: format(sundayOfCurrentWeek, "yyyy-MM-dd"),
    startTime: "08:00",
    endDate: format(sundayOfCurrentWeek, "yyyy-MM-dd"),
    endTime: "17:00",
    totalMileage: 0,
    estimatedDuration: 0,
  })

  // Fetch drivers on component mount
  useEffect(() => {
    fetchDrivers()
  }, [])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/truckloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: parseInt(formData.driverId),
          startDate: `${formData.startDate}T${formData.startTime}:00`,
          endDate: `${formData.endDate}T${formData.endTime}:00`,
          trailerNumber: formData.trailerNumber || null,
          description: formData.description
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success('Truckload created successfully')
        onTruckloadCreated?.()
        resetForm()
      } else {
        throw new Error(data.error || 'Failed to create truckload')
      }
    } catch (error) {
      console.error('Error creating truckload:', error)
      toast.error('Failed to create truckload')
    }
  }

  function resetForm() {
    const resetSunday = startOfWeek(new Date(), { weekStartsOn: 0 })
    setFormData({
      driverId: '',
      trailerNumber: '',
      billOfLadingNumber: '',
      description: '',
      startDate: format(resetSunday, "yyyy-MM-dd"),
      startTime: '08:00',
      endDate: format(resetSunday, "yyyy-MM-dd"),
      endTime: '17:00',
      totalMileage: 0,
      estimatedDuration: 0,
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="default">
          <Truck className="mr-2 h-4 w-4" />
          Create Truckload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Truckload</DialogTitle>
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
                      <span>{driver.fullName}</span>
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

          <div className="space-y-2">
            <Label htmlFor="trailerNumber">Trailer Number (Optional)</Label>
            <Input
              type="text"
              id="trailerNumber"
              value={formData.trailerNumber}
              onChange={(e) => setFormData({ ...formData, trailerNumber: e.target.value })}
              placeholder="Enter trailer number"
            />
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

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="submit">
              Create Truckload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 