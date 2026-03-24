'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Fuel, Droplets, Truck, Loader2, Check, Gauge } from 'lucide-react'

interface FuelTruck {
  id: number
  name: string
  driver_id: number | null
}

export default function DriverFuelPage() {
  const { data: session } = useSession()
  const [currentLevel, setCurrentLevel] = useState(0)
  const [trucks, setTrucks] = useState<FuelTruck[]>([])
  const [assignedTruck, setAssignedTruck] = useState<FuelTruck | null>(null)
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
    </div>
  )
}
