"use client"

import { useState, useEffect } from 'react'
import { format, addDays } from 'date-fns'
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
  type LoadType = 'day' | 'overnight' | 'manual'

  const today = format(new Date(), 'yyyy-MM-dd')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadType, setLoadType] = useState<LoadType>('day')
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
      setLoadType('day')
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

  function handleLoadTypeChange(type: LoadType) {
    setLoadType(type)
    const startDate = formData.startDate || today
    if (type === 'day') {
      setFormData((prev) => ({
        ...prev,
        startTime: '',
        endDate: startDate,
        endTime: '',
      }))
    } else if (type === 'overnight') {
      const nextDay = format(addDays(new Date(startDate + 'T12:00:00'), 1), 'yyyy-MM-dd')
      setFormData((prev) => ({
        ...prev,
        startTime: '12:00',
        endDate: nextDay,
        endTime: '14:00',
      }))
    }
    // 'manual' leaves everything as-is for the user to fill in
  }

  function handleStartDateChange(newStartDate: string) {
    if (loadType === 'day') {
      setFormData((prev) => ({ ...prev, startDate: newStartDate, endDate: newStartDate }))
    } else if (loadType === 'overnight') {
      const nextDay = format(addDays(new Date(newStartDate + 'T12:00:00'), 1), 'yyyy-MM-dd')
      setFormData((prev) => ({ ...prev, startDate: newStartDate, endDate: nextDay, startTime: '12:00', endTime: '14:00' }))
    } else {
      setFormData((prev) => ({ ...prev, startDate: newStartDate }))
    }
  }

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

          {/* Load Type Toggle */}
          <div className="space-y-2">
            <Label>Load Type</Label>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
              {([
                { value: 'day' as LoadType, label: 'Day Load' },
                { value: 'overnight' as LoadType, label: 'Overnight Load' },
                { value: 'manual' as LoadType, label: 'Manual' },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                    loadType === option.value
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => handleLoadTypeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {loadType === 'day'
                ? 'Same-day load — end date matches start date, no times set.'
                : loadType === 'overnight'
                ? 'Starts at 12:00 PM, ends next day at 2:00 PM.'
                : 'Set all dates and times manually.'}
            </p>
          </div>

          {/* Start Date — always shown */}
          <div className="space-y-2">
            <Label htmlFor="draft-startDate">Start Date</Label>
            <Input
              type="date"
              id="draft-startDate"
              value={formData.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              required
            />
          </div>

          {/* Manual-only fields */}
          {loadType === 'manual' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="draft-startTime">Start Time</Label>
                <Input
                  type="time"
                  id="draft-startTime"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
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
                <Label htmlFor="draft-endTime">End Time</Label>
                <Input
                  type="time"
                  id="draft-endTime"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Summary for non-manual */}
          {loadType !== 'manual' && formData.startDate && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
              {loadType === 'day'
                ? `${formData.startDate} — full day`
                : `${formData.startDate} at 12:00 PM → ${formData.endDate} at 2:00 PM`}
            </div>
          )}

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
