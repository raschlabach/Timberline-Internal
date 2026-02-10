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
import type { PlannerDriver } from '@/types/truckloads'

interface CreateDraftDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  drivers: PlannerDriver[]
  defaultDriverId?: number | null
  defaultDate?: string | null
}

export function CreateDraftDialog({
  isOpen,
  onClose,
  onCreated,
  drivers,
  defaultDriverId,
  defaultDate
}: CreateDraftDialogProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    driverId: defaultDriverId?.toString() || '',
    startDate: defaultDate || today,
    startTime: '',
    endDate: defaultDate || today,
    endTime: '',
    trailerNumber: '',
    description: '',
  })

  useEffect(() => {
    if (isOpen) {
      setFormData({
        driverId: defaultDriverId?.toString() || '',
        startDate: defaultDate || today,
        startTime: '',
        endDate: defaultDate || today,
        endTime: '',
        trailerNumber: '',
        description: '',
      })
    }
  }, [isOpen, defaultDriverId, defaultDate, today])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/truckloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: parseInt(formData.driverId),
          startDate: formData.startDate,
          endDate: formData.endDate,
          startTime: formData.startTime || null,
          endTime: formData.endTime || null,
          trailerNumber: formData.trailerNumber || null,
          billOfLadingNumber: null,
          description: formData.description || '',
          status: 'draft'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Draft truckload created')
        onCreated()
        onClose()
      } else {
        throw new Error(data.error || 'Failed to create draft')
      }
    } catch (error) {
      console.error('Error creating draft truckload:', error)
      toast.error('Failed to create draft truckload')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            Create Draft Truckload
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="draft-driver">Driver</Label>
            <Select
              value={formData.driverId}
              onValueChange={(value) => setFormData({ ...formData, driverId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }} />
                      <span>{driver.full_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="draft-startDate">Start Date</Label>
              <Input
                type="date"
                id="draft-startDate"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-startTime">Start Time (Optional)</Label>
              <Input
                type="time"
                id="draft-startTime"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="draft-endDate">End Date</Label>
              <Input
                type="date"
                id="draft-endDate"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-endTime">End Time (Optional)</Label>
              <Input
                type="time"
                id="draft-endTime"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="draft-trailer">Trailer Number (Optional)</Label>
            <Input
              type="text"
              id="draft-trailer"
              value={formData.trailerNumber}
              onChange={(e) => setFormData({ ...formData, trailerNumber: e.target.value })}
              placeholder="Enter trailer number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="draft-description">Description</Label>
            <Textarea
              id="draft-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What's planned for this load?"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.driverId || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Draft'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
