'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Clock,
  Plus,
  Trash2,
  Truck,
  Wrench,
  Send,
  Loader2,
  Calendar,
} from 'lucide-react'

interface DriverHourEntry {
  id: number
  date: string
  description: string | null
  hours: number
  type: 'misc_driving' | 'maintenance'
  truckloadId: number | null
  truckloadDescription: string | null
}

interface ActiveTruckload {
  id: number
  description: string | null
  startDate: string
  endDate: string
}

export default function DriverLogHoursPage() {
  const { data: session } = useSession()
  const [hours, setHours] = useState<DriverHourEntry[]>([])
  const [truckloads, setTruckloads] = useState<ActiveTruckload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'general' | 'load'>('general')
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formDescription, setFormDescription] = useState('')
  const [formHours, setFormHours] = useState('')
  const [formType, setFormType] = useState<'misc_driving' | 'maintenance'>('misc_driving')
  const [formTruckloadId, setFormTruckloadId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setIsLoading(true)
      const response = await fetch('/api/driver/hours')
      if (!response.ok) throw new Error('Failed to load')
      const data = await response.json()
      setHours(data.hours || [])
      setTruckloads(data.truckloads || [])
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }

  function openForm(mode: 'general' | 'load') {
    setFormMode(mode)
    setFormDate(format(new Date(), 'yyyy-MM-dd'))
    setFormDescription('')
    setFormHours('')
    setFormType('misc_driving')
    setFormTruckloadId('')
    setIsFormOpen(true)
  }

  function closeForm() {
    setIsFormOpen(false)
  }

  async function handleSubmit() {
    const parsedHours = parseFloat(formHours)
    if (!formDate || isNaN(parsedHours) || parsedHours <= 0) return
    if (formMode === 'load' && !formTruckloadId) return

    setIsSubmitting(true)
    try {
      const body: any = {
        date: formDate,
        description: formDescription.trim() || null,
        hours: parsedHours,
        type: formType,
      }
      if (formMode === 'load' && formTruckloadId) {
        body.truckloadId = parseInt(formTruckloadId)
      }

      const response = await fetch('/api/driver/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        closeForm()
        loadData()
      }
    } catch (error) {
      console.error('Error submitting hours:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(hourId: number) {
    if (!confirm('Delete this hour entry?')) return
    setIsDeleting(hourId)
    try {
      const response = await fetch(`/api/driver/hours?id=${hourId}`, { method: 'DELETE' })
      if (response.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Error deleting hour:', error)
    } finally {
      setIsDeleting(null)
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Compute totals
  const totalMiscDriving = hours
    .filter(h => h.type === 'misc_driving')
    .reduce((sum, h) => sum + (parseFloat(String(h.hours)) || 0), 0)
  const totalMaintenance = hours
    .filter(h => h.type === 'maintenance')
    .reduce((sum, h) => sum + (parseFloat(String(h.hours)) || 0), 0)
  const loadSpecificHours = hours.filter(h => h.truckloadId)
  const generalHours = hours.filter(h => !h.truckloadId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Clock className="h-5 w-5 text-emerald-600" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Log Hours</h1>
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-red-500">Failed to load hours data</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <Clock className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Log Hours</h1>
          <p className="text-xs text-gray-500">Track your driving and maintenance hours</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-green-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Misc Driving</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalMiscDriving.toFixed(2)}<span className="text-sm font-normal text-gray-500 ml-1">hrs</span></p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Maintenance</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalMaintenance.toFixed(2)}<span className="text-sm font-normal text-gray-500 ml-1">hrs</span></p>
        </div>
      </div>

      {/* Action buttons */}
      {!isFormOpen && (
        <div className="flex gap-2">
          <Button
            onClick={() => openForm('general')}
            className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            General Hours
          </Button>
          <Button
            onClick={() => openForm('load')}
            variant="outline"
            className="flex-1 gap-2"
            disabled={truckloads.length === 0}
          >
            <Truck className="h-4 w-4" />
            Hours for Load
          </Button>
        </div>
      )}

      {/* Add hours form */}
      {isFormOpen && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {formMode === 'general' ? 'Log General Hours' : 'Log Hours for a Load'}
            </h3>
            <Button variant="ghost" size="sm" onClick={closeForm} className="text-xs">
              Cancel
            </Button>
          </div>

          {/* Load selector - only for load mode */}
          {formMode === 'load' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Select Truckload</label>
              <select
                value={formTruckloadId}
                onChange={(e) => setFormTruckloadId(e.target.value)}
                className="w-full h-10 border rounded-md px-3 text-sm bg-white"
              >
                <option value="">Choose a load...</option>
                {truckloads.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.description || `Truckload #${tl.id}`} — {formatDate(tl.startDate)}
                  </option>
                ))}
              </select>
              {formMode === 'load' && (
                <p className="text-[10px] text-amber-600 mt-1">
                  This will set the load to hourly pay with your logged hours
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Date</label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Hours</label>
              <Input
                type="number"
                placeholder="0.00"
                value={formHours}
                onChange={(e) => setFormHours(e.target.value)}
                step="0.25"
                min="0"
                className="h-10"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormType('misc_driving')}
                className={`flex-1 h-10 rounded-md text-sm font-medium border transition-colors ${
                  formType === 'misc_driving'
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                Misc Driving
              </button>
              <button
                onClick={() => setFormType('maintenance')}
                className={`flex-1 h-10 rounded-md text-sm font-medium border transition-colors ${
                  formType === 'maintenance'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                Maintenance
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Description (optional)</label>
            <Input
              type="text"
              placeholder="What were you doing?"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="h-10"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formDate || !formHours || parseFloat(formHours) <= 0 || (formMode === 'load' && !formTruckloadId)}
            className="w-full gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit Hours
          </Button>
        </div>
      )}

      {/* Load-specific hours */}
      {loadSpecificHours.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Load Hours</h3>
          <div className="space-y-2">
            {loadSpecificHours.map((hour) => (
              <div
                key={hour.id}
                className="bg-white rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                      <Truck className="h-2.5 w-2.5 mr-0.5" />
                      {hour.truckloadDescription || `Load #${hour.truckloadId}`}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        hour.type === 'maintenance'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {hour.type === 'maintenance' ? 'Maintenance' : 'Misc Driving'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(hour.date)}
                    </span>
                    {hour.description && (
                      <span className="text-gray-600">{hour.description}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-lg font-bold text-gray-900">
                    {parseFloat(String(hour.hours)).toFixed(2)}
                    <span className="text-xs font-normal text-gray-500 ml-0.5">hrs</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleDelete(hour.id)}
                    disabled={isDeleting === hour.id}
                  >
                    {isDeleting === hour.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General hours */}
      {generalHours.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">General Hours</h3>
          <div className="space-y-2">
            {generalHours.map((hour) => (
              <div
                key={hour.id}
                className="bg-white rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        hour.type === 'maintenance'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {hour.type === 'maintenance' ? 'Maintenance' : 'Misc Driving'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(hour.date)}
                    </span>
                    {hour.description && (
                      <span className="text-gray-600">{hour.description}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-lg font-bold text-gray-900">
                    {parseFloat(String(hour.hours)).toFixed(2)}
                    <span className="text-xs font-normal text-gray-500 ml-0.5">hrs</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleDelete(hour.id)}
                    disabled={isDeleting === hour.id}
                  >
                    {isDeleting === hour.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {hours.length === 0 && !isFormOpen && (
        <div className="flex flex-col items-center py-12 text-gray-400">
          <Clock className="h-10 w-10 mb-2" />
          <p className="text-sm font-medium">No hours logged</p>
          <p className="text-xs">Tap a button above to log your hours</p>
        </div>
      )}
    </div>
  )
}
