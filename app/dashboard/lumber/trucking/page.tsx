'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails, LumberDriver, LumberSupplierWithLocations } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Truck, Plus, Save, Trash2, Edit2, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface TruckingNote {
  id: number
  note_text: string
  created_at: string
}

interface SupplierLocation {
  id: number
  supplier_id: number
  supplier_name: string
  location_name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone_number_1: string | null
  phone_number_2: string | null
  notes: string | null
  is_primary: boolean
}

export default function TruckingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [drivers, setDrivers] = useState<LumberDriver[]>([])
  const [suppliers, setSuppliers] = useState<LumberSupplierWithLocations[]>([])
  const [locations, setLocations] = useState<SupplierLocation[]>([])
  const [notes, setNotes] = useState<TruckingNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [selectedLoad, setSelectedLoad] = useState<LumberLoadWithDetails | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [assignedPickupDate, setAssignedPickupDate] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [newNoteText, setNewNoteText] = useState('')
  
  // Vendor Location Dialog State
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<SupplierLocation | null>(null)
  const [locationForm, setLocationForm] = useState({
    supplier_id: '',
    location_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone_number_1: '',
    phone_number_2: '',
    notes: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/trucking')
    }
  }, [status, router])

  async function fetchData() {
    try {
      const [loadsRes, driversRes, notesRes, locationsRes, suppliersRes] = await Promise.all([
        fetch('/api/lumber/loads/for-trucking'),
        fetch('/api/lumber/drivers'),
        fetch('/api/lumber/trucking/notes'),
        fetch('/api/lumber/suppliers/locations'),
        fetch('/api/lumber/suppliers')
      ])

      if (loadsRes.ok) setLoads(await loadsRes.json())
      if (driversRes.ok) setDrivers(await driversRes.json())
      if (notesRes.ok) setNotes(await notesRes.json())
      if (locationsRes.ok) setLocations(await locationsRes.json())
      if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
    } catch (error) {
      console.error('Error fetching trucking data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status])

  function handleAssignDriver(load: LumberLoadWithDetails) {
    setSelectedLoad(load)
    setSelectedDriverId(load.driver_id?.toString() || '')
    setAssignedPickupDate(load.assigned_pickup_date || '')
    setIsDialogOpen(true)
  }

  async function handleSaveAssignment() {
    if (!selectedLoad) return

    try {
      const response = await fetch(`/api/lumber/loads/${selectedLoad.id}/assign-driver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: selectedDriverId ? parseInt(selectedDriverId) : null,
          assigned_pickup_date: assignedPickupDate || null
        })
      })

      if (response.ok) {
        toast.success('Driver assigned')
        setIsDialogOpen(false)
        fetchData()
      } else {
        throw new Error('Failed to assign driver')
      }
    } catch (error) {
      console.error('Error assigning driver:', error)
      toast.success('Error')
    }
  }

  async function handleAddNote() {
    if (!newNoteText.trim()) return

    try {
      const response = await fetch('/api/lumber/trucking/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: newNoteText })
      })

      if (response.ok) {
        setNewNoteText('')
        const notesRes = await fetch('/api/lumber/trucking/notes')
        if (notesRes.ok) setNotes(await notesRes.json())
        
        toast.success('Note added')
      }
    } catch (error) {
      console.error('Error adding note:', error)
      toast.success('Error')
    }
  }

  async function handleDeleteNote(noteId: number) {
    try {
      const response = await fetch(`/api/lumber/trucking/notes/${noteId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setNotes(notes.filter(n => n.id !== noteId))
        toast.success('Note deleted')
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  // Location Management Functions
  function handleAddLocation() {
    setEditingLocation(null)
    setLocationForm({
      supplier_id: '',
      location_name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      phone_number_1: '',
      phone_number_2: '',
      notes: ''
    })
    setIsLocationDialogOpen(true)
  }

  function handleEditLocation(location: SupplierLocation) {
    setEditingLocation(location)
    setLocationForm({
      supplier_id: location.supplier_id.toString(),
      location_name: location.location_name || '',
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      zip_code: location.zip_code || '',
      phone_number_1: location.phone_number_1 || '',
      phone_number_2: location.phone_number_2 || '',
      notes: location.notes || ''
    })
    setIsLocationDialogOpen(true)
  }

  async function handleSaveLocation() {
    if (!locationForm.location_name || !locationForm.supplier_id) {
      toast.error('Supplier and location name are required')
      return
    }

    try {
      const url = editingLocation 
        ? `/api/lumber/suppliers/locations/${editingLocation.id}`
        : '/api/lumber/suppliers/locations'
      
      const response = await fetch(url, {
        method: editingLocation ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: parseInt(locationForm.supplier_id),
          location_name: locationForm.location_name,
          address: locationForm.address || null,
          city: locationForm.city || null,
          state: locationForm.state || null,
          zip_code: locationForm.zip_code || null,
          phone_number_1: locationForm.phone_number_1 || null,
          phone_number_2: locationForm.phone_number_2 || null,
          notes: locationForm.notes || null
        })
      })

      if (response.ok) {
        toast.success(editingLocation ? 'Location updated' : 'Location added')
        setIsLocationDialogOpen(false)
        // Refresh locations
        const locationsRes = await fetch('/api/lumber/suppliers/locations')
        if (locationsRes.ok) setLocations(await locationsRes.json())
      } else {
        toast.error('Failed to save location')
      }
    } catch (error) {
      console.error('Error saving location:', error)
      toast.error('Error saving location')
    }
  }

  async function handleDeleteLocation(locationId: number) {
    if (!confirm('Are you sure you want to delete this location?')) return

    try {
      const response = await fetch(`/api/lumber/suppliers/locations/${locationId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setLocations(locations.filter(l => l.id !== locationId))
        toast.success('Location deleted')
      } else {
        toast.error('Failed to delete location')
      }
    } catch (error) {
      console.error('Error deleting location:', error)
      toast.error('Error deleting location')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Trucking Dispatch</h1>
        <p className="text-gray-600 mt-1">
          Assign drivers and schedule pickups for loads
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Loads for Pickup */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Loads Needing Pickup ({loads.length})</h2>
            {/* Color Legend */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-white border border-gray-300"></div>
                <span className="text-gray-600">Waiting</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
                <span className="text-gray-600">Ready (has Pickup #)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
                <span className="text-gray-600">Assigned (Driver + Date)</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Load ID
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Supplier
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Species
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Grade
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Footage
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      ETA
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Pickup #
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Plant
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Driver
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Pickup Date
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-medium uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loads.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                        No loads needing pickup
                      </td>
                    </tr>
                  ) : (
                    loads.map((load) => {
                      // Determine row color based on status
                      const isAssigned = load.driver_id && load.assigned_pickup_date
                      const isReady = load.pickup_number && !isAssigned
                      const rowColor = isAssigned 
                        ? 'bg-green-50 hover:bg-green-100' 
                        : isReady 
                          ? 'bg-yellow-50 hover:bg-yellow-100' 
                          : 'bg-white hover:bg-gray-50'
                      
                      return (
                        <tr key={load.id} className={rowColor}>
                          <td className="px-2 py-2 text-xs font-medium text-gray-900">
                            {load.load_id}
                          </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          <div className="font-medium">{load.supplier_name}</div>
                          {load.location_name && (
                            <div className="text-[10px] text-gray-500">{load.location_name}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          {load.items?.map((item: any) => item.species).filter(Boolean).join(', ') || '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          {load.items?.map((item: any) => item.grade).filter(Boolean).join(', ') || '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          {load.items?.reduce((sum: number, item: any) => sum + (item.estimated_footage || 0), 0).toLocaleString() || '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          {load.estimated_delivery_date 
                            ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          {load.pickup_number || '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          {load.plant || '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          {load.driver_name || '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-900">
                          {load.assigned_pickup_date 
                            ? new Date(load.assigned_pickup_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleAssignDriver(load)}
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            Assign
                          </Button>
                        </td>
                      </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Notes & Vendor Info */}
        <div className="space-y-6">
          {/* Dispatcher Notes */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Dispatcher Notes</h2>
            <div className="bg-white rounded-lg shadow p-3 space-y-3">
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <Button onClick={handleAddNote} size="sm" className="w-full h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Note
                </Button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className="border rounded p-2 relative group bg-gray-50">
                    <p className="text-xs text-gray-900 pr-6">{note.note_text}</p>
                    <div className="text-[10px] text-gray-500 mt-1">
                      {new Date(note.created_at).toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vendor Info / Locations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Vendor Locations</h2>
              <Button onClick={handleAddLocation} size="sm" className="h-7 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            <div className="bg-white rounded-lg shadow">
              <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Vendor</th>
                      <th className="px-2 py-1.5 text-left font-medium">Location</th>
                      <th className="px-2 py-1.5 text-left font-medium">Phone #</th>
                      <th className="px-2 py-1.5 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-gray-500">
                          No vendor locations yet
                        </td>
                      </tr>
                    ) : (
                      locations.map((location, idx) => (
                        <tr 
                          key={location.id} 
                          className={`hover:bg-blue-50 group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        >
                          <td className="px-2 py-1 font-medium text-gray-900">
                            {location.supplier_name}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {location.location_name}
                          </td>
                          <td className="px-2 py-1 text-gray-600">
                            {location.phone_number_1 || '-'}
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0"
                                onClick={() => handleEditLocation(location)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteLocation(location.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver - {selectedLoad?.load_id}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Driver</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(driver => (
                    <SelectItem key={driver.id} value={driver.id.toString()}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pickup Date</Label>
              <Input
                type="date"
                value={assignedPickupDate}
                onChange={(e) => setAssignedPickupDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignment}>
              <Save className="h-4 w-4 mr-2" />
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Vendor Location'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-xs">Supplier *</Label>
              <Select 
                value={locationForm.supplier_id} 
                onValueChange={(val) => setLocationForm({...locationForm, supplier_id: val})}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Location Name *</Label>
              <Input
                value={locationForm.location_name}
                onChange={(e) => setLocationForm({...locationForm, location_name: e.target.value})}
                placeholder="e.g., Main Yard, Mill #2"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={locationForm.address}
                onChange={(e) => setLocationForm({...locationForm, address: e.target.value})}
                placeholder="Street address"
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">City</Label>
                <Input
                  value={locationForm.city}
                  onChange={(e) => setLocationForm({...locationForm, city: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">State</Label>
                <Input
                  value={locationForm.state}
                  onChange={(e) => setLocationForm({...locationForm, state: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Zip</Label>
                <Input
                  value={locationForm.zip_code}
                  onChange={(e) => setLocationForm({...locationForm, zip_code: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone 1</Label>
                <Input
                  value={locationForm.phone_number_1}
                  onChange={(e) => setLocationForm({...locationForm, phone_number_1: e.target.value})}
                  placeholder="(555) 123-4567"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Phone 2</Label>
                <Input
                  value={locationForm.phone_number_2}
                  onChange={(e) => setLocationForm({...locationForm, phone_number_2: e.target.value})}
                  placeholder="(555) 123-4567"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={locationForm.notes}
                onChange={(e) => setLocationForm({...locationForm, notes: e.target.value})}
                placeholder="Any special instructions..."
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsLocationDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveLocation}>
              <Save className="h-4 w-4 mr-1" />
              {editingLocation ? 'Update' : 'Add'} Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
