'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Save, FileText, Trash2, Plus, CheckCircle2, X, Settings, Pencil, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'

interface SupplierPlant {
  id: number
  supplier_id: number
  plant_name: string
}

interface LoadItem {
  id: number
  species: string
  grade: string
  thickness: string
  estimated_footage: number | null
  actual_footage: number | null
  price: number | null
}

export default function LoadInfoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const loadId = params?.loadId as string

  const [load, setLoad] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [loadIdField, setLoadIdField] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [lumberType, setLumberType] = useState('')
  const [pickupOrDelivery, setPickupOrDelivery] = useState('')
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('')
  const [comments, setComments] = useState('')
  const [items, setItems] = useState<LoadItem[]>([])
  const [actualArrivalDate, setActualArrivalDate] = useState('')
  const [pickupNumber, setPickupNumber] = useState('')
  const [plant, setPlant] = useState('')
  const [plantId, setPlantId] = useState<string>('')
  const [supplierPlants, setSupplierPlants] = useState<SupplierPlant[]>([])
  const [isAddingPlant, setIsAddingPlant] = useState(false)
  const [newPlantName, setNewPlantName] = useState('')
  const [isManagePlantsOpen, setIsManagePlantsOpen] = useState(false)
  const [managePlantNewName, setManagePlantNewName] = useState('')
  const [editingPlantId, setEditingPlantId] = useState<number | null>(null)
  const [editingPlantName, setEditingPlantName] = useState('')
  const [truckDriver, setTruckDriver] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceTotal, setInvoiceTotal] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [allPacksFinished, setAllPacksFinished] = useState(false)
  const [poGenerated, setPoGenerated] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Reference data
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [speciesList, setSpeciesList] = useState<any[]>([])
  const [gradesList, setGradesList] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const [loadRes, suppliersRes, speciesRes, gradesRes, driversRes, docsRes] = await Promise.all([
          fetch(`/api/lumber/loads/${loadId}`),
          fetch('/api/lumber/suppliers'),
          fetch('/api/lumber/species'),
          fetch('/api/lumber/grades'),
          fetch('/api/lumber/drivers'),
          fetch(`/api/lumber/documents/upload?loadId=${loadId}`)
        ])

        if (loadRes.ok) {
          const loadData = await loadRes.json()
          setLoad(loadData)
          
          // Populate form fields
          setLoadIdField(loadData.load_id || '')
          setSupplierId(loadData.supplier_id?.toString() || '')
          setLumberType(loadData.lumber_type || '')
          setPickupOrDelivery(loadData.pickup_or_delivery || '')
          setEstimatedDeliveryDate(loadData.estimated_delivery_date?.split('T')[0] || '')
          setComments(loadData.comments || '')
          setItems(loadData.items || [])
          setActualArrivalDate(loadData.actual_arrival_date?.split('T')[0] || '')
          setPickupNumber(loadData.pickup_number || '')
          setPlant(loadData.plant || '')
          setPlantId(loadData.plant_id?.toString() || '')
          setTruckDriver(loadData.driver_id?.toString() || '')

          if (loadData.supplier_id) {
            try {
              const plantsRes = await fetch(`/api/lumber/suppliers/plants?supplierId=${loadData.supplier_id}`)
              if (plantsRes.ok) {
                const plantsData = await plantsRes.json()
                setSupplierPlants(plantsData.plants || [])
              }
            } catch {}
          }
          setPickupDate(loadData.pickup_date?.split('T')[0] || '')
          setInvoiceNumber(loadData.invoice_number || '')
          setInvoiceTotal(loadData.invoice_total?.toString() || '')
          setInvoiceDate(loadData.invoice_date?.split('T')[0] || '')
          setAllPacksFinished(loadData.all_packs_finished || false)
          setPoGenerated(loadData.po_generated || false)
        }

        if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
        if (speciesRes.ok) setSpeciesList(await speciesRes.json())
        if (gradesRes.ok) setGradesList(await gradesRes.json())
        if (driversRes.ok) setDrivers(await driversRes.json())
        if (docsRes.ok) setDocuments(await docsRes.json())
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated' && loadId) {
      fetchData()
    }
  }, [status, loadId])

  const fetchPlants = useCallback(async (sid: string) => {
    if (!sid) {
      setSupplierPlants([])
      return
    }
    try {
      const res = await fetch(`/api/lumber/suppliers/plants?supplierId=${sid}`)
      if (res.ok) {
        const data = await res.json()
        setSupplierPlants(data.plants || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (supplierId) fetchPlants(supplierId)
  }, [supplierId, fetchPlants])

  async function handleAddPlantFromDialog() {
    if (!managePlantNewName.trim() || !supplierId) return
    try {
      const res = await fetch('/api/lumber/suppliers/plants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: parseInt(supplierId), plantName: managePlantNewName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.existed) {
          toast.info('Plant already exists')
        } else {
          toast.success('Plant added')
        }
        setManagePlantNewName('')
        await fetchPlants(supplierId)
      }
    } catch {
      toast.error('Failed to add plant')
    }
  }

  async function handleRenamePlant(id: number) {
    if (!editingPlantName.trim()) return
    try {
      const res = await fetch('/api/lumber/suppliers/plants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantId: id, plantName: editingPlantName.trim() }),
      })
      if (res.ok) {
        toast.success('Plant renamed')
        setEditingPlantId(null)
        setEditingPlantName('')
        await fetchPlants(supplierId)
        if (plantId === id.toString()) {
          setPlant(editingPlantName.trim())
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to rename')
      }
    } catch {
      toast.error('Failed to rename plant')
    }
  }

  async function handleDeletePlant(id: number) {
    if (!confirm('Delete this plant? This only works if no loads are using it.')) return
    try {
      const res = await fetch(`/api/lumber/suppliers/plants?plantId=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Plant deleted')
        if (plantId === id.toString()) {
          setPlantId('')
          setPlant('')
        }
        await fetchPlants(supplierId)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Failed to delete plant')
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      // Update main load data
      const loadResponse = await fetch(`/api/lumber/loads/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: loadIdField,
          supplier_id: supplierId ? parseInt(supplierId) : null,
          lumber_type: lumberType,
          pickup_or_delivery: pickupOrDelivery,
          estimated_delivery_date: estimatedDeliveryDate || null,
          comments,
          actual_arrival_date: actualArrivalDate || null,
          pickup_number: pickupNumber || null,
          plant: plant || null,
          plant_id: plantId ? parseInt(plantId) : null,
          truck_driver_id: truckDriver && truckDriver !== 'none' ? parseInt(truckDriver) : null,
          pickup_date: pickupDate || null,
          invoice_number: invoiceNumber || null,
          invoice_total: invoiceTotal ? parseFloat(invoiceTotal) : null,
          invoice_date: invoiceDate || null,
          all_packs_finished: allPacksFinished,
          po_generated: poGenerated
        })
      })

      if (!loadResponse.ok) {
        throw new Error('Failed to update load')
      }

      // Update each item
      for (const item of items) {
        const itemResponse = await fetch(`/api/lumber/loads/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            species: item.species,
            grade: item.grade,
            thickness: item.thickness,
            estimated_footage: item.estimated_footage,
            actual_footage: item.actual_footage,
            price: item.price
          })
        })

        if (!itemResponse.ok) {
          throw new Error(`Failed to update item ${item.id}`)
        }
      }

      toast.success('Load updated successfully')
      router.refresh()
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  function updateItem(index: number, field: string, value: any) {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete load ${loadIdField}?\n\nThis will permanently delete:\n- All load items\n- All packs/tallies\n- All attached documents\n\nThis action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/lumber/loads/${loadId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success(`Load ${loadIdField} deleted successfully`)
        router.push('/dashboard/lumber/all-loads')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete load')
      }
    } catch (error) {
      console.error('Error deleting load:', error)
      toast.error('Failed to delete load')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('loadId', load.load_id)

    try {
      const response = await fetch('/api/lumber/documents/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const newDoc = await response.json()
        setDocuments([...documents, newDoc])
        toast.success('Document uploaded successfully')
        // Clear file input
        e.target.value = ''
      } else {
        toast.error('Failed to upload document')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload document')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!load) {
    return <div className="text-center py-12">Load not found</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      <div className="flex items-center justify-between sticky top-0 bg-white z-10 py-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Load Information</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleDelete} 
            disabled={isDeleting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete Load'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        {/* Basic Info */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="load_id">Load ID</Label>
              <Input
                id="load_id"
                value={loadIdField}
                onChange={(e) => setLoadIdField(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lumber_type">Lumber Type</Label>
              <Select value={lumberType} onValueChange={setLumberType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dried">Dried</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pickup_or_delivery">Pickup or Delivery</Label>
              <Select value={pickupOrDelivery} onValueChange={setPickupOrDelivery}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Pickup</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="eta">Estimated Delivery Date</Label>
              <Input
                id="eta"
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Load Items</h2>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-sm">Item {idx + 1}</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Species</Label>
                    <Select 
                      value={item.species} 
                      onValueChange={(val) => updateItem(idx, 'species', val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {speciesList.map((species) => (
                          <SelectItem key={species.id} value={species.name}>
                            {species.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Grade</Label>
                    <Select 
                      value={item.grade} 
                      onValueChange={(val) => updateItem(idx, 'grade', val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {gradesList.map((grade) => (
                          <SelectItem key={grade.id} value={grade.name}>
                            {grade.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Thickness</Label>
                    <Input
                      value={item.thickness}
                      onChange={(e) => updateItem(idx, 'thickness', e.target.value)}
                      className="mt-1"
                      placeholder="e.g., 4/4"
                    />
                  </div>
                  <div>
                    <Label>Estimated Footage</Label>
                    <Input
                      type="number"
                      value={item.estimated_footage || ''}
                      onChange={(e) => updateItem(idx, 'estimated_footage', e.target.value ? parseInt(e.target.value) : null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Actual Footage</Label>
                    <Input
                      type="number"
                      value={item.actual_footage || ''}
                      onChange={(e) => updateItem(idx, 'actual_footage', e.target.value ? parseInt(e.target.value) : null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Price per BF</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={item.price || ''}
                      onChange={(e) => updateItem(idx, 'price', e.target.value ? parseFloat(e.target.value) : null)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrival/Trucking Info */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Arrival & Trucking Information</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="arrival_date">Actual Arrival Date</Label>
              <Input
                id="arrival_date"
                type="date"
                value={actualArrivalDate}
                onChange={(e) => setActualArrivalDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pickup_number">Pickup Number</Label>
              <Input
                id="pickup_number"
                value={pickupNumber}
                onChange={(e) => setPickupNumber(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="plant">Plant</Label>
              {isAddingPlant ? (
                <div className="flex gap-1.5 mt-1">
                  <Input
                    value={newPlantName}
                    onChange={(e) => setNewPlantName(e.target.value)}
                    placeholder="New plant name"
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsAddingPlant(false)
                        setNewPlantName('')
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newPlantName.trim()}
                    onClick={async () => {
                      if (!newPlantName.trim() || !supplierId) return
                      try {
                        const res = await fetch('/api/lumber/suppliers/plants', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ supplierId: parseInt(supplierId), plantName: newPlantName.trim() }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          const np = data.plant
                          setSupplierPlants(prev => [...prev, np].sort((a, b) => a.plant_name.localeCompare(b.plant_name)))
                          setPlantId(np.id.toString())
                          setPlant(np.plant_name)
                          setIsAddingPlant(false)
                          setNewPlantName('')
                          toast.success('Plant added')
                        }
                      } catch {
                        toast.error('Failed to add plant')
                      }
                    }}
                  >
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setIsAddingPlant(false); setNewPlantName('') }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5 mt-1">
                  <Select
                    value={plantId || 'none'}
                    onValueChange={(val) => {
                      if (val === 'none') {
                        setPlantId('')
                        setPlant('')
                      } else {
                        setPlantId(val)
                        const selected = supplierPlants.find(p => p.id.toString() === val)
                        if (selected) setPlant(selected.plant_name)
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select plant..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {supplierPlants.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.plant_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={() => setIsAddingPlant(true)} title="Add new plant">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => setIsManagePlantsOpen(true)} title="Manage plants">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="truck_driver">Truck Driver</Label>
              <Select value={truckDriver} onValueChange={setTruckDriver}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id.toString()}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pickup_date">Pickup Date</Label>
              <Input
                id="pickup_date"
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Invoice Info */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Invoice Information</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="invoice_total">Invoice Total</Label>
              <Input
                id="invoice_total"
                type="number"
                step="0.01"
                value={invoiceTotal}
                onChange={(e) => setInvoiceTotal(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="invoice_date">Invoice Date</Label>
              <Input
                id="invoice_date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          {/* Load Status */}
          <div className="mt-6 pt-6 border-t space-y-3">
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Checkbox 
                id="all_packs_finished"
                checked={allPacksFinished}
                onCheckedChange={(checked) => setAllPacksFinished(checked === true)}
              />
              <div className="flex-1">
                <Label 
                  htmlFor="all_packs_finished" 
                  className="text-base font-semibold cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className={`h-5 w-5 ${allPacksFinished ? 'text-green-600' : 'text-gray-400'}`} />
                  Mark Load as Completely Finished
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  Check this when all packs have been ripped and the load is complete. 
                  This will remove it from inventory.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border-2 border-dashed border-blue-300">
              <Checkbox 
                id="po_generated"
                checked={poGenerated}
                onCheckedChange={(checked) => setPoGenerated(checked === true)}
              />
              <div className="flex-1">
                <Label 
                  htmlFor="po_generated" 
                  className="text-base font-semibold cursor-pointer flex items-center gap-2"
                >
                  <FileText className={`h-5 w-5 ${poGenerated ? 'text-blue-600' : 'text-gray-400'}`} />
                  PO Generated
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  Uncheck this to return the load to the PO page. 
                  Check to mark PO as already generated.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Paperwork */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Paperwork & Documents</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="upload">Upload Document</Label>
              <Input
                id="upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="mt-1"
              />
            </div>
            {documents.length > 0 && (
              <div className="space-y-2">
                <Label>Attached Documents</Label>
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{doc.filename}</span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manage Plants Dialog */}
      <Dialog open={isManagePlantsOpen} onOpenChange={setIsManagePlantsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Plants — {suppliers.find(s => s.id?.toString() === supplierId)?.name || 'Supplier'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New plant name..."
                value={managePlantNewName}
                onChange={(e) => setManagePlantNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPlantFromDialog() } }}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                disabled={!managePlantNewName.trim()}
                onClick={handleAddPlantFromDialog}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
              {supplierPlants.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  No plants yet for this supplier
                </div>
              ) : (
                supplierPlants.map(p => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
                    {editingPlantId === p.id ? (
                      <>
                        <Input
                          value={editingPlantName}
                          onChange={(e) => setEditingPlantName(e.target.value)}
                          className="flex-1 h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleRenamePlant(p.id) }
                            if (e.key === 'Escape') { setEditingPlantId(null); setEditingPlantName('') }
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-green-600"
                          onClick={() => handleRenamePlant(p.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => { setEditingPlantId(null); setEditingPlantName('') }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{p.plant_name}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-gray-400 hover:text-gray-600"
                          onClick={() => { setEditingPlantId(p.id); setEditingPlantName(p.plant_name) }}
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-gray-400 hover:text-red-600"
                          onClick={() => handleDeletePlant(p.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
