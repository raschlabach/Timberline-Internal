'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LumberSupplierWithLocations, CreateLoadItemInput, Thickness } from '@/types/lumber'
import { Plus, Trash2, Copy, ArrowLeft, TrendingUp, AlertTriangle, X, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const THICKNESSES: Thickness[] = ['4/4', '5/4', '6/4', '7/4', '8/4']
const LUMBER_TYPES = ['dried', 'green']
const PICKUP_OR_DELIVERY_OPTIONS = ['pickup', 'delivery']

const TIME_RANGE_OPTIONS = [
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: '2y', label: '2 Years' },
  { value: '5y', label: '5 Years' }
]

interface PriceTrend {
  species: string
  grade: string
  monthly_data: {
    month: string
    month_display: string
    avg_price: number | null
    load_count: number
  }[]
  overall_avg_price: number | null
}

interface SupplierQuality {
  supplier_id: number
  supplier_name: string
  species: string
  grade: string
  overall_avg_quality: number
  total_loads: number
  recent_3_avg_quality: number
  is_dismissed: boolean
  is_warning: boolean
}

export default function CreateLoadPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  
  const [suppliers, setSuppliers] = useState<LumberSupplierWithLocations[]>([])
  const [species, setSpecies] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Analytics data
  const [priceTrends, setPriceTrends] = useState<PriceTrend[]>([])
  const [supplierQuality, setSupplierQuality] = useState<SupplierQuality[]>([])
  const [selectedPriceTrends, setSelectedPriceTrends] = useState<Set<string>>(new Set())
  const [expandedQuality, setExpandedQuality] = useState<Set<string>>(new Set())
  const [timeRange, setTimeRange] = useState('1y')
  const [isSavingSelections, setIsSavingSelections] = useState(false)
  
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

  // Fetch price trends when time range changes
  const fetchPriceTrends = useCallback(async (range: string) => {
    try {
      const response = await fetch(`/api/lumber/analytics/price-trends?range=${range}`)
      if (response.ok) {
        setPriceTrends(await response.json())
      }
    } catch (error) {
      console.error('Error fetching price trends:', error)
    }
  }, [])

  useEffect(() => {
    async function fetchData() {
      try {
        const [suppliersRes, speciesRes, gradesRes, qualityRes, savedSelectionsRes] = await Promise.all([
          fetch('/api/lumber/suppliers'),
          fetch('/api/lumber/species'),
          fetch('/api/lumber/grades'),
          fetch('/api/lumber/analytics/supplier-quality'),
          fetch('/api/lumber/analytics/user-trend-selections')
        ])
        
        if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
        if (speciesRes.ok) setSpecies(await speciesRes.json())
        if (gradesRes.ok) setGrades(await gradesRes.json())
        if (qualityRes.ok) setSupplierQuality(await qualityRes.json())
        
        // Load saved selections
        if (savedSelectionsRes.ok) {
          const savedSelections = await savedSelectionsRes.json()
          const selectionSet = new Set<string>(
            savedSelections.map((s: { species: string; grade: string }) => `${s.species}|${s.grade}`)
          )
          setSelectedPriceTrends(selectionSet)
        }

        // Fetch price trends with default time range
        await fetchPriceTrends(timeRange)

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
  }, [status, fetchPriceTrends])

  // Refetch price trends when time range changes
  useEffect(() => {
    if (status === 'authenticated') {
      fetchPriceTrends(timeRange)
    }
  }, [timeRange, status, fetchPriceTrends])

  async function handleAddItem() {
    const newIndex = items.length
    // Get currently assigned IDs to exclude from the search
    const existingIds = items.map(item => item.load_id).filter(Boolean)
    
    setItems([...items, { load_id: '', species: '', grade: '', thickness: '4/4', estimated_footage: null, price: null }])
    
    // Fetch next available load ID for the new item, excluding already assigned IDs
    try {
      const excludeParam = existingIds.length > 0 ? `&exclude=${existingIds.join(',')}` : ''
      const response = await fetch(`/api/lumber/load-id-ranges/next-available?count=1${excludeParam}`)
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
    // Get currently assigned IDs to exclude from the search
    const existingIds = items.map(item => item.load_id).filter(Boolean)
    
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
    
    // Fetch next available load ID for the copied item, excluding already assigned IDs
    try {
      const excludeParam = existingIds.length > 0 ? `&exclude=${existingIds.join(',')}` : ''
      const response = await fetch(`/api/lumber/load-id-ranges/next-available?count=1${excludeParam}`)
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

  async function dismissWarning(supplierId: number, species: string, grade: string) {
    try {
      const response = await fetch('/api/lumber/analytics/dismissed-warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: supplierId, species, grade })
      })
      
      if (response.ok) {
        // Update local state
        setSupplierQuality(prev => prev.map(sq => 
          sq.supplier_id === supplierId && sq.species === species && sq.grade === grade
            ? { ...sq, is_dismissed: true }
            : sq
        ))
        toast.success('Warning dismissed')
      }
    } catch (error) {
      console.error('Error dismissing warning:', error)
      toast.error('Failed to dismiss warning')
    }
  }

  async function togglePriceTrendSelection(key: string) {
    const next = new Set(selectedPriceTrends)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setSelectedPriceTrends(next)
    
    // Save to database
    setIsSavingSelections(true)
    try {
      const selections = Array.from(next).map(k => {
        const [species, grade] = k.split('|')
        return { species, grade }
      })
      await fetch('/api/lumber/analytics/user-trend-selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections })
      })
    } catch (error) {
      console.error('Error saving selections:', error)
    } finally {
      setIsSavingSelections(false)
    }
  }

  function toggleQualityExpand(key: string) {
    setExpandedQuality(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
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

  // Colors for chart lines
  const CHART_COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', 
    '#0891b2', '#be185d', '#4f46e5', '#ea580c', '#65a30d'
  ]

  // Create a map of species/grade to color - MUST be before any conditional returns
  const trendColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    priceTrends.forEach((trend, idx) => {
      const key = `${trend.species}|${trend.grade}`
      map[key] = CHART_COLORS[idx % CHART_COLORS.length]
    })
    return map
  }, [priceTrends])

  // Prepare chart data from selected trends - MUST be before any conditional returns
  const chartData = useMemo(() => {
    if (selectedPriceTrends.size === 0 || priceTrends.length === 0) return []
    
    // Get all months from the first trend (they should all have the same months)
    const selectedTrends = priceTrends.filter(t => selectedPriceTrends.has(`${t.species}|${t.grade}`))
    if (selectedTrends.length === 0) return []
    
    const months = selectedTrends[0].monthly_data.map(m => m.month_display)
    
    return months.map((month, idx) => {
      const dataPoint: Record<string, any> = { month }
      selectedTrends.forEach(trend => {
        const key = `${trend.species} ${trend.grade}`
        dataPoint[key] = trend.monthly_data[idx]?.avg_price || null
      })
      return dataPoint
    })
  }, [priceTrends, selectedPriceTrends])

  // Group price trends by species for the selection list - MUST be before any conditional returns
  const groupedPriceTrends = useMemo(() => {
    return priceTrends.reduce((acc, trend) => {
      if (!acc[trend.species]) acc[trend.species] = []
      acc[trend.species].push(trend)
      return acc
    }, {} as Record<string, PriceTrend[]>)
  }, [priceTrends])

  // Group supplier quality by species/grade - MUST be before any conditional returns
  const groupedQuality = useMemo(() => {
    return supplierQuality.reduce((acc, sq) => {
      const key = `${sq.species}|${sq.grade}`
      if (!acc[key]) acc[key] = []
      acc[key].push(sq)
      return acc
    }, {} as Record<string, SupplierQuality[]>)
  }, [supplierQuality])

  // Get active warnings (not dismissed, is_warning) - MUST be before any conditional returns
  const activeWarnings = useMemo(() => {
    return supplierQuality.filter(sq => sq.is_warning && !sq.is_dismissed)
  }, [supplierQuality])

  // Loading state - AFTER all hooks
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

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
      </div>

      {/* Two Column Layout: Form on left, Supplier Quality on right */}
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
                    step="0.001"
                    value={item.price || ''}
                    onChange={(e) => handleItemChange(index, 'price', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0.000"
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

        {/* Sidebar - Supplier Quality & Warnings */}
        <div className="lg:col-span-1 space-y-4">
          {/* Quality Warnings Section */}
          {activeWarnings.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                Quality Warnings
              </h2>
              <p className="text-xs text-red-600 mb-3">
                Suppliers with average quality under 50
              </p>
              <div className="space-y-2">
                {activeWarnings.map((warning, idx) => (
                  <div key={idx} className="bg-white rounded p-3 border border-red-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{warning.supplier_name}</div>
                        <div className="text-xs text-gray-600">{warning.species} - {warning.grade}</div>
                        <div className="flex gap-4 mt-1 text-xs">
                          <span className={warning.overall_avg_quality < 50 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            Avg: {warning.overall_avg_quality}
                          </span>
                          <span className={warning.recent_3_avg_quality < 50 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            Recent 3: {warning.recent_3_avg_quality}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        onClick={() => dismissWarning(warning.supplier_id, warning.species, warning.grade)}
                        title="Dismiss warning"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supplier Quality Section */}
          <div className="bg-white rounded-lg shadow p-4 sticky top-6 max-h-[calc(100vh-100px)] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-3">Supplier Quality by Grade</h2>
            <div className="space-y-2">
              {Object.entries(groupedQuality).map(([key, suppliers]) => {
                const [speciesName, gradeName] = key.split('|')
                return (
                  <div key={key} className="border rounded">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left font-medium text-sm bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
                      onClick={() => toggleQualityExpand(key)}
                    >
                      <span>{speciesName} - {gradeName}</span>
                      {expandedQuality.has(key) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {expandedQuality.has(key) && (
                      <div className="p-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1">Supplier</th>
                              <th className="text-right py-1">Avg</th>
                              <th className="text-right py-1">Recent 3</th>
                              <th className="text-right py-1">Loads</th>
                            </tr>
                          </thead>
                          <tbody>
                            {suppliers.filter(s => !s.is_dismissed || !s.is_warning).map((sq, idx) => (
                              <tr 
                                key={idx} 
                                className={sq.is_warning && !sq.is_dismissed ? 'bg-red-50' : ''}
                              >
                                <td className="py-1 font-medium">{sq.supplier_name}</td>
                                <td className={`text-right py-1 ${sq.overall_avg_quality < 50 ? 'text-red-600 font-medium' : ''}`}>
                                  {sq.overall_avg_quality}
                                </td>
                                <td className={`text-right py-1 ${sq.recent_3_avg_quality < 50 ? 'text-red-600 font-medium' : ''}`}>
                                  {sq.recent_3_avg_quality || '-'}
                                </td>
                                <td className="text-right py-1 text-gray-500">{sq.total_loads}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
              
              {Object.keys(groupedQuality).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No quality data available yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Price Trends Section - Full Width Below Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Price Trends
          </h2>
          <div className="flex items-center gap-2">
            {isSavingSelections && (
              <span className="text-xs text-gray-400">Saving...</span>
            )}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chart - Takes up 3 columns */}
          <div className="lg:col-span-3">
            {selectedPriceTrends.size > 0 && chartData.length > 0 ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      tickFormatter={(value) => value != null ? `$${Number(value).toFixed(2)}` : ''}
                      domain={['auto', 'auto']}
                      width={60}
                    />
                    <Tooltip 
                      formatter={(value) => value != null ? `$${Number(value).toFixed(3)}` : 'N/A'}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    {priceTrends
                      .filter(t => selectedPriceTrends.has(`${t.species}|${t.grade}`))
                      .map((trend) => {
                        const key = `${trend.species}|${trend.grade}`
                        const displayKey = `${trend.species} ${trend.grade}`
                        return (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={displayKey}
                            stroke={trendColorMap[key]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        )
                      })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center bg-gray-50 rounded text-gray-500">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Select species/grade combinations to view price trends</p>
                </div>
              </div>
            )}
          </div>

          {/* Selection Panel - Takes up 1 column */}
          <div className="lg:col-span-1">
            <div className="border rounded-lg p-4 h-96 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 mb-3">Select to display on chart:</p>
              <div className="space-y-2">
                {Object.entries(groupedPriceTrends).map(([speciesName, trends]) => (
                  <div key={speciesName} className="space-y-1">
                    <div className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded">
                      {speciesName}
                    </div>
                    {trends.map((trend) => {
                      const key = `${trend.species}|${trend.grade}`
                      const isSelected = selectedPriceTrends.has(key)
                      return (
                        <label 
                          key={key}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer rounded text-sm"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => togglePriceTrendSelection(key)}
                          />
                          <span 
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: trendColorMap[key] }}
                          />
                          <span className="flex-1 font-medium">{trend.grade}</span>
                          <span className="text-gray-500">
                            ${trend.overall_avg_price != null ? Number(trend.overall_avg_price).toFixed(3) : '-'}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
              
              {priceTrends.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No price data available yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
