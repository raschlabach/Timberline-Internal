"use client"

import { useState, useEffect } from 'react'
import { format, addDays, addWeeks } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from 'sonner'
import { Repeat, CalendarPlus, Loader2 } from 'lucide-react'
import type { PlannerDriver } from '@/types/truckloads'

type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'
type EndType = 'occurrences' | 'until_date'

interface DayOfWeek {
  value: number
  label: string
  short: string
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
]

interface RecurringDraftDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  drivers: PlannerDriver[]
}

export function RecurringDraftDialog({
  isOpen,
  onClose,
  onCreated,
  drivers,
}: RecurringDraftDialogProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewDates, setPreviewDates] = useState<string[]>([])

  const [formData, setFormData] = useState({
    driverId: '',
    description: '',
    trailerNumber: '',
    loadDuration: '1', // Number of days each load spans
    startDate: today,
    frequency: 'weekly' as RecurrenceFrequency,
    selectedDays: [1] as number[], // Days of week (for weekly/biweekly): 0=Sun, 1=Mon, etc.
    endType: 'occurrences' as EndType,
    occurrences: '4',
    untilDate: format(addWeeks(new Date(), 4), 'yyyy-MM-dd'),
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        driverId: '',
        description: '',
        trailerNumber: '',
        loadDuration: '1',
        startDate: today,
        frequency: 'weekly',
        selectedDays: [1],
        endType: 'occurrences',
        occurrences: '4',
        untilDate: format(addWeeks(new Date(), 4), 'yyyy-MM-dd'),
      })
    }
  }, [isOpen, today])

  // Calculate preview dates whenever recurrence settings change
  useEffect(() => {
    const dates = calculateOccurrences()
    setPreviewDates(dates)
  }, [formData.startDate, formData.frequency, formData.selectedDays, formData.endType, formData.occurrences, formData.untilDate])

  function toggleDay(day: number) {
    setFormData(prev => {
      const newDays = prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day].sort((a, b) => a - b)
      // Ensure at least one day is selected
      if (newDays.length === 0) return prev
      return { ...prev, selectedDays: newDays }
    })
  }

  function calculateOccurrences(): string[] {
    const dates: string[] = []
    const start = new Date(formData.startDate + 'T12:00:00') // Noon to avoid timezone issues
    const maxOccurrences = formData.endType === 'occurrences' ? parseInt(formData.occurrences) || 1 : 52
    const untilDate = formData.endType === 'until_date' ? new Date(formData.untilDate + 'T23:59:59') : null
    const maxSafetyLimit = 200 // Safety limit

    if (formData.frequency === 'daily') {
      let current = new Date(start)
      while (dates.length < maxOccurrences && dates.length < maxSafetyLimit) {
        if (untilDate && current > untilDate) break
        dates.push(format(current, 'yyyy-MM-dd'))
        current = addDays(current, 1)
      }
    } else if (formData.frequency === 'weekly' || formData.frequency === 'biweekly') {
      const weekIncrement = formData.frequency === 'biweekly' ? 2 : 1
      let weekStart = new Date(start)
      let safetyCounter = 0

      while (dates.length < maxOccurrences && safetyCounter < maxSafetyLimit) {
        // For each selected day in this week
        for (const dayOfWeek of formData.selectedDays) {
          if (dates.length >= maxOccurrences) break
          
          // Calculate the date for this day of the week
          const currentDayOfWeek = weekStart.getDay()
          let daysToAdd = dayOfWeek - currentDayOfWeek
          if (daysToAdd < 0) daysToAdd += 7
          
          const occurrenceDate = addDays(weekStart, daysToAdd)
          
          if (occurrenceDate < start) continue
          if (untilDate && occurrenceDate > untilDate) break
          
          dates.push(format(occurrenceDate, 'yyyy-MM-dd'))
        }
        
        weekStart = addWeeks(weekStart, weekIncrement)
        safetyCounter++
      }
    } else if (formData.frequency === 'monthly') {
      let current = new Date(start)
      while (dates.length < maxOccurrences && dates.length < maxSafetyLimit) {
        if (untilDate && current > untilDate) break
        dates.push(format(current, 'yyyy-MM-dd'))
        // Add one month
        const nextMonth = new Date(current)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        current = nextMonth
      }
    }

    return dates.sort()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.driverId) {
      toast.error('Please select a driver')
      return
    }

    if (previewDates.length === 0) {
      toast.error('No dates generated. Check your recurrence settings.')
      return
    }

    setIsSubmitting(true)

    try {
      const duration = parseInt(formData.loadDuration) || 1
      let successCount = 0
      let errorCount = 0

      // Create all the draft truckloads
      for (const date of previewDates) {
        const endDate = duration > 1
          ? format(addDays(new Date(date + 'T12:00:00'), duration - 1), 'yyyy-MM-dd')
          : date

        try {
          const response = await fetch('/api/truckloads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverId: parseInt(formData.driverId),
              startDate: date,
              endDate: endDate,
              trailerNumber: formData.trailerNumber || null,
              billOfLadingNumber: null,
              description: formData.description || '',
              status: 'draft',
            })
          })

          const result = await response.json()
          if (result.success) {
            successCount++
          } else {
            errorCount++
          }
        } catch {
          errorCount++
        }
      }

      if (successCount > 0) {
        toast.success(`Created ${successCount} recurring draft truckload${successCount !== 1 ? 's' : ''}`)
        onCreated()
        onClose()
      }
      if (errorCount > 0) {
        toast.error(`Failed to create ${errorCount} draft${errorCount !== 1 ? 's' : ''}`)
      }
    } catch (error) {
      console.error('Error creating recurring drafts:', error)
      toast.error('Failed to create recurring drafts')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-indigo-600" />
            Recurring Draft Truckloads
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Truckload details */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Truckload Details</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Driver</Label>
                <Select
                  value={formData.driverId}
                  onValueChange={(value) => setFormData({ ...formData, driverId: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: driver.color }} />
                          <span>{driver.full_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Trailer Number (Optional)</Label>
                <Input
                  value={formData.trailerNumber}
                  onChange={(e) => setFormData({ ...formData, trailerNumber: e.target.value })}
                  placeholder="Trailer #"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What's this recurring load for?"
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Load Duration (days per load)</Label>
              <Select
                value={formData.loadDuration}
                onValueChange={(value) => setFormData({ ...formData, loadDuration: value })}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="2">2 days</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="4">4 days</SelectItem>
                  <SelectItem value="5">5 days (Mon-Fri)</SelectItem>
                  <SelectItem value="7">7 days (full week)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Recurrence settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Recurrence Pattern</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Starting From</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Repeat Every</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value as RecurrenceFrequency })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Day</SelectItem>
                    <SelectItem value="weekly">Week</SelectItem>
                    <SelectItem value="biweekly">2 Weeks</SelectItem>
                    <SelectItem value="monthly">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Day of week selector - show for weekly/biweekly */}
            {(formData.frequency === 'weekly' || formData.frequency === 'biweekly') && (
              <div className="space-y-1.5">
                <Label className="text-xs">On These Days</Label>
                <div className="flex gap-1">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={formData.selectedDays.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 w-10 text-xs px-0 ${
                        formData.selectedDays.includes(day.value) 
                          ? 'bg-indigo-600 hover:bg-indigo-700' 
                          : ''
                      }`}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.short}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* End condition */}
            <div className="space-y-1.5">
              <Label className="text-xs">Ends</Label>
              <div className="flex items-center gap-3">
                <Select
                  value={formData.endType}
                  onValueChange={(value) => setFormData({ ...formData, endType: value as EndType })}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="occurrences">After</SelectItem>
                    <SelectItem value="until_date">On Date</SelectItem>
                  </SelectContent>
                </Select>

                {formData.endType === 'occurrences' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="52"
                      value={formData.occurrences}
                      onChange={(e) => setFormData({ ...formData, occurrences: e.target.value })}
                      className="h-9 w-20"
                    />
                    <span className="text-sm text-gray-500">occurrences</span>
                  </div>
                ) : (
                  <Input
                    type="date"
                    value={formData.untilDate}
                    onChange={(e) => setFormData({ ...formData, untilDate: e.target.value })}
                    className="h-9"
                  />
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Preview */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">
              Preview ({previewDates.length} draft{previewDates.length !== 1 ? 's' : ''} will be created)
            </h3>
            <div className="max-h-[120px] overflow-y-auto bg-gray-50 rounded-lg p-2 space-y-1">
              {previewDates.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No dates generated</p>
              ) : (
                previewDates.map((date, idx) => {
                  const duration = parseInt(formData.loadDuration) || 1
                  const endDate = duration > 1
                    ? format(addDays(new Date(date + 'T12:00:00'), duration - 1), 'MMM d')
                    : null
                  const dateObj = new Date(date + 'T12:00:00')

                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <CalendarPlus className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      <span className="text-gray-600">
                        {format(dateObj, 'EEE, MMM d, yyyy')}
                        {endDate && ` → ${endDate}`}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || previewDates.length === 0 || !formData.driverId}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Creating {previewDates.length} Drafts...
                </>
              ) : (
                <>
                  <Repeat className="h-3.5 w-3.5 mr-1.5" />
                  Create {previewDates.length} Draft{previewDates.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
