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
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Edit2, Trash2, Building2, TreePine, Award } from 'lucide-react'
import { toast } from 'sonner'
import { LumberSupplierWithLocations } from '@/types/lumber'

interface Species {
  id: number
  name: string
  display_order: number
  is_active: boolean
}

interface Grade {
  id: number
  name: string
  display_order: number
  is_active: boolean
}

export default function LumberAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [suppliers, setSuppliers] = useState<LumberSupplierWithLocations[]>([])
  const [species, setSpecies] = useState<Species[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Dialog states
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [speciesDialogOpen, setSpeciesDialogOpen] = useState(false)
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  
  // Edit states
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [editingSpecies, setEditingSpecies] = useState<any>(null)
  const [editingGrade, setEditingGrade] = useState<any>(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)
  
  // Form states
  const [supplierForm, setSupplierForm] = useState({ name: '', notes: '' })
  const [speciesForm, setSpeciesForm] = useState({ name: '', display_order: 0 })
  const [gradeForm, setGradeForm] = useState({ name: '', display_order: 0 })
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
      const [suppliersRes, speciesRes, gradesRes] = await Promise.all([
        fetch('/api/lumber/suppliers'),
        fetch('/api/lumber/species'),
        fetch('/api/lumber/grades')
      ])

      if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
      if (speciesRes.ok) setSpecies(await speciesRes.json())
      if (gradesRes.ok) setGrades(await gradesRes.json())
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
        setSpeciesForm({ name: '', display_order: 0 })
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
          Manage suppliers, species, and grades
        </p>
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
              setSpeciesForm({ name: '', display_order: 0 })
              setSpeciesDialogOpen(true)
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
                {species.map(sp => (
                  <tr key={sp.id}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{sp.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{sp.display_order}</td>
                    <td className="px-3 py-2 text-sm text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setEditingSpecies(sp)
                          setSpeciesForm({ name: sp.name, display_order: sp.display_order })
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
    </div>
  )
}
