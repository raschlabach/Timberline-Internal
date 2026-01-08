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
import { LumberSupplierWithLocations, CreateLoadItemInput, Thickness } from '@/types/lumber'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

const THICKNESSES: Thickness[] = ['4/4', '5/4', '6/4', '7/4', '8/4']
const LUMBER_TYPES = ['dried', 'green']
const PICKUP_OR_DELIVERY_OPTIONS = ['pickup', 'delivery']

export default function CreateLoadPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  
  const [suppliers, setSuppliers] = useState<LumberSupplierWithLocations[]>([])
  const [species, setSpecies] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Form state
  const [loadId, setLoadId] = useState('')
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [supplierLocationId, setSupplierLocationId] = useState<number | null>(null)
  const [lumberType, setLumberType] = useState<string>('')
  const [pickupOrDelivery, setPickupOrDelivery] = useState<string>('')
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('')
  const [comments, setComments] = useState('')
  const [items, setItems] = useState<CreateLoadItemInput[]>([
    { species: '', grade: '', thickness: '4/4', estimated_footage: null, price: null }
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
        const [suppliersRes, speciesRes, gradesRes] = await Promise.all([
          fetch('/api/lumber/suppliers'),
          fetch('/api/lumber/species'),
          fetch('/api/lumber/grades')
        ])
        
        if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
        if (speciesRes.ok) setSpecies(await speciesRes.json())
        if (gradesRes.ok) setGrades(await gradesRes.json())
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    if (status === 'authenticated') {
      fetchData()
    }
  }, [status])

  function handleAddItem() {
    setItems([...items, { species: '', grade: '', thickness: '4/4', estimated_footage: null, price: null }])
  }

  function handleRemoveItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  function handleItemChange(index: number, field: keyof CreateLoadItemInput, value: any) {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!loadId || !supplierId) {
      toast.error('Please fill in Load ID and Supplier')
      return
    }

    const hasValidItems = items.every(item => item.species && item.grade && item.thickness)
    if (!hasValidItems) {
      toast.error('Please fill in species, grade, and thickness for all items')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/lumber/loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: loadId,
          supplier_id: supplierId,
          supplier_location_id: supplierLocationId,
          lumber_type: lumberType || null,
          pickup_or_delivery: pickupOrDelivery || null,
          estimated_delivery_date: estimatedDeliveryDate || null,
          comments: comments || null,
          items
        })
      })

      if (response.ok) {
        toast.success(`Load ${loadId} has been created`)
        router.push('/dashboard/lumber/incoming')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to create load')
      }
    } catch (error) {
      console.error('Error creating load:', error)
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="loadId">Load ID *</Label>
            <Input
              id="loadId"
              value={loadId}
              onChange={(e) => setLoadId(e.target.value)}
              placeholder="e.g., R-4276"
              required
            />
          </div>

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
              <div key={index} className="grid grid-cols-6 gap-3 items-end p-4 border rounded-lg bg-gray-50">
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
                  <Label>Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.price || ''}
                    onChange={(e) => handleItemChange(index, 'price', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
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
  )
}
