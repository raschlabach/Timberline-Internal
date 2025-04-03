"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Driver {
  id: number
  fullName: string
  username: string | null
  color: string
}

interface DriverFormData {
  fullName: string
  username: string
  password: string
  color: string
}

export function ManageDriversDialog() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isEditing, setIsEditing] = useState<number | null>(null)
  const [formData, setFormData] = useState<DriverFormData>({
    fullName: '',
    username: '',
    password: '',
    color: '#000000'
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
    
    try {
      const response = await fetch('/api/drivers', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id: isEditing
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(isEditing ? 'Driver updated successfully' : 'Driver created successfully')
        fetchDrivers()
        resetForm()
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
      }
    } catch (error) {
      toast.error('Failed to delete driver')
    }
  }

  function handleEdit(driver: Driver) {
    setIsEditing(driver.id)
    setFormData({
      fullName: driver.fullName,
      username: driver.username || '',
      password: '',
      color: driver.color
    })
  }

  function resetForm() {
    setIsEditing(null)
    setFormData({
      fullName: '',
      username: '',
      password: '',
      color: '#000000'
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Manage Drivers</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
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
            <Label htmlFor="color">Driver Color *</Label>
            <Input
              type="color"
              id="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              required
            />
          </div>

          <div className="grid w-full items-center gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              type="text"
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div className="grid w-full items-center gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-2">
            {isEditing && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
            <Button type="submit">
              {isEditing ? 'Update Driver' : 'Add Driver'}
            </Button>
          </div>
        </form>

        <div className="mt-6">
          <h3 className="font-medium mb-4">Existing Drivers</h3>
          <div className="space-y-2">
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: driver.color }}
                  />
                  <span>{driver.fullName}</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(driver)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(driver.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 