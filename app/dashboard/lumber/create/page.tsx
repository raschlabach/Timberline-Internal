'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import { LumberSupplierWithLocations, CreateLoadItemInput, Thickness, LumberLoadPreset } from '@/types/lumber'
import { Plus, Trash2, Copy, ArrowLeft, BookmarkIcon, Star, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

const THICKNESSES: Thickness[] = ['4/4', '5/4', '6/4', '7/4', '8/4']
const LUMBER_TYPES = ['dried', 'green']
const PICKUP_OR_DELIVERY_OPTIONS = ['pickup', 'delivery']

export default function CreateLoadPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  
  const [suppliers, setSuppliers] = useState<LumberSupplierWithLocations[]>([])
  const [species, setSpecies] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [presets, setPresets] = useState<LumberLoadPreset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  
  // Form state
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [supplierLocationId, setSupplierLocationId] = useState<number | null>(null)
  const [lumberType, setLumberType] = useState<string>('dried')
  const [pickupOrDelivery, setPickupOrDelivery] = useState<string>('')
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('')
  const [comments, setComments] = useState('')
  const [items, setItems] = useState<(CreateLoadItemInput & { load_id: string })[]>([
    { load_id: '', species: '', grade: '', thickness: '4/4', estimated_footage: null, price: null }
  ])

  const selectedSupplier = suppliers.find(s => s.id === supplierId)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/create')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const [suppliersRes, speciesRes, gradesRes, presetsRes] = await Promise.all([
          fetch('/api/lumber/suppliers'),
          fetch('/api/lumber/species'),
          fetch('/api/lumber/grades'),
          fetch('/api/lumber/presets')
        ])
        
        if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
        if (speciesRes.ok) setSpecies(await speciesRes.json())
        if (gradesRes.ok) setGrades(await gradesRes.json())
        if (presetsRes.ok) setPresets(await presetsRes.json())

        // Fetch the first available load ID for initial item
        try {
          const response = await fetch('/api/lumber/load-id-ranges/next-available?count=1')
          if (response.ok) {
            const data = await response.json()
            if (data.loadIds && data.loadIds.length > 0) {
              setItems([{ 
                load_id: data.loadIds[0], 
                species: '', 
                grade: '', 
                thickness: '4/4', 
                estimated_footage: null, 
                price: null 
              }])
            }
          } else {
            const errorData = await response.json()
            if (response.status === 404) {
              toast.error('No Load ID range configured. Please set one up in Lumber Admin.')
            }
            console.error('Load ID API error:', errorData)
          }
        } catch (error) {
          console.error('Error fetching initial load ID:', error)
          toast.error('Failed to fetch initial Load ID. Please refresh the page.')
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    if (status === 'authenticated') {
      fetchData()
    }
  }, [status])

  async function handleAddItem() {
    const newIndex = items.length
    setItems([...items, { load_id: '', species: '', grade: '', thickness: '4/4', estimated_footage: null, price: null }])
    
    // Fetch next available load ID for the new item
    try {
      const response = await fetch('/api/lumber/load-id-ranges/next-available?count=1')
      if (response.ok) {
        const data = await response.json()
        if (data.loadIds && data.loadIds.length > 0) {
          // Update the newly added item with the load ID
          setItems(prevItems => {
            const updated = [...prevItems]
            updated[newIndex] = { ...updated[newIndex], load_id: data.loadIds[0] }
            return updated
          })
        }
      }
    } catch (error) {
      console.error('Error fetching next load ID:', error)
    }
  }

  async function handleCopyItem(index: number) {
    const itemToCopy = items[index]
    const newIndex = items.length
    
    // Create a copy without the load_id
    const copiedItem = {
      load_id: '',
      species: itemToCopy.species,
      grade: itemToCopy.grade,
      thickness: itemToCopy.thickness,
      estimated_footage: itemToCopy.estimated_footage,
      price: itemToCopy.price
    }
    
    setItems([...items, copiedItem])
    
    // Fetch next available load ID for the copied item
    try {
      const response = await fetch('/api/lumber/load-id-ranges/next-available?count=1')
      if (response.ok) {
        const data = await response.json()
        if (data.loadIds && data.loadIds.length > 0) {
          setItems(prevItems => {
            const updated = [...prevItems]
            updated[newIndex] = { ...updated[newIndex], load_id: data.loadIds[0] }
            return updated
          })
        }
      }
    } catch (error) {
      console.error('Error fetching next load ID:', error)
    }
  }

  function handleRemoveItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  function handleItemChange(index: number, field: keyof (CreateLoadItemInput & { load_id: string }), value: any) {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  async function loadPreset(preset: LumberLoadPreset) {
    // Fill shared fields
    setSupplierId(preset.supplier_id)
    setSupplierLocationId(preset.supplier_location_id)
    setLumberType(preset.lumber_type || 'dried')
    setPickupOrDelivery(preset.pickup_or_delivery || '')
    setComments(preset.comments || '')

    // Parse items if they come as a string (PostgreSQL JSON column)
    let presetItems = preset.items
    if (typeof preset.items === 'string') {
      try {
        presetItems = JSON.parse(preset.items)
      } catch (e) {
        console.error('Error parsing preset items:', e)
        toast.error('Failed to parse preset items')
        return
      }
    }

    // Ensure items is an array
    if (!Array.isArray(presetItems) || presetItems.length === 0) {
      toast.error('This preset has no items')
      return
    }

    // Fetch load IDs for all items
    try {
      const response = await fetch(`/api/lumber/load-id-ranges/next-available?count=${presetItems.length}`)
      if (response.ok) {
        const data = await response.json()
        if (data.loadIds && data.loadIds.length >= presetItems.length) {
          // Map preset items to form items with load IDs
          const newItems = presetItems.map((presetItem: any, index: number) => ({
            load_id: data.loadIds[index],
            species: presetItem.species,
            grade: presetItem.grade,
            thickness: presetItem.thickness,
            estimated_footage: presetItem.estimated_footage,
            price: presetItem.price
          }))
          setItems(newItems)
          toast.success(`Loaded preset: ${preset.preset_name} (${presetItems.length} items)`)
        } else {
          toast.error('Not enough available load IDs for this preset')
        }
      } else {
        const errorData = await response.json()
        if (response.status === 404) {
          toast.error('No Load ID range configured. Please set one up in Lumber Admin.')
        } else {
          toast.error(errorData.error || 'Failed to get load IDs')
        }
        console.error('Load ID API error:', errorData)
      }
    } catch (error) {
      console.error('Error loading preset:', error)
      toast.error('Failed to load preset. Check console for details.')
    }
  }

  async function togglePresetFavorite(presetId: number) {
    try {
      const response = await fetch(`/api/lumber/presets/${presetId}/toggle-favorite`, {
        method: 'POST'
      })
      if (response.ok) {
        // Refresh presets
        const presetsRes = await fetch('/api/lumber/presets')
        if (presetsRes.ok) setPresets(await presetsRes.json())
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  async function saveAsPreset() {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name')
      return
    }

    if (!supplierId) {
      toast.error('Please select a supplier before saving preset')
      return
    }

    if (items.length === 0 || !items.every(item => item.species && item.grade && item.thickness && item.price)) {
      toast.error('Please complete all item details (including price) before saving preset')
      return
    }

    try {
      const response = await fetch('/api/lumber/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset_name: presetName,
          supplier_id: supplierId,
          supplier_location_id: supplierLocationId,
          lumber_type: lumberType,
          pickup_or_delivery: pickupOrDelivery,
          comments: comments,
          items: items.map(({ load_id, ...rest }) => rest) // Remove load_id from items
        })
      })

      if (response.ok) {
        toast.success('Preset saved successfully')
        setSavePresetDialogOpen(false)
        setPresetName('')
        // Refresh presets
        const presetsRes = await fetch('/api/lumber/presets')
        if (presetsRes.ok) setPresets(await presetsRes.json())
      } else {
        toast.error('Failed to save preset')
      }
    } catch (error) {
      console.error('Error saving preset:', error)
      toast.error('Failed to save preset')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    console.log('Submitting with items:', items)
    
    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }

    // Check if all items have Load IDs (should be auto-assigned)
    const missingLoadIds = items.filter(item => !item.load_id)
    if (missingLoadIds.length > 0) {
      toast.error('Some items are missing Load IDs. Please refresh the page and try again.')
      console.error('Items missing Load IDs:', missingLoadIds)
      return
    }

    // Check if all required fields are filled
    const invalidItems = items.filter(item => !item.species || !item.grade || !item.thickness || !item.price)
    if (invalidItems.length > 0) {
      toast.error('Please fill in species, grade, thickness, and price for all items')
      console.error('Invalid items:', invalidItems)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/lumber/loads/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shared_fields: {
            supplier_id: supplierId,
            supplier_location_id: supplierLocationId,
            lumber_type: lumberType || null,
            pickup_or_delivery: pickupOrDelivery || null,
            estimated_delivery_date: estimatedDeliveryDate || null,
            comments: comments || null
          },
          items
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`${result.created} load(s) created successfully`)
        router.push('/dashboard/lumber/incoming')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to create loads')
      }
    } catch (error) {
      console.error('Error creating loads:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const favoritePresets = presets.filter(p => p.is_favorite)
  const groupedPresets = presets.reduce((acc, preset) => {
    const key = preset.supplier_name || 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(preset)
    return acc
  }, {} as Record<string, LumberLoadPreset[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Load</h1>
            <p className="text-gray-600 mt-1">Enter load details and estimated information</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSavePresetDialogOpen(true)}
        >
          <Save className="h-4 w-4 mr-2" />
          Save as Preset
        </Button>
      </div>

      {/* Two Column Layout: Form on left, Presets on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form - Takes up 2 columns */}
        <div className="lg:col-span-2">

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Shared Information (applies to all items) */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Shared Information</h2>
          <p className="text-sm text-gray-600 mb-4">
            These details will apply to all load items below. Each item will get its own unique Load ID.
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supplier">Supplier *</Label>
            <Select value={supplierId?.toString() || ''} onValueChange={(val) => setSupplierId(parseInt(val))}>
              <SelectTrigger>
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

          {selectedSupplier && selectedSupplier.locations.length > 0 && (
            <div>
              <Label htmlFor="location">Supplier Location</Label>
              <Select 
                value={supplierLocationId?.toString() || ''} 
                onValueChange={(val) => setSupplierLocationId(val ? parseInt(val) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {selectedSupplier.locations.map(location => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.location_name} {location.phone_number_1 && `- ${location.phone_number_1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="lumberType">Lumber Type</Label>
            <Select value={lumberType} onValueChange={setLumberType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {LUMBER_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pickupOrDelivery">Pickup or Delivery</Label>
            <Select value={pickupOrDelivery} onValueChange={setPickupOrDelivery}>
              <SelectTrigger>
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                {PICKUP_OR_DELIVERY_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="estimatedDeliveryDate">Estimated Delivery Date</Label>
            <Input
              id="estimatedDeliveryDate"
              type="date"
              value={estimatedDeliveryDate}
              onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="comments">Comments</Label>
          <Textarea
            id="comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Additional notes or comments..."
            rows={3}
          />
        </div>

        {/* Load Items */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Load Items (Species/Grade/Thickness)</h3>
            <Button type="button" onClick={handleAddItem} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-7 gap-3 items-end p-4 border rounded-lg bg-gray-50">
                <div>
                  <Label>Load ID</Label>
                  <Input
                    value={item.load_id}
                    placeholder="Auto-assigned..."
                    readOnly
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>
                
                <div>
                  <Label>Species *</Label>
                  <Select 
                    value={item.species} 
                    onValueChange={(val) => handleItemChange(index, 'species', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select species" />
                    </SelectTrigger>
                    <SelectContent>
                      {species.map(sp => (
                        <SelectItem key={sp.id} value={sp.name}>
                          {sp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Grade *</Label>
                  <Select 
                    value={item.grade} 
                    onValueChange={(val) => handleItemChange(index, 'grade', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map(grade => (
                        <SelectItem key={grade.id} value={grade.name}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Thickness *</Label>
                  <Select 
                    value={item.thickness} 
                    onValueChange={(val) => handleItemChange(index, 'thickness', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THICKNESSES.map(thickness => (
                        <SelectItem key={thickness} value={thickness}>
                          {thickness}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Est. Footage</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.estimated_footage || ''}
                    onChange={(e) => handleItemChange(index, 'estimated_footage', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="12000"
                  />
                </div>

                <div>
                  <Label>Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.price || ''}
                    onChange={(e) => handleItemChange(index, 'price', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyItem(index)}
                    title="Copy this item"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                    title="Remove this item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Load'}
          </Button>
        </div>
      </form>
        </div>

        {/* Presets Sidebar - Takes up 1 column */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sticky top-6 max-h-[calc(100vh-100px)] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Load Presets</h2>
            
            <div className="space-y-6">
              {/* Favorites Section */}
              {favoritePresets.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-700">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    Favorites
                  </h3>
                  <div className="space-y-2">
                    {favoritePresets.map(preset => (
                      <Card key={preset.id} className="cursor-pointer hover:bg-gray-50 transition-colors border-yellow-200">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0" onClick={() => loadPreset(preset)}>
                              <h4 className="font-medium text-sm truncate">{preset.preset_name}</h4>
                              <p className="text-xs text-gray-600 truncate">{preset.supplier_name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {preset.items.length} item(s)
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePresetFavorite(preset.id)
                              }}
                            >
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped by Supplier */}
              {Object.entries(groupedPresets).map(([supplierName, supplierPresets]) => (
                <div key={supplierName}>
                  <h3 className="text-sm font-semibold mb-2 text-gray-700">{supplierName}</h3>
                  <div className="space-y-2">
                    {supplierPresets.map(preset => (
                      <Card key={preset.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0" onClick={() => loadPreset(preset)}>
                              <h4 className="font-medium text-sm truncate">{preset.preset_name}</h4>
                              {preset.supplier_location_name && (
                                <p className="text-xs text-gray-500 truncate">{preset.supplier_location_name}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {preset.items.length} item(s) - {preset.lumber_type || 'N/A'}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePresetFavorite(preset.id)
                              }}
                            >
                              <Star className={`h-3 w-3 ${preset.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}

              {presets.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No presets saved yet. Create a load and save it as a preset.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Preset Dialog */}
      <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Preset</DialogTitle>
            <DialogDescription>
              Save the current form configuration as a preset for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="preset-name">Preset Name *</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., Cherry 4/4 & 5/4 Mix"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSavePresetDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAsPreset}>Save Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
