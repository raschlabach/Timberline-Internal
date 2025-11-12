"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, UserPlus, Users, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface Driver {
  id: number
  full_name: string
  color: string
}

interface DriverFormData {
  fullName: string
  color: string
}

// Predefined color options for drivers
const DRIVER_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F43F5E', // Rose
]

export function ManageDriversDialog() {
  const queryClient = useQueryClient()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isEditing, setIsEditing] = useState<number | null>(null)
  const [formData, setFormData] = useState<DriverFormData>({
    fullName: '',
    color: DRIVER_COLORS[0]
  })

  // Fetch drivers on component mount
  useEffect(() => {
    fetchDrivers()
  }, [])

  async function fetchDrivers() {
    try {
      const response = await fetch('/api/drivers')
      const data = await response.json()
      if (data.success) {
        setDrivers(data.drivers)
      }
    } catch (error) {
      toast.error('Failed to fetch drivers')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.fullName.trim()) {
      toast.error('Please enter a driver name')
      return
    }
    
    try {
      const response = await fetch('/api/drivers', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          color: formData.color,
          id: isEditing
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(isEditing ? 'Driver updated successfully' : 'Driver created successfully')
        fetchDrivers()
        // Invalidate React Query cache so truckload manager refreshes
        queryClient.invalidateQueries({ queryKey: ['drivers'] })
        resetForm()
      } else {
        toast.error(data.error || 'Failed to save driver')
      }
    } catch (error) {
      toast.error('Failed to save driver')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this driver?')) return

    try {
      const response = await fetch(`/api/drivers/${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success('Driver deleted successfully')
        fetchDrivers()
        // Invalidate React Query cache so truckload manager refreshes
        queryClient.invalidateQueries({ queryKey: ['drivers'] })
      }
    } catch (error) {
      toast.error('Failed to delete driver')
    }
  }

    function handleEdit(driver: Driver) {
    setIsEditing(driver.id)
    setFormData({
      fullName: driver.full_name,
      color: driver.color
    })
  }

  function resetForm() {
    setIsEditing(null)
    setFormData({
      fullName: '',
      color: DRIVER_COLORS[0]
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Manage Drivers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isEditing ? 'Edit Driver' : 'Manage Drivers'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="fullName">Driver Name *</Label>
            <Input
              type="text"
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div className="grid w-full items-center gap-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Driver Color
            </Label>
            <div className="grid grid-cols-6 gap-2">
              {DRIVER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-105 ${
                    formData.color === color 
                      ? 'border-gray-900 ring-2 ring-gray-300' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-12 h-8 p-1 border rounded"
              />
              <span className="text-sm text-gray-600">Custom color</span>
            </div>
          </div>


          <div className="flex justify-end space-x-2">
            {isEditing && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
            <Button type="submit" className="gap-2">
              <UserPlus className="h-4 w-4" />
              {isEditing ? 'Update Driver' : 'Add Driver'}
            </Button>
          </div>
        </form>

        <div className="mt-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Existing Drivers ({drivers.length})
          </h3>
          {drivers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No drivers added yet</p>
              <p className="text-xs text-gray-400 mt-1">Add your first driver above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: driver.color }}
                    />
                    <div>
                      <p className="font-medium text-gray-900">{driver.full_name}</p>
                      <Badge variant="secondary" className="text-xs">
                        Driver
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(driver)}
                      className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(driver.id)}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 