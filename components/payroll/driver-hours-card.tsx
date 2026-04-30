'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { parseLocalDate } from '@/lib/driver-pay/date-helpers'
import type {
  DriverHourType,
  PayrollDriver,
  PayrollDriverHour,
} from '@/lib/driver-pay/types'

interface DriverHoursCardProps {
  driver: PayrollDriver
  onChange: (updatedHours: PayrollDriverHour[]) => void
}

interface NewHourDraft {
  date: string
  description: string
  hours: string
  type: DriverHourType
}

const emptyDraft: NewHourDraft = {
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  hours: '',
  type: 'misc_driving',
}

export function DriverHoursCard({ driver, onChange }: DriverHoursCardProps) {
  const [draft, setDraft] = useState<NewHourDraft | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleAdd() {
    setDraft({ ...emptyDraft })
  }

  function handleCancel() {
    setDraft(null)
  }

  async function handleSave() {
    if (!draft) return
    const hoursNum = parseFloat(draft.hours)
    if (!draft.date || !Number.isFinite(hoursNum) || hoursNum <= 0) {
      toast.error('Please enter a date and a positive number of hours')
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/drivers/hours/${driver.driverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: draft.date,
          description: draft.description || null,
          hours: hoursNum,
          type: draft.type,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      const data = await response.json()
      if (!data.success || !data.hour) throw new Error(data.error || 'Failed to add hour')

      const newHour: PayrollDriverHour = {
        id: Number(data.hour.id),
        date: String(data.hour.date),
        description: data.hour.description ?? null,
        hours: Number(data.hour.hours),
        type: data.hour.type === 'maintenance' ? 'maintenance' : 'misc_driving',
        isDriverSubmitted: !!data.hour.isDriverSubmitted,
        truckloadId: data.hour.truckloadId ?? null,
      }
      onChange([...driver.hours, newHour])
      setDraft(null)
      toast.success('Hours added')
    } catch (error) {
      console.error('Error adding driver hour:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add hour')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(hourId: number) {
    try {
      const response = await fetch(
        `/api/drivers/hours/${driver.driverId}?id=${hourId}`,
        { method: 'DELETE', credentials: 'include' }
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to delete')
      onChange(driver.hours.filter((h) => h.id !== hourId))
      toast.success('Hours deleted')
    } catch (error) {
      console.error('Error deleting hour:', error)
      toast.error('Failed to delete hour')
    }
  }

  const sortedHours = [...driver.hours].sort((a, b) => {
    const aTime = parseLocalDate(a.date).getTime()
    const bTime = parseLocalDate(b.date).getTime()
    return bTime - aTime
  })

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Driver Hours</h3>
        {!draft && (
          <Button size="sm" variant="outline" onClick={handleAdd} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Hours
          </Button>
        )}
      </div>

      {draft && (
        <div className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
          <Input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="w-40 h-8"
          />
          <Input
            type="text"
            placeholder="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="w-48 h-8"
          />
          <Input
            type="number"
            placeholder="Hours"
            value={draft.hours}
            onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
            className="w-24 h-8"
            step="0.25"
            min="0"
          />
          <select
            value={draft.type}
            onChange={(e) =>
              setDraft({ ...draft, type: e.target.value as DriverHourType })
            }
            className="w-32 h-8 border rounded px-2 text-sm"
          >
            <option value="misc_driving">Misc Driving</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="h-8">
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-8"
          >
            Cancel
          </Button>
        </div>
      )}

      {sortedHours.length === 0 ? (
        <div className="text-xs text-gray-400 italic py-1">No hours logged this period.</div>
      ) : (
        <div className="space-y-1">
          {sortedHours.map((hour) => (
            <div
              key={hour.id}
              className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-gray-600 w-20 flex-shrink-0">
                  {format(parseLocalDate(hour.date), 'MM/dd/yyyy')}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                    hour.type === 'maintenance'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {hour.type === 'maintenance' ? 'Maint' : 'Misc'}
                </span>
                <span className="text-gray-700 flex-1 truncate">
                  {hour.description || <span className="text-gray-400 italic">No description</span>}
                </span>
                <span className="font-semibold text-gray-900 w-16 text-right flex-shrink-0">
                  {hour.hours.toFixed(2)} hr
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(hour.id)}
                className="h-6 w-6 p-0 ml-1 text-gray-400 hover:text-red-600"
                aria-label="Delete hour entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
