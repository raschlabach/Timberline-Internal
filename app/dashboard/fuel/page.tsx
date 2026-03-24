"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Fuel, TrendingUp, TrendingDown, Plus, Truck, Droplets, History, ArrowRight } from 'lucide-react'

interface FillupItem {
  id: number
  fillup_date: string
  truck_id: number
  driver_id: number | null
  mileage: number
  gallons: string | number
  notes: string | null
  truck_name: string
  driver_name: string | null
}

interface RefillItem {
  id: number
  refill_date: string
  gallons: string | number
  notes: string | null
  created_by_name: string | null
}

interface FuelTruck {
  id: number
  name: string
  driver_id: number | null
  is_active: boolean
  driver_name: string | null
}

interface Driver {
  id: number
  full_name: string
}

type ActivityItem = {
  id: string
  date: string
  type: 'refill' | 'fillup'
  gallons: number
  description: string
  notes: string | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`
}

export default function FuelDashboard() {
  const [currentLevel, setCurrentLevel] = useState(0)
  const [totalRefilled, setTotalRefilled] = useState(0)
  const [totalUsed, setTotalUsed] = useState(0)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [trucks, setTrucks] = useState<FuelTruck[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Refill dialog
  const [isRefillOpen, setIsRefillOpen] = useState(false)
  const [refillDate, setRefillDate] = useState('')
  const [refillGallons, setRefillGallons] = useState('')
  const [refillNotes, setRefillNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fillup dialog
  const [isFillupOpen, setIsFillupOpen] = useState(false)
  const [fillupDate, setFillupDate] = useState('')
  const [fillupTruckId, setFillupTruckId] = useState('')
  const [fillupDriverId, setFillupDriverId] = useState('')
  const [fillupMileage, setFillupMileage] = useState('')
  const [fillupGallons, setFillupGallons] = useState('')
  const [fillupNotes, setFillupNotes] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [tankRes, fillupsRes, refillsRes, trucksRes, driversRes] = await Promise.all([
        fetch('/api/fuel/tank'),
        fetch('/api/fuel/fillups?limit=10'),
        fetch('/api/fuel/refills'),
        fetch('/api/fuel/trucks'),
        fetch('/api/drivers'),
      ])

      const tankData = await tankRes.json()
      const fillupsData = await fillupsRes.json()
      const refillsData = await refillsRes.json()
      const trucksData = await trucksRes.json()
      const driversData = await driversRes.json()

      setCurrentLevel(tankData.currentLevel || 0)
      setTotalRefilled(tankData.totalRefilled || 0)
      setTotalUsed(tankData.totalUsed || 0)
      setTrucks((trucksData.trucks || []).filter((t: FuelTruck) => t.is_active !== false))
      setDrivers(driversData.drivers || driversData || [])

      const fillupItems: ActivityItem[] = (fillupsData.fillups || []).map((f: FillupItem) => ({
        id: `fillup-${f.id}`,
        date: f.fillup_date,
        type: 'fillup' as const,
        gallons: parseFloat(String(f.gallons)) || 0,
        description: `${f.driver_name || 'Unknown'} → ${f.truck_name}`,
        notes: f.notes,
      }))

      const refillItems: ActivityItem[] = (refillsData.refills || []).slice(0, 10).map((r: RefillItem) => ({
        id: `refill-${r.id}`,
        date: r.refill_date,
        type: 'refill' as const,
        gallons: parseFloat(String(r.gallons)) || 0,
        description: `Tank refill${r.created_by_name ? ` by ${r.created_by_name}` : ''}`,
        notes: r.notes,
      }))

      const merged = [...fillupItems, ...refillItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)

      setActivity(merged)
    } catch (error) {
      console.error('Error fetching fuel data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function openRefillDialog() {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    setRefillDate(local.toISOString().slice(0, 16))
    setRefillGallons('')
    setRefillNotes('')
    setIsRefillOpen(true)
  }

  function openFillupDialog() {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    setFillupDate(local.toISOString().slice(0, 16))
    setFillupTruckId('')
    setFillupDriverId('')
    setFillupMileage('')
    setFillupGallons('')
    setFillupNotes('')
    setIsFillupOpen(true)
  }

  async function handleRefillSubmit() {
    if (!refillDate || !refillGallons) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/fuel/refills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refill_date: new Date(refillDate).toISOString(),
          gallons: parseFloat(refillGallons),
          notes: refillNotes.trim() || null,
        }),
      })
      if (res.ok) {
        setIsRefillOpen(false)
        fetchData()
      }
    } catch (error) {
      console.error('Error adding refill:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleFillupSubmit() {
    if (!fillupDate || !fillupTruckId || !fillupMileage || !fillupGallons) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/fuel/fillups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillup_date: new Date(fillupDate).toISOString(),
          truck_id: parseInt(fillupTruckId),
          driver_id: fillupDriverId ? parseInt(fillupDriverId) : null,
          mileage: parseInt(fillupMileage),
          gallons: parseFloat(fillupGallons),
          notes: fillupNotes.trim() || null,
        }),
      })
      if (res.ok) {
        setIsFillupOpen(false)
        fetchData()
      }
    } catch (error) {
      console.error('Error adding fillup:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const levelPercent = totalRefilled > 0 ? Math.min(100, (currentLevel / 1000) * 100) : 0

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Fuel className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Fuel Tracker</h1>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-gray-200 rounded-xl" />
            <div className="h-24 bg-gray-200 rounded-xl" />
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Fuel className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fuel Tracker</h1>
            <p className="text-sm text-gray-500">1,000 gallon tank at warehouse</p>
          </div>
        </div>
      </div>

      {/* Tank Level Card */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Current Tank Level</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-bold text-blue-900">
                  {currentLevel.toFixed(1)}
                </span>
                <span className="text-lg text-blue-600">/ 1,000 gal</span>
              </div>
            </div>
            <Droplets className="h-12 w-12 text-blue-300" />
          </div>
          {/* Level bar */}
          <div className="w-full bg-blue-100 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                levelPercent > 25 ? 'bg-blue-500' : levelPercent > 10 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${levelPercent}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-2 text-right">{levelPercent.toFixed(0)}% full</p>
        </CardContent>
      </Card>

      {/* Stats + Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Total Filled</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-xl font-bold text-green-900">{totalRefilled.toFixed(1)}</div>
            <p className="text-xs text-green-600">gallons delivered</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Total Used</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-xl font-bold text-red-900">{totalUsed.toFixed(1)}</div>
            <p className="text-xs text-red-600">gallons pumped</p>
          </CardContent>
        </Card>
        <Card
          className="border-green-300 bg-green-50 cursor-pointer hover:shadow-md transition-shadow"
          onClick={openRefillDialog}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Plus className="h-6 w-6 text-green-600 mb-1" />
            <span className="text-sm font-semibold text-green-700">Add Tank Refill</span>
            <span className="text-[10px] text-green-600">Gas company delivery</span>
          </CardContent>
        </Card>
        <Card
          className="border-blue-300 bg-blue-50 cursor-pointer hover:shadow-md transition-shadow"
          onClick={openFillupDialog}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Truck className="h-6 w-6 text-blue-600 mb-1" />
            <span className="text-sm font-semibold text-blue-700">Add Truck Fill-up</span>
            <span className="text-[10px] text-blue-600">Manual driver entry</span>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-gray-400" />
              Recent Activity
            </CardTitle>
            <Link href="/dashboard/fuel/history">
              <Button variant="outline" size="sm" className="gap-1.5">
                View Full History
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <div className="p-8 text-center">
              <Fuel className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No fuel activity yet</p>
              <p className="text-gray-400 text-sm mt-1">Add a tank refill or truck fill-up to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {activity.map((item) => {
                const isRefill = item.type === 'refill'
                return (
                  <div key={item.id} className="px-4 md:px-6 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isRefill ? 'bg-green-500' : 'bg-blue-500'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold uppercase tracking-wide ${isRefill ? 'text-green-700' : 'text-blue-700'}`}>
                              {isRefill ? 'Tank Refill' : 'Truck Fill-up'}
                            </span>
                            <span className="text-xs text-gray-400">{formatDateTime(item.date)}</span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">{item.description}</p>
                          {item.notes && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{item.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-bold ${isRefill ? 'text-green-700' : 'text-blue-700'}`}>
                          {isRefill ? '+' : '-'}{item.gallons.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-400">gal</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Tank Refill Dialog */}
      <Dialog open={isRefillOpen} onOpenChange={setIsRefillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tank Refill</DialogTitle>
            <DialogDescription>Record a gas company delivery to the 1,000 gallon tank.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={refillDate}
                onChange={(e) => setRefillDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Gallons Delivered</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={refillGallons}
                onChange={(e) => setRefillGallons(e.target.value)}
                className="text-lg"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Receipt #, vendor name, etc."
                value={refillNotes}
                onChange={(e) => setRefillNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefillOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRefillSubmit}
              disabled={!refillDate || !refillGallons || isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Saving...' : 'Add Refill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Truck Fill-up Dialog */}
      <Dialog open={isFillupOpen} onOpenChange={setIsFillupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Truck Fill-up</DialogTitle>
            <DialogDescription>Manually record a driver filling their truck from the tank.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={fillupDate}
                onChange={(e) => setFillupDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Truck</Label>
                <Select value={fillupTruckId} onValueChange={setFillupTruckId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select truck" />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Driver</Label>
                <Select value={fillupDriverId} onValueChange={setFillupDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mileage</Label>
                <Input
                  type="number"
                  placeholder="Truck mileage"
                  value={fillupMileage}
                  onChange={(e) => setFillupMileage(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gallons</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={fillupGallons}
                  onChange={(e) => setFillupGallons(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any notes..."
                value={fillupNotes}
                onChange={(e) => setFillupNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFillupOpen(false)}>Cancel</Button>
            <Button
              onClick={handleFillupSubmit}
              disabled={!fillupDate || !fillupTruckId || !fillupMileage || !fillupGallons || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Saving...' : 'Add Fill-up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
