"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'
import type { PlannerDriver, DriverScheduleEvent, ScheduleEventType } from '@/types/truckloads'

interface DriverScheduleDialogProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
  drivers: PlannerDriver[]
  events: DriverScheduleEvent[]
  defaultDriverId?: number | null
  defaultDate?: string | null
}

const EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  vacation: 'Vacation',
  sick: 'Sick Day',
  unavailable: 'Unavailable',
  other: 'Other',
}

const EVENT_TYPE_COLORS: Record<ScheduleEventType, string> = {
  vacation: 'bg-purple-100 text-purple-800 border-purple-200',
  sick: 'bg-red-100 text-red-800 border-red-200',
  unavailable: 'bg-gray-100 text-gray-800 border-gray-200',
  other: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

export function DriverScheduleDialog({
  isOpen,
  onClose,
  onUpdated,
  drivers,
  events,
  defaultDriverId,
  defaultDate,
}: DriverScheduleDialogProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [formData, setFormData] = useState({
    driverId: defaultDriverId?.toString() || '',
    eventType: 'vacation' as ScheduleEventType,
    startDate: defaultDate || today,
    endDate: defaultDate || today,
    description: '',
  })

  useEffect(() => {
    if (isOpen) {
      setFormData({
        driverId: defaultDriverId?.toString() || '',
        eventType: 'vacation',
        startDate: defaultDate || today,
        endDate: defaultDate || today,
        description: '',
      })
      setIsCreating(false)
    }
  }, [isOpen, defaultDriverId, defaultDate, today])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/driver-schedule-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: parseInt(formData.driverId),
          eventType: formData.eventType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          description: formData.description || null,
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Schedule event created')
        setIsCreating(false)
        onUpdated()
      } else {
        throw new Error(result.error || 'Failed to create event')
      }
    } catch (error) {
      console.error('Error creating schedule event:', error)
      toast.error('Failed to create schedule event')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(eventId: number) {
    try {
      const response = await fetch(`/api/driver-schedule-events/${eventId}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Event deleted')
        onUpdated()
      } else {
        throw new Error(result.error || 'Failed to delete event')
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error('Failed to delete event')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Driver Schedule</DialogTitle>
        </DialogHeader>

        {/* Existing events */}
        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Schedule Events</h3>
            <Button size="sm" variant="outline" onClick={() => setIsCreating(true)} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Event
            </Button>
          </div>

          {events.length === 0 && !isCreating && (
            <p className="text-sm text-gray-500 text-center py-4">No schedule events yet</p>
          )}

          {events.map((event) => (
            <div
              key={event.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${EVENT_TYPE_COLORS[event.eventType]}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{event.driverName}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/50">
                    {EVENT_TYPE_LABELS[event.eventType]}
                  </span>
                </div>
                <div className="text-xs mt-0.5 opacity-75">
                  {event.startDate === event.endDate
                    ? event.startDate
                    : `${event.startDate} → ${event.endDate}`}
                </div>
                {event.description && (
                  <div className="text-xs mt-1">{event.description}</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-red-100 hover:text-red-700"
                onClick={() => handleDelete(event.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Create form */}
        {isCreating && (
          <form onSubmit={handleCreate} className="space-y-3 pt-3 border-t mt-3">
            <h3 className="text-sm font-medium text-gray-700">New Event</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Driver</Label>
                <Select
                  value={formData.driverId}
                  onValueChange={(value) => setFormData({ ...formData, driverId: value })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: driver.color }} />
                          <span>{driver.full_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={formData.eventType}
                  onValueChange={(value) => setFormData({ ...formData, eventType: value as ScheduleEventType })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENT_TYPE_LABELS) as ScheduleEventType[]).map((type) => (
                      <SelectItem key={type} value={type}>{EVENT_TYPE_LABELS[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="h-8"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="h-8"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description (Optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Details..."
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!formData.driverId || isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Add Event'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
