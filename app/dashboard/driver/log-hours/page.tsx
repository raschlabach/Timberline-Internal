'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Clock,
  Trash2,
  Truck,
  Wrench,
  Loader2,
  Calendar,
  Play,
  Square,
  Timer,
  X,
  Pencil,
  Check,
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

interface ActiveTimer {
  id: number
  startedAt: string
  type: 'misc_driving' | 'maintenance'
  description: string | null
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
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null)
  const [truckloads, setTruckloads] = useState<ActiveTruckload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Timer display
  const [elapsedDisplay, setElapsedDisplay] = useState('0:00:00')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start form state
  const [isStartFormOpen, setIsStartFormOpen] = useState(false)
  const [startMode, setStartMode] = useState<'general' | 'load'>('general')
  const [startType, setStartType] = useState<'misc_driving' | 'maintenance'>('misc_driving')
  const [startDescription, setStartDescription] = useState('')
  const [startTruckloadId, setStartTruckloadId] = useState<string>('')
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  // Inline description editing
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingDescription, setEditingDescription] = useState('')
  const [isSavingDescription, setIsSavingDescription] = useState(false)

  function startEditing(id: number, currentDescription: string | null) {
    setEditingId(id)
    setEditingDescription(currentDescription || '')
  }

  async function saveDescription(id: number) {
    setIsSavingDescription(true)
    try {
      const response = await fetch('/api/driver/hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, description: editingDescription.trim() || null }),
      })
      if (response.ok) {
        setEditingId(null)
        await loadData()
      }
    } catch (error) {
      console.error('Error saving description:', error)
    } finally {
      setIsSavingDescription(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Update elapsed time display every second
  useEffect(() => {
    if (activeTimer) {
      const updateDisplay = () => {
        const start = new Date(activeTimer.startedAt).getTime()
        const now = Date.now()
        const elapsed = Math.max(0, now - start)
        const totalSeconds = Math.floor(elapsed / 1000)
        const hrs = Math.floor(totalSeconds / 3600)
        const mins = Math.floor((totalSeconds % 3600) / 60)
        const secs = totalSeconds % 60
        setElapsedDisplay(`${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      }
      updateDisplay()
      intervalRef.current = setInterval(updateDisplay, 1000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } else {
      setElapsedDisplay('0:00:00')
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [activeTimer])

  async function loadData() {
    try {
      setIsLoading(true)
      const response = await fetch('/api/driver/hours')
      if (!response.ok) throw new Error('Failed to load')
      const data = await response.json()
      setHours(data.hours || [])
      setActiveTimer(data.activeTimer || null)
      setTruckloads(data.truckloads || [])
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }

  function openStartForm(mode: 'general' | 'load') {
    setStartMode(mode)
    setStartType('misc_driving')
    setStartDescription('')
    setStartTruckloadId('')
    setIsStartFormOpen(true)
  }

  async function handleStart() {
    if (startMode === 'load' && !startTruckloadId) return
    setIsStarting(true)
    try {
      const body: any = {
        action: 'start',
        type: startType,
        description: startDescription.trim() || null,
      }
      if (startMode === 'load' && startTruckloadId) {
        body.truckloadId = parseInt(startTruckloadId)
      }
      const response = await fetch('/api/driver/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        setIsStartFormOpen(false)
        await loadData()
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Start timer failed:', response.status, errorData)
        alert(errorData.error || 'Failed to start timer')
      }
    } catch (error) {
      console.error('Error starting timer:', error)
      alert('Failed to start timer. Please try again.')
    } finally {
      setIsStarting(false)
    }
  }

  async function handleStop() {
    if (!activeTimer) return
    setIsStopping(true)
    try {
      const response = await fetch('/api/driver/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', timerId: activeTimer.id }),
      })
      if (response.ok) {
        await loadData()
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Stop timer failed:', response.status, errorData)
        alert(errorData.error || 'Failed to stop timer')
      }
    } catch (error) {
      console.error('Error stopping timer:', error)
      alert('Failed to stop timer. Please try again.')
    } finally {
      setIsStopping(false)
    }
  }

  async function handleCancelTimer() {
    if (!activeTimer) return
    if (!confirm('Cancel this timer? No hours will be recorded.')) return
    setIsCancelling(true)
    try {
      const response = await fetch(`/api/driver/hours?id=${activeTimer.id}`, { method: 'DELETE' })
      if (response.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Error cancelling timer:', error)
    } finally {
      setIsCancelling(false)
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

  function formatStartTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

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
      <div className="flex flex-col gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Clock className="h-5 w-5 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Log Hours</h1>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-4">
        <p className="text-red-500 text-center">Failed to load hours data</p>
        <Button onClick={() => window.location.reload()} className="w-full max-w-xs">Retry</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <Clock className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Log Hours</h1>
          <p className="text-xs text-gray-500">Start/stop timer to track your hours</p>
        </div>
      </div>

      {/* Active Timer Card */}
      {activeTimer && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-emerald-800">Timer Running</span>
          </div>

          {/* Big elapsed time */}
          <div className="text-center mb-3">
            <p className="text-5xl font-mono font-bold text-emerald-900 tracking-wider">
              {elapsedDisplay}
            </p>
            <p className="text-xs text-emerald-600 mt-1">
              Started at {formatStartTime(activeTimer.startedAt)}
            </p>
          </div>

          {/* Timer info */}
          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            <Badge
              variant="outline"
              className={`text-xs ${
                activeTimer.type === 'maintenance'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}
            >
              {activeTimer.type === 'maintenance' ? (
                <><Wrench className="h-3 w-3 mr-1" />Maintenance</>
              ) : (
                <><Truck className="h-3 w-3 mr-1" />Misc Driving</>
              )}
            </Badge>
            {activeTimer.truckloadId && (
              <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                <Truck className="h-3 w-3 mr-1" />
                {activeTimer.truckloadDescription || `Load #${activeTimer.truckloadId}`}
              </Badge>
            )}
          </div>

          {/* Editable description on active timer */}
          <div className="mb-4">
            {editingId === activeTimer.id ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="What are you doing?"
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  className="h-10 rounded-lg text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveDescription(activeTimer.id) }}
                />
                <Button
                  onClick={() => saveDescription(activeTimer.id)}
                  disabled={isSavingDescription}
                  size="sm"
                  className="h-10 px-3 rounded-lg bg-emerald-700"
                >
                  {isSavingDescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button onClick={() => setEditingId(null)} variant="ghost" size="sm" className="h-10 px-2">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => startEditing(activeTimer.id, activeTimer.description)}
                className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                <span>{activeTimer.description || 'Add description...'}</span>
              </button>
            )}
          </div>

          {/* Stop + Cancel buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleStop}
              disabled={isStopping}
              className="flex-1 h-14 text-base gap-2 bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {isStopping ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Square className="h-5 w-5" />
              )}
              Stop Timer
            </Button>
            <Button
              onClick={handleCancelTimer}
              disabled={isCancelling}
              variant="outline"
              className="h-14 px-4 rounded-xl border-red-200 text-red-600"
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Start Timer Buttons - only show when no timer running */}
      {!activeTimer && !isStartFormOpen && (
        <div className="flex gap-3">
          <button
            onClick={() => openStartForm('general')}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
          >
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <Play className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold">General Hours</span>
            <span className="text-[10px] text-emerald-200">Misc driving or maintenance</span>
          </button>
          <button
            onClick={() => openStartForm('load')}
            disabled={truckloads.length === 0}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-300 text-white rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
          >
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <Truck className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold">Hours for Load</span>
            <span className="text-[10px] text-indigo-200">
              {truckloads.length === 0 ? 'No active loads' : 'Track time on a load'}
            </span>
          </button>
        </div>
      )}

      {/* Start Timer Form */}
      {!activeTimer && isStartFormOpen && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {startMode === 'general' ? 'Start General Timer' : 'Start Load Timer'}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setIsStartFormOpen(false)} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Load selector */}
          {startMode === 'load' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Select Truckload</label>
              <select
                value={startTruckloadId}
                onChange={(e) => setStartTruckloadId(e.target.value)}
                className="w-full h-12 border rounded-xl px-3 text-sm bg-white"
              >
                <option value="">Choose a load...</option>
                {truckloads.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.description || `Truckload #${tl.id}`}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-amber-600 mt-1">
                This will set the load to hourly pay with your logged hours
              </p>
            </div>
          )}

          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStartType('misc_driving')}
                className={`flex-1 h-12 rounded-xl text-sm font-medium border-2 transition-colors flex items-center justify-center gap-2 ${
                  startType === 'misc_driving'
                    ? 'bg-green-50 border-green-400 text-green-700'
                    : 'bg-white border-gray-200 text-gray-500'
                }`}
              >
                <Truck className="h-4 w-4" />
                Misc Driving
              </button>
              <button
                onClick={() => setStartType('maintenance')}
                className={`flex-1 h-12 rounded-xl text-sm font-medium border-2 transition-colors flex items-center justify-center gap-2 ${
                  startType === 'maintenance'
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-500'
                }`}
              >
                <Wrench className="h-4 w-4" />
                Maintenance
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Description (optional)</label>
            <Input
              type="text"
              placeholder="What are you doing?"
              value={startDescription}
              onChange={(e) => setStartDescription(e.target.value)}
              className="h-12 rounded-xl text-base"
            />
          </div>

          {/* Start button */}
          <Button
            onClick={handleStart}
            disabled={isStarting || (startMode === 'load' && !startTruckloadId)}
            className="w-full h-14 text-base gap-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
          >
            {isStarting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            Start Timer
          </Button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Truck className="h-3.5 w-3.5 text-green-500" />
            <span className="text-[10px] font-semibold text-gray-500 uppercase">Misc Driving</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {totalMiscDriving.toFixed(2)}
            <span className="text-xs font-normal text-gray-400 ml-1">hrs</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Wrench className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[10px] font-semibold text-gray-500 uppercase">Maintenance</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {totalMaintenance.toFixed(2)}
            <span className="text-xs font-normal text-gray-400 ml-1">hrs</span>
          </p>
        </div>
      </div>

      {/* Load-specific hours */}
      {loadSpecificHours.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Load Hours</h3>
          <div className="space-y-2">
            {loadSpecificHours.map((hour) => (
              <div
                key={hour.id}
                className="bg-white rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 rounded-lg">
                        <Truck className="h-2.5 w-2.5 mr-0.5" />
                        {hour.truckloadDescription || `Load #${hour.truckloadId}`}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] rounded-lg ${
                          hour.type === 'maintenance'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                        }`}
                      >
                        {hour.type === 'maintenance' ? 'Maint.' : 'Driving'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>{formatDate(hour.date)}</span>
                    </div>
                    {/* Editable description */}
                    {editingId === hour.id ? (
                      <div className="flex gap-1.5 mt-1.5">
                        <Input
                          type="text"
                          placeholder="Add description..."
                          value={editingDescription}
                          onChange={(e) => setEditingDescription(e.target.value)}
                          className="h-8 rounded-lg text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveDescription(hour.id) }}
                        />
                        <Button onClick={() => saveDescription(hour.id)} disabled={isSavingDescription} size="sm" className="h-8 w-8 p-0 rounded-lg">
                          {isSavingDescription ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button onClick={() => setEditingId(null)} variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(hour.id, hour.description)}
                        className="flex items-center gap-1 mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        <span>{hour.description || 'Add description...'}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">
                        {parseFloat(String(hour.hours)).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-0.5">hrs</span>
                    </div>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General hours */}
      {generalHours.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">General Hours</h3>
          <div className="space-y-2">
            {generalHours.map((hour) => (
              <div
                key={hour.id}
                className="bg-white rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-lg mb-1.5 ${
                        hour.type === 'maintenance'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {hour.type === 'maintenance' ? 'Maintenance' : 'Misc Driving'}
                    </Badge>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>{formatDate(hour.date)}</span>
                    </div>
                    {/* Editable description */}
                    {editingId === hour.id ? (
                      <div className="flex gap-1.5 mt-1.5">
                        <Input
                          type="text"
                          placeholder="Add description..."
                          value={editingDescription}
                          onChange={(e) => setEditingDescription(e.target.value)}
                          className="h-8 rounded-lg text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveDescription(hour.id) }}
                        />
                        <Button onClick={() => saveDescription(hour.id)} disabled={isSavingDescription} size="sm" className="h-8 w-8 p-0 rounded-lg">
                          {isSavingDescription ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button onClick={() => setEditingId(null)} variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(hour.id, hour.description)}
                        className="flex items-center gap-1 mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        <span>{hour.description || 'Add description...'}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">
                        {parseFloat(String(hour.hours)).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-0.5">hrs</span>
                    </div>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {hours.length === 0 && !activeTimer && !isStartFormOpen && (
        <div className="flex flex-col items-center py-12 text-gray-400">
          <Timer className="h-10 w-10 mb-3" />
          <p className="text-sm font-medium">No hours logged yet</p>
          <p className="text-xs text-center mt-1">Tap a button above to start tracking your time</p>
        </div>
      )}
    </div>
  )
}
