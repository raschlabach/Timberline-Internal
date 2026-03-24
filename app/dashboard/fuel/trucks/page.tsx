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
import { Badge } from '@/components/ui/badge'
import { Truck, Plus, Pencil, Trash2, ArrowLeft, User } from 'lucide-react'

interface FuelTruck {
  id: number
  name: string
  driver_id: number | null
  is_active: boolean
  driver_name: string | null
  created_at: string
}

interface Driver {
  id: number
  full_name: string
}

export default function FuelTrucksPage() {
  const [trucks, setTrucks] = useState<FuelTruck[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTruck, setEditingTruck] = useState<FuelTruck | null>(null)
  const [truckName, setTruckName] = useState('')
  const [truckDriverId, setTruckDriverId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete confirmation
  const [deletingTruck, setDeletingTruck] = useState<FuelTruck | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [trucksRes, driversRes] = await Promise.all([
        fetch('/api/fuel/trucks'),
        fetch('/api/drivers'),
      ])
      const trucksData = await trucksRes.json()
      const driversData = await driversRes.json()
      setTrucks(trucksData.trucks || [])
      setDrivers(driversData.drivers || driversData || [])
    } catch (error) {
      console.error('Error fetching trucks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function openAddDialog() {
    setEditingTruck(null)
    setTruckName('')
    setTruckDriverId('')
    setIsDialogOpen(true)
  }

  function openEditDialog(truck: FuelTruck) {
    setEditingTruck(truck)
    setTruckName(truck.name)
    setTruckDriverId(truck.driver_id?.toString() || '')
    setIsDialogOpen(true)
  }

  async function handleSubmit() {
    if (!truckName.trim()) return
    setIsSubmitting(true)
    try {
      const isEditing = editingTruck !== null
      const url = isEditing ? `/api/fuel/trucks/${editingTruck.id}` : '/api/fuel/trucks'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: truckName.trim(),
          driver_id: truckDriverId && truckDriverId !== 'none' ? parseInt(truckDriverId) : null,
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        fetchData()
      }
    } catch (error) {
      console.error('Error saving truck:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deletingTruck) return
    try {
      const res = await fetch(`/api/fuel/trucks/${deletingTruck.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletingTruck(null)
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting truck:', error)
    }
  }

  const activeTrucks = trucks.filter(t => t.is_active)
  const inactiveTrucks = trucks.filter(t => !t.is_active)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/fuel">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <Truck className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fuel Trucks</h1>
            <p className="text-sm text-gray-500">Manage trucks and driver assignments</p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
          <Plus className="h-4 w-4" />
          Add Truck
        </Button>
      </div>

      {/* Active Trucks */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Active Trucks</CardTitle>
            <span className="text-sm text-gray-500">{activeTrucks.length} truck{activeTrucks.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : activeTrucks.length === 0 ? (
            <div className="p-8 text-center">
              <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No trucks yet</p>
              <p className="text-gray-400 text-sm mt-1">Add your first truck to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {activeTrucks.map((truck) => (
                <div key={truck.id} className="px-4 md:px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Truck className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{truck.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <User className="h-3 w-3 text-gray-400" />
                          {truck.driver_name ? (
                            <span className="text-sm text-gray-600">{truck.driver_name}</span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Unassigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(truck)} className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4 text-gray-400" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingTruck(truck)} className="h-8 w-8 p-0">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Trucks */}
      {inactiveTrucks.length > 0 && (
        <Card className="opacity-60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-gray-500">Inactive Trucks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {inactiveTrucks.map((truck) => (
                <div key={truck.id} className="px-4 md:px-6 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Truck className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">{truck.name}</span>
                      <Badge variant="outline" className="text-xs text-gray-400">Inactive</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Truck Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTruck ? 'Edit Truck' : 'Add Truck'}</DialogTitle>
            <DialogDescription>
              {editingTruck ? 'Update the truck details below.' : 'Create a new truck and optionally assign a driver.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Truck Name</Label>
              <Input
                placeholder="e.g. Pete 379, Truck 1"
                value={truckName}
                onChange={(e) => setTruckName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Assign Driver (optional)</Label>
              <Select value={truckDriverId} onValueChange={setTruckDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="No driver assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No driver assigned</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!truckName.trim() || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Saving...' : editingTruck ? 'Update' : 'Add Truck'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deletingTruck !== null} onOpenChange={(open) => { if (!open) setDeletingTruck(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Truck</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate &quot;{deletingTruck?.name}&quot;? It will no longer appear in truck selection lists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTruck(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
