'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Truck,
  CheckCircle2,
  Package,
  Loader2,
  Search,
  LinkIcon,
  Pencil,
  Clock,
  TreePine,
  Hash,
  MapPin,
  MessageSquare,
} from 'lucide-react'
import { RnrLumberPickupMap } from './pickup-map'

interface LumberLoadItem {
  id: number
  species: string
  grade: string
  thickness: string
  estimated_footage: number | null
  actual_footage: number | null
}

interface LumberPickupLoad {
  id: number
  load_id: string
  supplier_id: number
  supplier_name: string
  pickup_number: string | null
  pickup_or_delivery: string
  estimated_delivery_date: string | null
  actual_arrival_date: string | null
  pickup_date: string | null
  comments: string | null
  created_at: string
  timberline_order_id: number | null
  matched_customer_id: number | null
  matched_customer_name: string | null
  customer_lat: number | null
  customer_lng: number | null
  plant: string | null
  plant_id: number | null
  plant_name: string | null
  supplier_address: string | null
  supplier_city: string | null
  supplier_state: string | null
  supplier_zip: string | null
  items: LumberLoadItem[]
  total_estimated_footage: number
  total_actual_footage: number
  has_actual_footage: boolean
  timberline_order_status: string | null
  is_assigned_to_truck: boolean
  is_past: boolean
  is_ready: boolean
  customer_matched: boolean
}

interface Customer {
  id: number
  customer_name: string
}

interface Truckload {
  id: number
  driverName: string
  driverColor: string
  trailerNumber: string
  startDate: string
  endDate: string
  description: string | null
}

interface LoadTypes {
  ohioToIndiana: boolean
  backhaul: boolean
  localFlatbed: boolean
  rrOrder: boolean
  localSemi: boolean
  middlefield: boolean
  paNy: boolean
}

const DEFAULT_LOAD_TYPES: LoadTypes = {
  ohioToIndiana: false,
  backhaul: false,
  localFlatbed: false,
  rrOrder: true,
  localSemi: false,
  middlefield: false,
  paNy: false,
}

const LOAD_TYPE_OPTIONS: { key: keyof LoadTypes; label: string }[] = [
  { key: 'ohioToIndiana', label: 'OH → IN' },
  { key: 'backhaul', label: 'Backhaul' },
  { key: 'localFlatbed', label: 'Local Flatbed' },
  { key: 'rrOrder', label: 'RNR' },
  { key: 'localSemi', label: 'Local Semi' },
  { key: 'middlefield', label: 'Middlefield' },
  { key: 'paNy', label: 'PA/NY' },
]

export function RnrLumberPickups() {
  const [loads, setLoads] = useState<LumberPickupLoad[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [selectedLoads, setSelectedLoads] = useState<Set<number>>(new Set())
  const [showMapPast, setShowMapPast] = useState(false)

  const [truckloads, setTruckloads] = useState<Truckload[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmAssignToTruck, setConfirmAssignToTruck] = useState(false)
  const [loadTypes, setLoadTypes] = useState<LoadTypes>({ ...DEFAULT_LOAD_TYPES })

  const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false)
  const [matchingSupplierId, setMatchingSupplierId] = useState<number | null>(null)
  const [matchingSupplierName, setMatchingSupplierName] = useState<string>('')
  const [matchingPlantId, setMatchingPlantId] = useState<number | null>(null)
  const [matchingPlantName, setMatchingPlantName] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

  const fetchLoads = useCallback(async () => {
    try {
      const res = await fetch('/api/rnr-lumber-pickups')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      if (data.success) {
        setLoads(data.loads)
      }
    } catch {
      toast.error('Failed to load lumber pickups')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchTruckloads = useCallback(async () => {
    try {
      const res = await fetch('/api/truckloads?activeOnly=true')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      if (data.success) {
        setTruckloads(data.truckloads || [])
      }
    } catch {
      toast.error('Failed to load truckloads')
    }
  }, [])

  useEffect(() => {
    fetchLoads()
    fetchTruckloads()
  }, [fetchLoads, fetchTruckloads])

  const activeLoads = loads
    .filter(l => !l.is_past)
    .sort((a, b) => {
      if (a.is_ready && !b.is_ready) return -1
      if (!a.is_ready && b.is_ready) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const pastLoads = loads.filter(l => l.is_past)

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const selectableIds = activeLoads
        .filter(l => l.customer_matched)
        .map(l => l.id)
      setSelectedLoads(new Set(selectableIds))
    } else {
      setSelectedLoads(new Set())
    }
  }

  function handleSelectLoad(loadId: number, checked: boolean) {
    const next = new Set(selectedLoads)
    if (checked) {
      next.add(loadId)
    } else {
      next.delete(loadId)
    }
    setSelectedLoads(next)
  }

  function openConfirmDialog(assignToTruck: boolean) {
    if (selectedLoads.size === 0) {
      toast.error('No loads selected')
      return
    }
    if (assignToTruck && !selectedTruckloadId) {
      toast.error('Please select a truckload')
      return
    }
    setConfirmAssignToTruck(assignToTruck)
    setLoadTypes({ ...DEFAULT_LOAD_TYPES })
    setIsConfirmDialogOpen(true)
  }

  async function handleConvert() {
    setIsConverting(true)
    setIsConfirmDialogOpen(false)
    try {
      const payload: Record<string, unknown> = {
        loadIds: Array.from(selectedLoads),
        loadTypes,
      }
      if (confirmAssignToTruck) {
        payload.truckloadId = parseInt(selectedTruckloadId)
      }

      const res = await fetch('/api/rnr-lumber-pickups/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to convert')

      toast.success(data.message)
      setSelectedLoads(new Set())
      setSelectedTruckloadId('')
      await fetchLoads()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to convert loads')
    } finally {
      setIsConverting(false)
    }
  }

  async function openMatchDialog(supplierId: number, supplierName: string, plantId?: number | null, plantName?: string | null) {
    setMatchingSupplierId(supplierId)
    setMatchingSupplierName(supplierName)
    setMatchingPlantId(plantId ?? null)
    setMatchingPlantName(plantName ?? null)
    setIsMatchDialogOpen(true)
    setCustomerSearch('')

    if (customers.length === 0) {
      setIsLoadingCustomers(true)
      try {
        const res = await fetch('/api/customers')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setCustomers(data)
      } catch {
        toast.error('Failed to load customers')
      } finally {
        setIsLoadingCustomers(false)
      }
    }
  }

  async function handleMatchCustomer(customerId: number) {
    if (!matchingSupplierId) return

    try {
      const res = await fetch('/api/rnr-lumber-pickups/match-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: matchingSupplierId,
          customerId,
          plantId: matchingPlantId,
        }),
      })

      if (!res.ok) throw new Error('Failed to match')
      toast.success(matchingPlantName ? `Customer linked to ${matchingPlantName}` : 'Customer linked to supplier')
      setIsMatchDialogOpen(false)
      await fetchLoads()
    } catch {
      toast.error('Failed to match customer')
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.customer_name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading lumber pickups...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RNR Lumber Pickups</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lumber loads from the RNR system that need to be picked up and entered as Timberline orders
          </p>
        </div>
      </div>

      {/* Action Bar */}
      {activeLoads.length > 0 && activeTab === 'active' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4 text-blue-600" />
                <span>{selectedLoads.size} of {activeLoads.length} loads selected</span>
              </div>

              <Button
                variant="outline"
                onClick={() => openConfirmDialog(false)}
                disabled={selectedLoads.size === 0 || isConverting}
                className="gap-1.5"
              >
                {isConverting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                Create Orders
              </Button>

              <div className="h-6 w-px bg-gray-300" />

              <Select value={selectedTruckloadId} onValueChange={setSelectedTruckloadId}>
                <SelectTrigger className="w-[280px] bg-white">
                  <SelectValue placeholder="Select a truckload..." />
                </SelectTrigger>
                <SelectContent>
                  {truckloads.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.driverColor }}
                        />
                        <span>{t.driverName}</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500">#{t.trailerNumber}</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500 text-xs">
                          {format(new Date(t.startDate + 'T00:00:00'), 'M/d')}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => openConfirmDialog(true)}
                disabled={selectedLoads.size === 0 || !selectedTruckloadId || isConverting}
                className="gap-1.5"
              >
                {isConverting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
                Create & Assign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="flex gap-2 text-xs">
        <Badge variant="outline" className="gap-1">
          <TreePine className="h-3 w-3 text-emerald-500" />
          {activeLoads.length} active
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Hash className="h-3 w-3 text-orange-500" />
          {activeLoads.filter(l => l.is_ready).length} ready for pickup
        </Badge>
        <Badge variant="outline" className="gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {pastLoads.length} past
        </Badge>
        <Badge variant="outline" className="gap-1">
          <LinkIcon className="h-3 w-3 text-red-500" />
          {activeLoads.filter(l => !l.customer_matched).length} unmatched
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedLoads(new Set()) }}>
        <TabsList className="mb-4">
          <TabsTrigger value="active" className="gap-1.5">
            <TreePine className="h-4 w-4" />
            Active ({activeLoads.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Past ({pastLoads.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <PickupTable
            loads={activeLoads}
            isActive
            selectedLoads={selectedLoads}
            onSelectAll={handleSelectAll}
            onSelectLoad={handleSelectLoad}
            onMatchCustomer={openMatchDialog}
          />
        </TabsContent>

        <TabsContent value="past">
          <PickupTable
            loads={pastLoads}
            isActive={false}
            selectedLoads={new Set()}
            onSelectAll={() => {}}
            onSelectLoad={() => {}}
            onMatchCustomer={openMatchDialog}
          />
        </TabsContent>
      </Tabs>

      {/* Map */}
      {loads.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <MapPin className="h-4 w-4" />
              Pickup Locations
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <Checkbox
                checked={showMapPast}
                onCheckedChange={(checked) => setShowMapPast(checked as boolean)}
                className="h-3.5 w-3.5"
              />
              Show past loads
            </label>
          </div>
          <div className="h-[400px]">
            <RnrLumberPickupMap loads={loads} showPast={showMapPast} />
          </div>
        </Card>
      )}

      {/* Customer Match Dialog */}
      <Dialog open={isMatchDialogOpen} onOpenChange={setIsMatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Supplier to Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              RNR Supplier: <span className="font-medium text-gray-900">{matchingSupplierName}</span>
              {matchingPlantName && (
                <span className="ml-1 text-blue-600">({matchingPlantName})</span>
              )}
            </p>
            <p className="text-xs text-gray-400">
              {matchingPlantName
                ? `This mapping will apply to loads from ${matchingSupplierName} at the ${matchingPlantName} plant.`
                : 'This mapping will be the default for all loads from this supplier without a plant-specific mapping.'}
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              {isLoadingCustomers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  No customers found
                </div>
              ) : (
                filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 transition-colors"
                    onClick={() => handleMatchCustomer(c.id)}
                  >
                    {c.customer_name}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Create Orders Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Creating <span className="font-medium text-gray-900">{selectedLoads.size}</span> order{selectedLoads.size !== 1 ? 's' : ''} from lumber pickup loads
              {confirmAssignToTruck && ' and assigning to truckload'}
            </p>
            <p className="text-xs text-gray-400">
              Delivery customer will be set to RNR Enterprises for all orders.
            </p>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Load Type</p>
              <div className="flex flex-wrap gap-2">
                {LOAD_TYPE_OPTIONS.map(opt => (
                  <label
                    key={opt.key}
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors
                      ${loadTypes[opt.key]
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }
                    `}
                  >
                    <Checkbox
                      checked={loadTypes[opt.key]}
                      onCheckedChange={(checked) =>
                        setLoadTypes(prev => ({ ...prev, [opt.key]: checked as boolean }))
                      }
                      className="h-3.5 w-3.5"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsConfirmDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConvert} disabled={isConverting} className="gap-1.5">
                {isConverting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : confirmAssignToTruck ? (
                  <Truck className="h-3.5 w-3.5" />
                ) : (
                  <Package className="h-3.5 w-3.5" />
                )}
                {confirmAssignToTruck ? 'Create & Assign' : 'Create Orders'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface PickupTableProps {
  loads: LumberPickupLoad[]
  isActive: boolean
  selectedLoads: Set<number>
  onSelectAll: (checked: boolean) => void
  onSelectLoad: (loadId: number, checked: boolean) => void
  onMatchCustomer: (supplierId: number, supplierName: string, plantId?: number | null, plantName?: string | null) => void
}

function PickupTable({
  loads,
  isActive,
  selectedLoads,
  onSelectAll,
  onSelectLoad,
  onMatchCustomer,
}: PickupTableProps) {
  if (loads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <TreePine className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">
              {isActive ? 'No active lumber pickups' : 'No past lumber pickups'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {isActive
                ? 'Lumber loads marked as pickup in the RNR system will appear here automatically'
                : 'Loads move here once converted to orders or actual footage is entered'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectableLoads = loads.filter(l => l.customer_matched)
  const allSelected = selectableLoads.length > 0 && selectableLoads.every(l => selectedLoads.has(l.id))

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                {isActive && (
                  <th className="px-3 py-2.5 text-left w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={onSelectAll}
                    />
                  </th>
                )}
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-12">Status</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-28">Load ID</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500">Supplier (Pickup From)</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-28">Plant</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500">Matched Customer</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-28">Pickup #</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-500 w-10"></th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-28">Est. Footage</th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-28">Actual Footage</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-20">Species</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-32">Created</th>
                {!isActive && (
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-28">Order #</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loads.map(load => {
                const isSelectable = isActive && load.customer_matched
                const isSelected = selectedLoads.has(load.id)
                const isUnmatched = !load.customer_matched
                const isReady = load.is_ready

                const speciesList = Array.from(new Set(load.items.map(i => i.species))).join(', ')

                return (
                  <tr
                    key={load.id}
                    className={`border-b border-gray-100 transition-colors ${
                      isReady && isActive
                        ? 'bg-amber-50/70 hover:bg-amber-50'
                        : isUnmatched && isActive
                          ? 'bg-red-50/50'
                          : isSelected
                            ? 'bg-blue-50/50'
                            : load.is_past
                              ? 'bg-green-50/30 opacity-70'
                              : 'hover:bg-gray-50'
                    }`}
                  >
                    {isActive && (
                      <td className="px-3 py-2.5">
                        {isSelectable && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => onSelectLoad(load.id, checked as boolean)}
                          />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      {load.is_past ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : isReady ? (
                        <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0">
                          Ready
                        </Badge>
                      ) : isUnmatched ? (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
                      ) : (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-medium text-gray-900">
                      {load.load_id}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-red-700">
                      {load.supplier_name}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      {load.plant_name || load.plant || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {load.is_past ? (
                        <span className="text-green-700 text-xs">
                          {load.matched_customer_name || '—'}
                        </span>
                      ) : load.customer_matched ? (
                        <button
                          className="text-green-700 text-xs hover:bg-green-50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 group/cust"
                          onClick={() => onMatchCustomer(load.supplier_id, load.supplier_name, load.plant_id, load.plant_name)}
                          title="Click to change customer"
                        >
                          {load.matched_customer_name}
                          <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover/cust:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => onMatchCustomer(load.supplier_id, load.supplier_name, load.plant_id, load.plant_name)}
                        >
                          <LinkIcon className="h-3 w-3" />
                          Link Customer
                        </Button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {load.pickup_number ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 font-mono text-xs">
                          {load.pickup_number}
                        </Badge>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {load.comments ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <MessageSquare className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer inline-block" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] text-sm">
                              {load.comments}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                      {load.total_estimated_footage
                        ? Number(load.total_estimated_footage).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                      {load.total_actual_footage && Number(load.total_actual_footage) > 0
                        ? Number(load.total_actual_footage).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      {speciesList || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      {format(new Date(load.created_at), 'M/d/yyyy')}
                    </td>
                    {!isActive && (
                      <td className="px-3 py-2.5">
                        {load.timberline_order_id ? (
                          <Badge variant="outline" className="text-blue-600 border-blue-200 font-mono text-xs">
                            #{load.timberline_order_id}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
