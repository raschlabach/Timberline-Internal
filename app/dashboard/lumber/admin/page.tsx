'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Edit2, Trash2, Building2, TreePine, Award } from 'lucide-react'
import { toast } from 'sonner'
import { LumberSupplierWithLocations } from '@/types/lumber'

interface Species {
  id: number
  name: string
  color: string
  display_order: number
  is_active: boolean
}

interface Grade {
  id: number
  name: string
  display_order: number
  is_active: boolean
}

interface LoadIdRange {
  id: number
  range_name: string
  start_range: number
  end_range: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function LumberAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [suppliers, setSuppliers] = useState<LumberSupplierWithLocations[]>([])
  const [species, setSpecies] = useState<Species[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loadIdRanges, setLoadIdRanges] = useState<LoadIdRange[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Dialog states
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [speciesDialogOpen, setSpeciesDialogOpen] = useState(false)
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false)
  
  // Edit states
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [editingSpecies, setEditingSpecies] = useState<any>(null)
  const [editingGrade, setEditingGrade] = useState<any>(null)
  const [editingRange, setEditingRange] = useState<any>(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)
  
  // Form states
  const [supplierForm, setSupplierForm] = useState({ name: '', notes: '' })
  const [speciesForm, setSpeciesForm] = useState({ name: '', color: '#6B7280', display_order: 0 })
  const [gradeForm, setGradeForm] = useState({ name: '', display_order: 0 })
  const [rangeForm, setRangeForm] = useState({ range_name: '', start_range: 1000, end_range: 9999 })
  const [locationForm, setLocationForm] = useState({
    location_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone_number_1: '',
    phone_number_2: '',
    notes: '',
    is_primary: false
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session?.user?.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  async function fetchData() {
    try {
      const [suppliersRes, speciesRes, gradesRes, rangesRes] = await Promise.all([
        fetch('/api/lumber/suppliers'),
        fetch('/api/lumber/species'),
        fetch('/api/lumber/grades'),
        fetch('/api/lumber/load-id-ranges')
      ])

      if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
      if (speciesRes.ok) setSpecies(await speciesRes.json())
      if (gradesRes.ok) setGrades(await gradesRes.json())
      if (rangesRes.ok) setLoadIdRanges(await rangesRes.json())
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'admin') {
      fetchData()
    }
  }, [status, session])

  // Supplier functions
  async function handleSaveSupplier() {
    try {
      const url = editingSupplier 
        ? `/api/lumber/suppliers/${editingSupplier.id}`
        : '/api/lumber/suppliers'
      
      const response = await fetch(url, {
        method: editingSupplier ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm)
      })

      if (response.ok) {
        toast.success(`Supplier ${editingSupplier ? 'updated' : 'created'} successfully`)
        setSupplierDialogOpen(false)
        setEditingSupplier(null)
        setSupplierForm({ name: '', notes: '' })
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to save supplier')
      }
    } catch (error) {
      console.error('Error saving supplier:', error)
      toast.error('Failed to save supplier')
    }
  }

  async function handleSaveLocation() {
    if (!selectedSupplierId) return

    try {
      const response = await fetch(`/api/lumber/suppliers/${selectedSupplierId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm)
      })

      if (response.ok) {
        toast.success('Location added successfully')
        setLocationDialogOpen(false)
        setLocationForm({
          location_name: '',
          address: '',
          city: '',
          state: '',
          zip_code: '',
          phone_number_1: '',
          phone_number_2: '',
          notes: '',
          is_primary: false
        })
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to add location')
      }
    } catch (error) {
      console.error('Error saving location:', error)
    }
  }

  // Species functions
  async function handleSaveSpecies() {
    try {
      const url = editingSpecies 
        ? `/api/lumber/species/${editingSpecies.id}`
        : '/api/lumber/species'
      
      const response = await fetch(url, {
        method: editingSpecies ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(speciesForm)
      })

      if (response.ok) {
        toast.success(`Species ${editingSpecies ? 'updated' : 'created'} successfully`)
        setSpeciesDialogOpen(false)
        setEditingSpecies(null)
        setSpeciesForm({ name: '', color: '#6B7280', display_order: 0 })
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to save species')
      }
    } catch (error) {
      console.error('Error saving species:', error)
    }
  }

  async function handleDeleteSpecies(id: number) {
    if (!confirm('Are you sure you want to deactivate this species?')) return

    try {
      const response = await fetch(`/api/lumber/species/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Species deactivated')
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting species:', error)
      toast.error('Failed to deactivate species')
    }
  }

  // Grade functions
  async function handleSaveGrade() {
    try {
      const url = editingGrade 
        ? `/api/lumber/grades/${editingGrade.id}`
        : '/api/lumber/grades'
      
      const response = await fetch(url, {
        method: editingGrade ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gradeForm)
      })

      if (response.ok) {
        toast.success(`Grade ${editingGrade ? 'updated' : 'created'} successfully`)
        setGradeDialogOpen(false)
        setEditingGrade(null)
        setGradeForm({ name: '', display_order: 0 })
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to save grade')
      }
    } catch (error) {
      console.error('Error saving grade:', error)
    }
  }

  async function handleDeleteGrade(id: number) {
    if (!confirm('Are you sure you want to deactivate this grade?')) return

    try {
      const response = await fetch(`/api/lumber/grades/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Grade deactivated')
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting grade:', error)
      toast.error('Failed to deactivate grade')
    }
  }

  // Load ID Range functions
  async function handleSaveRange() {
    try {
      const url = editingRange 
        ? `/api/lumber/load-id-ranges/${editingRange.id}`
        : '/api/lumber/load-id-ranges'
      
      const response = await fetch(url, {
        method: editingRange ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rangeForm,
          is_active: !editingRange // New ranges are active by default
        })
      })

      if (response.ok) {
        toast.success(`Load ID range ${editingRange ? 'updated' : 'created'} successfully`)
        setRangeDialogOpen(false)
        setEditingRange(null)
        setRangeForm({ range_name: '', start_range: 1000, end_range: 9999 })
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to save load ID range')
      }
    } catch (error) {
      console.error('Error saving load ID range:', error)
      toast.error('Failed to save load ID range')
    }
  }

  async function handleSetActiveRange(id: number) {
    try {
      const response = await fetch(`/api/lumber/load-id-ranges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      })

      if (response.ok) {
        toast.success('Active range updated')
        fetchData()
      }
    } catch (error) {
      console.error('Error setting active range:', error)
      toast.error('Failed to set active range')
    }
  }

  async function handleDeleteRange(id: number) {
    if (!confirm('Are you sure you want to delete this range?')) return

    try {
      const response = await fetch(`/api/lumber/load-id-ranges/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Range deleted')
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting range:', error)
      toast.error('Failed to delete range')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (session?.user?.role !== 'admin') {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Lumber Admin</h1>
        <p className="text-gray-600 mt-1">
          Manage suppliers, species, grades, and load ID ranges
        </p>
      </div>

      {/* Load ID Ranges Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold">Load ID Ranges</h2>
            <p className="text-sm text-gray-600">Manage automatic load ID assignment ranges</p>
          </div>
          <Button size="sm" onClick={() => {
            setEditingRange(null)
            setRangeForm({ range_name: '', start_range: 1000, end_range: 9999 })
            setRangeDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Range
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loadIdRanges.map(range => (
            <div 
              key={range.id} 
              className={`p-3 rounded-lg border-2 ${
                range.is_active 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{range.range_name}</h3>
                    {range.is_active && (
                      <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Active</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Range: {range.start_range.toLocaleString()} - {range.end_range.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(range.end_range - range.start_range + 1).toLocaleString()} IDs available
                  </p>
                </div>
                <div className="flex gap-1">
                  {!range.is_active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleSetActiveRange(range.id)}
                      title="Set as active"
                    >
                      <Award className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleDeleteRange(range.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Suppliers Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Suppliers
            </h2>
            <Button size="sm" onClick={() => {
              setEditingSupplier(null)
              setSupplierForm({ name: '', notes: '' })
              setSupplierDialogOpen(true)
            }}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow divide-y max-h-[calc(100vh-250px)] overflow-y-auto">
            {suppliers.map(supplier => (
              <div key={supplier.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{supplier.name}</h3>
                    {supplier.notes && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{supplier.notes}</p>
                    )}
                    
                    {supplier.locations.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {supplier.locations.map(location => (
                          <div key={location.id} className="text-xs pl-2 border-l-2 border-gray-200">
                            <div className="font-medium">{location.location_name}</div>
                            {location.phone_number_1 && (
                              <div className="text-gray-600">{location.phone_number_1}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedSupplierId(supplier.id)
                        setLocationDialogOpen(true)
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setEditingSupplier(supplier)
                        setSupplierForm({ name: supplier.name, notes: supplier.notes || '' })
                        setSupplierDialogOpen(true)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Species Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TreePine className="h-5 w-5" />
              Species
            </h2>
            <Button size="sm" onClick={() => {
              setEditingSpecies(null)
              setSpeciesForm({ name: '', color: '#6B7280', display_order: 0 })
              setSpeciesDialogOpen(true)
            }}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden max-h-[calc(100vh-250px)] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {species.map(sp => (
                  <tr key={sp.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border border-gray-300"
                          style={{ backgroundColor: sp.color || '#6B7280' }}
                        />
                        <span className="text-xs text-gray-500 font-mono">{sp.color || '#6B7280'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{sp.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{sp.display_order}</td>
                    <td className="px-3 py-2 text-sm text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setEditingSpecies(sp)
                          setSpeciesForm({ name: sp.name, color: sp.color || '#6B7280', display_order: sp.display_order })
                          setSpeciesDialogOpen(true)
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDeleteSpecies(sp.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grades Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Award className="h-5 w-5" />
              Grades
            </h2>
            <Button size="sm" onClick={() => {
              setEditingGrade(null)
              setGradeForm({ name: '', display_order: 0 })
              setGradeDialogOpen(true)
            }}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden max-h-[calc(100vh-250px)] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {grades.map(grade => (
                  <tr key={grade.id}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{grade.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{grade.display_order}</td>
                    <td className="px-3 py-2 text-sm text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setEditingGrade(grade)
                          setGradeForm({ name: grade.name, display_order: grade.display_order })
                          setGradeDialogOpen(true)
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDeleteGrade(grade.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Supplier Dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit' : 'Add'} Supplier</DialogTitle>
            <DialogDescription>
              {editingSupplier ? 'Update supplier information' : 'Create a new lumber supplier'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="supplier-name">Name *</Label>
              <Input
                id="supplier-name"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="supplier-notes">Notes</Label>
              <Textarea
                id="supplier-notes"
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSupplier}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
            <DialogDescription>Add a new location for this supplier</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label>Location Name *</Label>
              <Input
                value={locationForm.location_name}
                onChange={(e) => setLocationForm({ ...locationForm, location_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={locationForm.city}
                onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
              />
            </div>
            <div>
              <Label>State</Label>
              <Input
                value={locationForm.state}
                onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
              />
            </div>
            <div>
              <Label>Zip Code</Label>
              <Input
                value={locationForm.zip_code}
                onChange={(e) => setLocationForm({ ...locationForm, zip_code: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone 1</Label>
              <Input
                value={locationForm.phone_number_1}
                onChange={(e) => setLocationForm({ ...locationForm, phone_number_1: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone 2</Label>
              <Input
                value={locationForm.phone_number_2}
                onChange={(e) => setLocationForm({ ...locationForm, phone_number_2: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={locationForm.notes}
                onChange={(e) => setLocationForm({ ...locationForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLocation}>Add Location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Species Dialog */}
      <Dialog open={speciesDialogOpen} onOpenChange={setSpeciesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSpecies ? 'Edit' : 'Add'} Species</DialogTitle>
            <DialogDescription>
              {editingSpecies ? 'Update species information' : 'Add a new lumber species'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="species-name">Name *</Label>
              <Input
                id="species-name"
                value={speciesForm.name}
                onChange={(e) => setSpeciesForm({ ...speciesForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="species-color">Color</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="species-color"
                  type="color"
                  value={speciesForm.color}
                  onChange={(e) => setSpeciesForm({ ...speciesForm, color: e.target.value })}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={speciesForm.color}
                  onChange={(e) => setSpeciesForm({ ...speciesForm, color: e.target.value })}
                  placeholder="#6B7280"
                  className="flex-1 font-mono"
                />
                <div 
                  className="w-10 h-10 rounded border-2 border-gray-300"
                  style={{ backgroundColor: speciesForm.color }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="species-order">Display Order</Label>
              <Input
                id="species-order"
                type="number"
                value={speciesForm.display_order}
                onChange={(e) => setSpeciesForm({ ...speciesForm, display_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpeciesDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSpecies}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Dialog */}
      <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGrade ? 'Edit' : 'Add'} Grade</DialogTitle>
            <DialogDescription>
              {editingGrade ? 'Update grade information' : 'Add a new lumber grade'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="grade-name">Name *</Label>
              <Input
                id="grade-name"
                value={gradeForm.name}
                onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="grade-order">Display Order</Label>
              <Input
                id="grade-order"
                type="number"
                value={gradeForm.display_order}
                onChange={(e) => setGradeForm({ ...gradeForm, display_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGrade}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load ID Range Dialog */}
      <Dialog open={rangeDialogOpen} onOpenChange={setRangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRange ? 'Edit' : 'Add'} Load ID Range</DialogTitle>
            <DialogDescription>
              {editingRange ? 'Update load ID range' : 'Create a new load ID range for automatic assignment'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="range-name">Range Name *</Label>
              <Input
                id="range-name"
                placeholder="e.g., 2024 Range, Main Range"
                value={rangeForm.range_name}
                onChange={(e) => setRangeForm({ ...rangeForm, range_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-range">Start Range *</Label>
                <Input
                  id="start-range"
                  type="number"
                  value={rangeForm.start_range}
                  onChange={(e) => setRangeForm({ ...rangeForm, start_range: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="end-range">End Range *</Label>
                <Input
                  id="end-range"
                  type="number"
                  value={rangeForm.end_range}
                  onChange={(e) => setRangeForm({ ...rangeForm, end_range: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <p className="text-sm text-gray-600">
              This range will contain {(rangeForm.end_range - rangeForm.start_range + 1).toLocaleString()} available load IDs
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRangeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRange}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
