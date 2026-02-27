'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Upload, FileText, X, Trash2, Plus, Settings, Pencil, Check } from 'lucide-react'
import { toast } from 'sonner'

interface SupplierPlant {
  id: number
  supplier_id: number
  plant_name: string
}

interface UploadedDocument {
  id: number
  filename: string
  filepath: string
  file_type: string
  uploaded_at: string
}

export default function DataEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const loadId = params?.loadId as string

  const [load, setLoad] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [actualFootage, setActualFootage] = useState<{ [key: number]: string }>({})
  const [arrivalDate, setArrivalDate] = useState('')
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
  const [mergingPlantId, setMergingPlantId] = useState<number | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState<string>('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceTotal, setInvoiceTotal] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  
  // Document upload state
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchLoad() {
      try {
        const response = await fetch(`/api/lumber/loads/${loadId}`)
        if (response.ok) {
          const data = await response.json()
          setLoad(data)
          
          // Pre-fill if data exists
          if (data.actual_arrival_date) setArrivalDate(data.actual_arrival_date)
          if (data.pickup_number) setPickupNumber(data.pickup_number)
          if (data.plant) setPlant(data.plant)
          if (data.plant_id) setPlantId(data.plant_id.toString())
          if (data.invoice_number) setInvoiceNumber(data.invoice_number)

          if (data.supplier_id) {
            try {
              const plantsRes = await fetch(`/api/lumber/suppliers/plants?supplierId=${data.supplier_id}`)
              if (plantsRes.ok) {
                const plantsData = await plantsRes.json()
                setSupplierPlants(plantsData.plants || [])
              }
            } catch {}
          }
          if (data.invoice_total) setInvoiceTotal(data.invoice_total.toString())
          if (data.invoice_date) setInvoiceDate(data.invoice_date)
          
          // Pre-fill actual footage
          const footageMap: { [key: number]: string } = {}
          data.items?.forEach((item: any) => {
            if (item.actual_footage) {
              footageMap[item.id] = item.actual_footage.toString()
            }
          })
          setActualFootage(footageMap)
          
          // Fetch documents
          fetchDocuments(data.load_id)
        }
      } catch (error) {
        console.error('Error fetching load:', error)
        toast.error('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated' && loadId) {
      fetchLoad()
    }
  }, [status, loadId])

  async function fetchDocuments(loadIdStr: string) {
    try {
      const response = await fetch(`/api/lumber/documents/upload?loadId=${loadIdStr}`)
      if (response.ok) {
        const docs = await response.json()
        setDocuments(docs)
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0 || !load?.load_id) return
    
    setIsUploading(true)
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('loadId', load.load_id)
        
        const response = await fetch('/api/lumber/documents/upload', {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }
      }
      
      toast.success(`${files.length} file(s) uploaded successfully`)
      fetchDocuments(load.load_id)
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload file(s)')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeleteDocument(docId: number) {
    if (!confirm('Delete this document?')) return
    
    try {
      const response = await fetch(`/api/lumber/documents/${docId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        toast.success('Document deleted')
        if (load?.load_id) fetchDocuments(load.load_id)
      } else {
        toast.error('Failed to delete document')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete document')
    }
  }

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    handleFileUpload(files)
  }, [load?.load_id])

  async function refreshPlants() {
    if (!load?.supplier_id) return
    try {
      const res = await fetch(`/api/lumber/suppliers/plants?supplierId=${load.supplier_id}`)
      if (res.ok) {
        const data = await res.json()
        setSupplierPlants(data.plants || [])
      }
    } catch {}
  }

  async function handleAddPlantFromDialog() {
    if (!managePlantNewName.trim() || !load?.supplier_id) return
    try {
      const res = await fetch('/api/lumber/suppliers/plants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: load.supplier_id, plantName: managePlantNewName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.existed) {
          toast.info('Plant already exists')
        } else {
          toast.success('Plant added')
        }
        setManagePlantNewName('')
        await refreshPlants()
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
        await refreshPlants()
        const updated = supplierPlants.find(p => p.id === id)
        if (updated && plantId === id.toString()) {
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

  async function handleDeletePlant(id: number, mergeIntoId?: string) {
    try {
      const url = mergeIntoId
        ? `/api/lumber/suppliers/plants?plantId=${id}&mergeIntoId=${mergeIntoId}`
        : `/api/lumber/suppliers/plants?plantId=${id}`
      const res = await fetch(url, { method: 'DELETE' })

      if (res.ok) {
        const data = await res.json()
        if (data.merged > 0) {
          toast.success(`Merged ${data.merged} load(s) and deleted plant`)
        } else {
          toast.success('Plant deleted')
        }
        if (plantId === id.toString()) {
          setPlantId(mergeIntoId || '')
          const target = supplierPlants.find(p => p.id.toString() === mergeIntoId)
          setPlant(target?.plant_name || '')
        }
        setMergingPlantId(null)
        setMergeTargetId('')
        await refreshPlants()
      } else if (res.status === 409) {
        setMergingPlantId(id)
        setMergeTargetId('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Failed to delete plant')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Update load with arrival and invoice info
      const response = await fetch(`/api/lumber/loads/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_arrival_date: arrivalDate || null,
          pickup_number: pickupNumber || null,
          plant: plant || null,
          plant_id: plantId ? parseInt(plantId) : null,
          invoice_number: invoiceNumber || null,
          invoice_total: invoiceTotal ? parseFloat(invoiceTotal) : null,
          invoice_date: invoiceDate || null
        })
      })

      if (!response.ok) throw new Error('Failed to update load')

      // Update actual footage for each item
      for (const [itemId, footage] of Object.entries(actualFootage)) {
        if (footage) {
          await fetch(`/api/lumber/loads/items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actual_footage: parseFloat(footage) })
          })
        }
      }

      toast.success('Data saved successfully')
      router.push('/dashboard/lumber/incoming')
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save data')
    } finally {
      setIsSaving(false)
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Entry - {load.load_id}</h1>
          <p className="text-gray-600 mt-1">{load.supplier_name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Actual Footage Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Actual Board Footage</h2>
          <div className="space-y-3">
            {load.items?.map((item: any) => (
              <div key={item.id} className="grid grid-cols-2 gap-4 items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{item.species} - {item.grade}</div>
                  <div className="text-sm text-gray-600">
                    {item.thickness} | Est: {item.estimated_footage?.toLocaleString() || '-'} ft
                  </div>
                </div>
                <div>
                  <Label htmlFor={`footage-${item.id}`}>Actual Footage</Label>
                  <Input
                    id={`footage-${item.id}`}
                    type="number"
                    step="0.01"
                    value={actualFootage[item.id] || ''}
                    onChange={(e) => setActualFootage({ ...actualFootage, [item.id]: e.target.value })}
                    placeholder="Enter actual footage"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrival Info */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Arrival Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="arrivalDate">Arrival Date</Label>
              <Input
                id="arrivalDate"
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pickupNumber">Pickup Number</Label>
              <Input
                id="pickupNumber"
                value={pickupNumber}
                onChange={(e) => setPickupNumber(e.target.value)}
                placeholder="e.g., PU-12345"
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
                      if (!newPlantName.trim() || !load?.supplier_id) return
                      try {
                        const res = await fetch('/api/lumber/suppliers/plants', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ supplierId: load.supplier_id, plantName: newPlantName.trim() }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          const newPlant = data.plant
                          setSupplierPlants(prev => [...prev, newPlant].sort((a, b) => a.plant_name.localeCompare(b.plant_name)))
                          setPlantId(newPlant.id.toString())
                          setPlant(newPlant.plant_name)
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
          </div>
        </div>

        {/* Invoice Info */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Invoice Information</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-12345"
              />
            </div>
            <div>
              <Label htmlFor="invoiceTotal">Invoice Total</Label>
              <Input
                id="invoiceTotal"
                type="number"
                step="0.01"
                value={invoiceTotal}
                onChange={(e) => setInvoiceTotal(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Document Upload */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Documents & Attachments</h2>
          
          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
              ${isUploading ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            />
            
            <Upload className={`mx-auto h-12 w-12 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            
            {isUploading ? (
              <div>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Uploading...</p>
              </div>
            ) : isDragging ? (
              <p className="text-blue-600 font-medium">Drop files here</p>
            ) : (
              <>
                <p className="text-gray-600 font-medium">Drag and drop files here</p>
                <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">PDF, Images, Word, Excel accepted</p>
              </>
            )}
          </div>

          {/* Uploaded Documents List */}
          {documents.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Uploaded Documents ({documents.length})</h3>
              <div className="border rounded-lg divide-y">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <a 
                          href={doc.filepath} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {doc.filename}
                        </a>
                        <p className="text-xs text-gray-500">
                          {new Date(doc.uploaded_at).toLocaleDateString('en-US', { 
                            timeZone: 'UTC',
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Data'}
          </Button>
        </div>
      </form>

      {/* Manage Plants Dialog */}
      <Dialog open={isManagePlantsOpen} onOpenChange={setIsManagePlantsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Plants — {load?.supplier_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add new plant */}
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

            {/* Plant list */}
            <div className="border rounded-md divide-y max-h-[350px] overflow-y-auto">
              {supplierPlants.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  No plants yet for this supplier
                </div>
              ) : (
                supplierPlants.map(p => (
                  <div key={p.id} className="px-3 py-2.5">
                    {editingPlantId === p.id ? (
                      <div className="flex items-center gap-2">
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
                      </div>
                    ) : mergingPlantId === p.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm font-medium text-red-700">{p.plant_name}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => { setMergingPlantId(null); setMergeTargetId('') }}
                          >
                            Cancel
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">This plant has loads linked to it. Merge them into:</p>
                        <div className="flex gap-2">
                          <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                            <SelectTrigger className="flex-1 h-8 text-sm">
                              <SelectValue placeholder="Pick a plant to merge into..." />
                            </SelectTrigger>
                            <SelectContent>
                              {supplierPlants.filter(sp => sp.id !== p.id).map(sp => (
                                <SelectItem key={sp.id} value={sp.id.toString()}>{sp.plant_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={!mergeTargetId}
                            className="h-8 text-xs"
                            onClick={() => handleDeletePlant(p.id, mergeTargetId)}
                          >
                            Merge & Delete
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
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
                      </div>
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
