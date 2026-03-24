'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Fuel, Droplets, Truck, Loader2, Check, Gauge, Pencil, Trash2 } from 'lucide-react'

interface FuelTruck {
  id: number
  name: string
  driver_id: number | null
}

interface RecentFillup {
  id: number
  fillup_date: string
  truck_id: number
  mileage: number
  gallons: string | number
  notes: string | null
  truck_name: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function toLocalDateValue(isoStr: string): string {
  const d = new Date(isoStr)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

function toLocalTimeValue(isoStr: string): string {
  const d = new Date(isoStr)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[1].slice(0, 5)
}

export default function DriverFuelPage() {
  const { data: session } = useSession()
  const [currentLevel, setCurrentLevel] = useState(0)
  const [trucks, setTrucks] = useState<FuelTruck[]>([])
  const [assignedTruck, setAssignedTruck] = useState<FuelTruck | null>(null)
  const [recentFillups, setRecentFillups] = useState<RecentFillup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Form state
  const [fillupDate, setFillupDate] = useState('')
  const [fillupTime, setFillupTime] = useState('')
  const [selectedTruckId, setSelectedTruckId] = useState('')
  const [mileage, setMileage] = useState('')
  const [gallons, setGallons] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Edit state
  const [editingFillup, setEditingFillup] = useState<RecentFillup | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editTruckId, setEditTruckId] = useState('')
  const [editMileage, setEditMileage] = useState('')
  const [editGallons, setEditGallons] = useState('')
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)

  // Delete state
  const [deletingFillup, setDeletingFillup] = useState<RecentFillup | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setIsLoading(true)
      const res = await fetch('/api/driver/fuel')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()

      setCurrentLevel(data.currentLevel || 0)
      setTrucks(data.trucks || [])
      setAssignedTruck(data.assignedTruck || null)
      setRecentFillups(data.recentFillups || [])

      resetForm(data.assignedTruck)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }

  function resetForm(assigned: FuelTruck | null) {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    setFillupDate(local.toISOString().split('T')[0])
    setFillupTime(local.toISOString().split('T')[1].slice(0, 5))
    setSelectedTruckId(assigned?.id?.toString() || '')
    setMileage('')
    setGallons('')
    setIsSuccess(false)
  }

  async function handleSubmit() {
    if (!fillupDate || !fillupTime || !selectedTruckId || !mileage || !gallons) return
    setIsSubmitting(true)
    try {
      const dateTime = new Date(`${fillupDate}T${fillupTime}`).toISOString()
      const res = await fetch('/api/driver/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillup_date: dateTime,
          truck_id: parseInt(selectedTruckId),
          mileage: parseInt(mileage),
          gallons: parseFloat(gallons),
        }),
      })

      if (res.ok) {
        setIsSuccess(true)
        setTimeout(() => {
          loadData()
        }, 1500)
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.error || 'Failed to submit. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting fillup:', error)
      alert('Failed to submit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function openEditDialog(f: RecentFillup) {
    setEditingFillup(f)
    setEditDate(toLocalDateValue(f.fillup_date))
    setEditTime(toLocalTimeValue(f.fillup_date))
    setEditTruckId(String(f.truck_id))
    setEditMileage(String(f.mileage))
    setEditGallons(String(parseFloat(String(f.gallons))))
  }

  async function handleEditSubmit() {
    if (!editingFillup || !editDate || !editTime || !editTruckId || !editMileage || !editGallons) return
    setIsEditSubmitting(true)
    try {
      const dateTime = new Date(`${editDate}T${editTime}`).toISOString()
      const res = await fetch(`/api/driver/fuel/${editingFillup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillup_date: dateTime,
          truck_id: parseInt(editTruckId),
          mileage: parseInt(editMileage),
          gallons: parseFloat(editGallons),
        }),
      })
      if (res.ok) {
        setEditingFillup(null)
        loadData()
      } else {
        alert('Failed to update. Please try again.')
      }
    } catch (error) {
      console.error('Error updating fillup:', error)
      alert('Failed to update. Please try again.')
    } finally {
      setIsEditSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deletingFillup) return
    try {
      const res = await fetch(`/api/driver/fuel/${deletingFillup.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletingFillup(null)
        loadData()
      } else {
        alert('Failed to delete. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting fillup:', error)
      alert('Failed to delete. Please try again.')
    }
  }

  const levelPercent = Math.min(100, (currentLevel / 1000) * 100)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Fuel className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Fuel</h1>
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-4">
        <p className="text-red-500 text-center">Failed to load fuel data</p>
        <Button onClick={() => window.location.reload()} className="w-full max-w-xs">Retry</Button>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Fuel className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Fuel</h1>
        </div>
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-green-800">Fill-up Recorded</h2>
          <p className="text-sm text-green-600 mt-1">Your fill-up has been saved successfully</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Fuel className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fuel</h1>
          <p className="text-xs text-gray-500">Fill up your truck from the tank</p>
        </div>
      </div>

      {/* Tank Level */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-2 border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-semibold text-blue-700">Tank Level</span>
          </div>
          <span className="text-xs text-blue-600">{levelPercent.toFixed(0)}% full</span>
        </div>
        <div className="text-3xl font-bold text-blue-900 mb-2">
          {currentLevel.toFixed(1)} <span className="text-base font-normal text-blue-600">/ 1,000 gal</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              levelPercent > 25 ? 'bg-blue-500' : levelPercent > 10 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${levelPercent}%` }}
          />
        </div>
      </div>

      {/* Fill-up Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-sm text-gray-900">Record Fill-up</h3>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Date</label>
            <Input
              type="date"
              value={fillupDate}
              onChange={(e) => setFillupDate(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Time</label>
            <Input
              type="time"
              value={fillupTime}
              onChange={(e) => setFillupTime(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
        </div>

        {/* Truck Selector */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">
            Truck
            {assignedTruck && (
              <span className="text-gray-400 font-normal"> (yours: {assignedTruck.name})</span>
            )}
          </label>
          <select
            value={selectedTruckId}
            onChange={(e) => setSelectedTruckId(e.target.value)}
            className="w-full h-12 border rounded-xl px-3 text-sm bg-white"
          >
            <option value="">Select truck...</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.id === assignedTruck?.id ? ' (Your Truck)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Mileage */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5 flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            Truck Mileage
          </label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Current mileage"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            className="h-12 rounded-xl text-base"
          />
        </div>

        {/* Gallons */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5 flex items-center gap-1">
            <Fuel className="h-3 w-3" />
            Gallons Pumped
          </label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={gallons}
            onChange={(e) => setGallons(e.target.value)}
            className="h-12 rounded-xl text-base"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!fillupDate || !fillupTime || !selectedTruckId || !mileage || !gallons || isSubmitting}
          className="w-full h-14 text-base gap-2 bg-blue-600 hover:bg-blue-700 rounded-xl"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Truck className="h-5 w-5" />
          )}
          Submit Fill-up
        </Button>
      </div>

      {/* Recent Fill-ups */}
      {recentFillups.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-sm text-gray-900">Your Recent Fill-ups</h3>
          </div>
          <div className="divide-y">
            {recentFillups.map((f) => (
              <div key={f.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{formatDate(f.fillup_date)}</span>
                      <span className="text-xs text-gray-400">{formatTime(f.fillup_date)}</span>
                      <span className="text-xs font-semibold text-blue-700 ml-auto mr-1">{parseFloat(String(f.gallons)).toFixed(1)} gal</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{f.truck_name}</span>
                      <span className="text-gray-300">|</span>
                      <span>{Number(f.mileage).toLocaleString()} mi</span>
                    </div>
                  </div>
                  <div className="flex items-center shrink-0 -mr-1">
                    <button
                      onClick={() => openEditDialog(f)}
                      className="p-2.5 rounded-lg active:bg-gray-100 touch-manipulation"
                    >
                      <Pencil className="h-4 w-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => setDeletingFillup(f)}
                      className="p-2.5 rounded-lg active:bg-red-50 touch-manipulation"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom safe area for mobile nav */}
      <div className="h-4" />

      {/* Edit Fill-up Dialog */}
      <Dialog open={editingFillup !== null} onOpenChange={(open) => { if (!open) setEditingFillup(null) }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Fill-up</DialogTitle>
            <DialogDescription>Update your fill-up details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Time</label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Truck</label>
              <select
                value={editTruckId}
                onChange={(e) => setEditTruckId(e.target.value)}
                className="w-full h-12 border rounded-xl px-3 text-sm bg-white"
              >
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Mileage</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={editMileage}
                  onChange={(e) => setEditMileage(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Gallons</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={editGallons}
                  onChange={(e) => setEditGallons(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingFillup(null)} className="h-12 sm:h-10 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!editDate || !editTime || !editTruckId || !editMileage || !editGallons || isEditSubmitting}
              className="h-12 sm:h-10 rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              {isEditSubmitting ? 'Saving...' : 'Update Fill-up'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deletingFillup !== null} onOpenChange={(open) => { if (!open) setDeletingFillup(null) }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Fill-up</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this fill-up of {deletingFillup ? parseFloat(String(deletingFillup.gallons)).toFixed(1) : '0'} gallons from {deletingFillup ? formatDate(deletingFillup.fillup_date) : ''}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingFillup(null)} className="h-12 sm:h-10 rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="h-12 sm:h-10 rounded-xl">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
