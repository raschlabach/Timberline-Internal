'use client'

import { useEffect, useState } from 'react'
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
import { ArrowLeft, Save, FileText, Trash2, Plus, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'

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
  const [truckDriver, setTruckDriver] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceTotal, setInvoiceTotal] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [allPacksFinished, setAllPacksFinished] = useState(false)
  const [poGenerated, setPoGenerated] = useState(false)
  
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
          setTruckDriver(loadData.truck_driver_id?.toString() || '')
          setPickupDate(loadData.pickup_date?.split('T')[0] || '')
          setInvoiceNumber(loadData.invoice_number || '')
          setInvoiceTotal(loadData.invoice_total?.toString() || '')
          setInvoiceDate(loadData.invoice_date?.split('T')[0] || '')
          setAllPacksFinished(loadData.all_packs_finished || false)
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
          pickup_number: pickupNumber,
          plant,
          truck_driver_id: truckDriver ? parseInt(truckDriver) : null,
          pickup_date: pickupDate || null,
          invoice_number: invoiceNumber,
          invoice_total: invoiceTotal ? parseFloat(invoiceTotal) : null,
          invoice_date: invoiceDate || null,
          all_packs_finished: allPacksFinished
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
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
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
                      onChange={(e) => updateItem(idx, 'estimated_footage', e.target.value ? parseFloat(e.target.value) : null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Actual Footage</Label>
                    <Input
                      type="number"
                      value={item.actual_footage || ''}
                      onChange={(e) => updateItem(idx, 'actual_footage', e.target.value ? parseFloat(e.target.value) : null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Price per BF</Label>
                    <Input
                      type="number"
                      step="0.01"
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
              <Input
                id="plant"
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                className="mt-1"
              />
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
          <div className="mt-6 pt-6 border-t">
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
    </div>
  )
}
