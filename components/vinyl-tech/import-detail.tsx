'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  ArrowLeft,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Package,
  Loader2,
  Search,
  LinkIcon,
  Trash2,
  Pencil,
  Check,
  X,
  Download,
  FileText,
  List,
} from 'lucide-react'

interface ImportItem {
  id: number
  vt_code: string
  ship_to_name: string
  skid_16ft: number
  skid_12ft: number
  skid_4x8: number
  misc: number
  weight: number
  notes_on_skids: string
  additional_notes: string
  schedule_notes: string
  has_freight: boolean
  customer_matched: boolean
  matched_customer_id: number | null
  matched_customer_name: string | null
  freight_quote: number
  pickup_date: string | null
  pickup_driver: string | null
  status: string
  order_id: number | null
  truckload_id: number | null
  driver_name: string | null
  driver_color: string | null
  trailer_number: string | null
  truckload_start_date: string | null
  truckload_end_date: string | null
}

interface ImportData {
  id: number
  file_name: string
  week_label: string
  week_date: string | null
  sheet_status: string
  total_items: number
  items_with_freight: number
  total_weight: number
  status: string
  notes: string | null
  created_at: string
  created_by_name: string
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

interface Customer {
  id: number
  customer_name: string
}

interface Driver {
  id: number
  full_name: string
  color: string
}

interface ImportDetailProps {
  importId: number
  onBack: () => void
}

interface EditingState {
  itemId: number
  field: 'skid_16ft' | 'skid_12ft' | 'skid_4x8' | 'misc' | 'weight' | 'notes_on_skids' | 'freight_quote'
  value: string
}

export function ImportDetail({ importId, onBack }: ImportDetailProps) {
  const [importData, setImportData] = useState<ImportData | null>(null)
  const [items, setItems] = useState<ImportItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [truckloads, setTruckloads] = useState<Truckload[]>([])
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)
  const [showOnlyFreight, setShowOnlyFreight] = useState(true)
  const [viewMode, setViewMode] = useState<'edit' | 'summary'>('edit')

  // Inline editing state
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Drivers list for pickup driver dropdown
  const [drivers, setDrivers] = useState<Driver[]>([])

  // Customer matching dialog state
  const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false)
  const [matchingItemId, setMatchingItemId] = useState<number | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

  const fetchImport = useCallback(async () => {
    try {
      const res = await fetch(`/api/vinyl-tech/imports/${importId}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setImportData(data.import)
      setItems(data.items)
    } catch {
      toast.error('Failed to load import data')
    } finally {
      setIsLoading(false)
    }
  }, [importId])

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

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch('/api/drivers')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      if (data.success) {
        setDrivers(data.drivers || [])
      }
    } catch {
      // silent fail — driver list is non-critical
    }
  }, [])

  useEffect(() => {
    fetchImport()
    fetchTruckloads()
    fetchDrivers()
  }, [fetchImport, fetchTruckloads, fetchDrivers])

  const pendingFreightItems = items.filter(i => i.has_freight && i.status === 'pending')
  const convertedItems = items.filter(i => i.status === 'converted')
  const displayItems = showOnlyFreight ? items.filter(i => i.has_freight) : items

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const selectableIds = pendingFreightItems
        .filter(i => i.customer_matched)
        .map(i => i.id)
      setSelectedItems(new Set(selectableIds))
    } else {
      setSelectedItems(new Set())
    }
  }

  function handleSelectItem(itemId: number, checked: boolean) {
    const next = new Set(selectedItems)
    if (checked) {
      next.add(itemId)
    } else {
      next.delete(itemId)
    }
    setSelectedItems(next)
  }

  async function handleConvert(assignToTruck: boolean) {
    if (selectedItems.size === 0) {
      toast.error('No items selected')
      return
    }
    if (assignToTruck && !selectedTruckloadId) {
      toast.error('Please select a truckload')
      return
    }

    setIsConverting(true)
    try {
      const pickupDate = importData?.week_date || new Date().toISOString().split('T')[0]
      const payload: Record<string, unknown> = {
        itemIds: Array.from(selectedItems),
        pickupDate,
      }
      if (assignToTruck) {
        payload.truckloadId = parseInt(selectedTruckloadId)
      }

      const res = await fetch('/api/vinyl-tech/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to convert')

      toast.success(data.message)
      setSelectedItems(new Set())
      setSelectedTruckloadId('')
      await fetchImport()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to convert items')
    } finally {
      setIsConverting(false)
    }
  }

  async function openMatchDialog(itemId: number) {
    setMatchingItemId(itemId)
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
    if (!matchingItemId) return

    try {
      const res = await fetch('/api/vinyl-tech/match-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: matchingItemId, customerId }),
      })

      if (!res.ok) throw new Error('Failed to match')
      toast.success('Customer matched')
      setIsMatchDialogOpen(false)
      await fetchImport()
    } catch {
      toast.error('Failed to match customer')
    }
  }

  function startEditing(itemId: number, field: EditingState['field'], currentValue: number | string) {
    setEditing({ itemId, field, value: String(currentValue || '') })
  }

  async function saveEdit() {
    if (!editing) return

    const item = items.find(i => i.id === editing.itemId)
    if (!item) return

    setIsSaving(true)
    try {
      const isNumericField = editing.field !== 'notes_on_skids'
      const newValue = isNumericField
        ? (editing.field === 'freight_quote' ? parseFloat(editing.value) || 0 : parseInt(editing.value) || 0)
        : editing.value

      const updatedItem = {
        skid_16ft: item.skid_16ft,
        skid_12ft: item.skid_12ft,
        skid_4x8: item.skid_4x8,
        misc: item.misc,
        weight: item.weight,
        notes_on_skids: item.notes_on_skids,
        freight_quote: item.freight_quote,
        [editing.field]: newValue,
      }

      const res = await fetch(`/api/vinyl-tech/items/${editing.itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem),
      })

      if (!res.ok) throw new Error('Failed to save')

      // Update local state immediately
      setItems(prev => prev.map(i => {
        if (i.id !== editing.itemId) return i
        const updated = { ...i, [editing.field]: newValue }
        const hasFreight = (updated.skid_16ft || 0) + (updated.skid_12ft || 0) + (updated.skid_4x8 || 0) + (updated.misc || 0) > 0
        let newStatus = i.status
        if (!hasFreight) {
          newStatus = 'skipped'
        } else if (hasFreight && i.status === 'skipped') {
          newStatus = 'pending'
        }
        return { ...updated, has_freight: hasFreight, status: newStatus }
      }))

      setEditing(null)
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  function cancelEdit() {
    setEditing(null)
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  async function handleDeleteItem(itemId: number) {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    if (item.status === 'converted') {
      toast.error('Cannot delete an item that has already been converted')
      return
    }

    if (!confirm(`Remove "${item.ship_to_name}" from this import?`)) return

    try {
      const res = await fetch(`/api/vinyl-tech/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }

      setItems(prev => prev.filter(i => i.id !== itemId))
      setSelectedItems(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
      toast.success('Item removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete item')
    }
  }

  async function handlePickupFieldChange(itemId: number, field: 'pickup_date' | 'pickup_driver', value: string) {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    // Optimistic update
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, [field]: value || null } : i
    ))

    try {
      const res = await fetch(`/api/vinyl-tech/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_date: field === 'pickup_date' ? (value || null) : item.pickup_date,
          pickup_driver: field === 'pickup_driver' ? (value || null) : item.pickup_driver,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
    } catch {
      // Revert on failure
      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, [field]: item[field] } : i
      ))
      toast.error('Failed to save pickup info')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading import data...</span>
      </div>
    )
  }

  if (!importData) {
    return (
      <div className="text-center py-16 text-gray-500">Import not found</div>
    )
  }

  const filteredCustomers = customers.filter(c =>
    c.customer_name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{importData.week_label}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {importData.week_date && (
                <span>Week of {format(new Date(importData.week_date + 'T00:00:00'), 'MMM d, yyyy')}</span>
              )}
              <Badge variant={importData.status === 'active' ? 'default' : 'secondary'}>
                {importData.status}
              </Badge>
              {importData.sheet_status && (
                <Badge variant="outline">{importData.sheet_status}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                viewMode === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Manage
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                viewMode === 'summary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Summary
            </button>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>{importData.items_with_freight} items with freight</div>
            <div>{importData.total_weight.toLocaleString()} lbs total</div>
          </div>
        </div>
      </div>

      {viewMode === 'summary' && (
        <WeeklySummary importData={importData} items={items} />
      )}

      {viewMode === 'edit' && <>
      {/* Action Bar */}
      {pendingFreightItems.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4 text-blue-600" />
                <span>{selectedItems.size} of {pendingFreightItems.length} items selected</span>
              </div>

              <Button
                variant="outline"
                onClick={() => handleConvert(false)}
                disabled={selectedItems.size === 0 || isConverting}
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
                onClick={() => handleConvert(true)}
                disabled={selectedItems.size === 0 || !selectedTruckloadId || isConverting}
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
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          {pendingFreightItems.length} pending
        </Badge>
        <Badge variant="outline" className="gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {convertedItems.length} converted
        </Badge>
        <Badge variant="outline" className="gap-1">
          <AlertTriangle className="h-3 w-3 text-red-500" />
          {items.filter(i => i.has_freight && !i.customer_matched).length} unmatched
        </Badge>

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOnlyFreight(!showOnlyFreight)}
            className="text-xs h-6"
          >
            {showOnlyFreight ? 'Show all rows' : 'Show only freight'}
          </Button>
        </div>
      </div>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2.5 text-left w-10">
                    <Checkbox
                      checked={
                        pendingFreightItems.filter(i => i.customer_matched).length > 0 &&
                        selectedItems.size === pendingFreightItems.filter(i => i.customer_matched).length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-12">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-20">VT Code</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500">Ship To</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500">Matched Customer</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-20">Quote</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-16">16&apos;</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-16">12&apos;</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-16">4x8</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-16">Misc</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-20">Weight</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500">Notes</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-32">Pickup Date</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-36">Pickup Driver</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {displayItems.map(item => {
                  const isSelectable = item.has_freight && item.status === 'pending' && item.customer_matched
                  const isSelected = selectedItems.has(item.id)
                  const isConverted = item.status === 'converted'
                  const isUnmatched = item.has_freight && !item.customer_matched && item.status === 'pending'
                  const isEditable = item.status !== 'converted'

                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-100 transition-colors ${
                        isConverted
                          ? 'bg-green-50/50 opacity-60'
                          : isUnmatched
                            ? 'bg-red-50/50'
                            : isSelected
                              ? 'bg-blue-50/50'
                              : item.has_freight
                                ? 'hover:bg-gray-50'
                                : 'opacity-40'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        {isSelectable && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isConverted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : isUnmatched ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : item.has_freight ? (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-200" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">
                        {item.vt_code || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{item.ship_to_name}</td>
                      <td className="px-3 py-2.5">
                        {isConverted ? (
                          <span className="text-green-700 text-xs">{item.matched_customer_name}</span>
                        ) : item.customer_matched ? (
                          <button
                            className="text-green-700 text-xs hover:bg-green-50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 group/cust"
                            onClick={() => openMatchDialog(item.id)}
                            title="Click to change customer"
                          >
                            {item.matched_customer_name}
                            <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover/cust:opacity-100 transition-opacity" />
                          </button>
                        ) : item.has_freight ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => openMatchDialog(item.id)}
                          >
                            <LinkIcon className="h-3 w-3" />
                            Match Customer
                          </Button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      <EditableCell
                        itemId={item.id}
                        field="freight_quote"
                        value={item.freight_quote}
                        editing={editing}
                        isEditable={isEditable}
                        isSaving={isSaving}
                        onStartEdit={startEditing}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        onKeyDown={handleEditKeyDown}
                        onChange={(val) => setEditing(prev => prev ? { ...prev, value: val } : null)}
                        type="number"
                        prefix="$"
                      />
                      <EditableCell
                        itemId={item.id}
                        field="skid_16ft"
                        value={item.skid_16ft}
                        editing={editing}
                        isEditable={isEditable}
                        isSaving={isSaving}
                        onStartEdit={startEditing}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        onKeyDown={handleEditKeyDown}
                        onChange={(val) => setEditing(prev => prev ? { ...prev, value: val } : null)}
                        type="number"
                      />
                      <EditableCell
                        itemId={item.id}
                        field="skid_12ft"
                        value={item.skid_12ft}
                        editing={editing}
                        isEditable={isEditable}
                        isSaving={isSaving}
                        onStartEdit={startEditing}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        onKeyDown={handleEditKeyDown}
                        onChange={(val) => setEditing(prev => prev ? { ...prev, value: val } : null)}
                        type="number"
                      />
                      <EditableCell
                        itemId={item.id}
                        field="skid_4x8"
                        value={item.skid_4x8}
                        editing={editing}
                        isEditable={isEditable}
                        isSaving={isSaving}
                        onStartEdit={startEditing}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        onKeyDown={handleEditKeyDown}
                        onChange={(val) => setEditing(prev => prev ? { ...prev, value: val } : null)}
                        type="number"
                      />
                      <EditableCell
                        itemId={item.id}
                        field="misc"
                        value={item.misc}
                        editing={editing}
                        isEditable={isEditable}
                        isSaving={isSaving}
                        onStartEdit={startEditing}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        onKeyDown={handleEditKeyDown}
                        onChange={(val) => setEditing(prev => prev ? { ...prev, value: val } : null)}
                        type="number"
                      />
                      <EditableCell
                        itemId={item.id}
                        field="weight"
                        value={item.weight}
                        editing={editing}
                        isEditable={isEditable}
                        isSaving={isSaving}
                        onStartEdit={startEditing}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        onKeyDown={handleEditKeyDown}
                        onChange={(val) => setEditing(prev => prev ? { ...prev, value: val } : null)}
                        type="number"
                        displayFormatter={(v) => v ? v.toLocaleString() : ''}
                      />
                      <EditableCell
                        itemId={item.id}
                        field="notes_on_skids"
                        value={item.notes_on_skids || item.additional_notes || ''}
                        editing={editing}
                        isEditable={isEditable}
                        isSaving={isSaving}
                        onStartEdit={startEditing}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        onKeyDown={handleEditKeyDown}
                        onChange={(val) => setEditing(prev => prev ? { ...prev, value: val } : null)}
                        type="text"
                        className="text-left text-xs text-gray-500 max-w-[200px]"
                      />

                      <td className="px-2 py-1.5">
                        {item.has_freight && (
                          <Input
                            type="date"
                            value={item.pickup_date || ''}
                            onChange={(e) => handlePickupFieldChange(item.id, 'pickup_date', e.target.value)}
                            className="h-7 text-xs w-[120px]"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {item.has_freight && (
                          <select
                            value={item.pickup_driver || ''}
                            onChange={(e) => handlePickupFieldChange(item.id, 'pickup_driver', e.target.value)}
                            className="h-7 text-xs w-[130px] rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">—</option>
                            {drivers.map(d => (
                              <option key={d.id} value={d.full_name}>{d.full_name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditable && (
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      </>}

      {/* Customer Match Dialog */}
      <Dialog open={isMatchDialogOpen} onOpenChange={setIsMatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Match Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Ship to: <span className="font-medium text-gray-900">
                {items.find(i => i.id === matchingItemId)?.ship_to_name}
              </span>
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
    </div>
  )
}

interface WeeklySummaryProps {
  importData: ImportData
  items: ImportItem[]
}

function WeeklySummary({ importData, items }: WeeklySummaryProps) {
  const freightItems = items.filter(i => i.has_freight)

  async function handleDownloadPdf() {
    const { default: jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })

    const title = `Vinyl Tech Pickup Confirmation - ${importData.week_label}`
    const subtitle = importData.week_date
      ? `Week of ${format(new Date(importData.week_date + 'T00:00:00'), 'MMMM d, yyyy')}`
      : ''

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 40, 35)

    if (subtitle) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(subtitle, 40, 50)
      doc.setTextColor(0)
    }

    const headers = [
      'Customer',
      'VT Code',
      "16'",
      "12'",
      '4x8',
      'Misc',
      'Weight',
      'Pickup Date',
      'Pickup Driver',
    ]

    const rows = freightItems.map(item => [
      item.matched_customer_name || item.ship_to_name,
      item.vt_code || '',
      String(item.skid_16ft || ''),
      String(item.skid_12ft || ''),
      String(item.skid_4x8 || ''),
      String(item.misc || ''),
      item.weight ? item.weight.toLocaleString() : '',
      item.pickup_date ? format(new Date(item.pickup_date + 'T00:00:00'), 'M/d/yy') : '',
      item.pickup_driver || '',
    ])

    ;(doc as any).autoTable({
      head: [headers],
      body: rows,
      startY: subtitle ? 60 : 48,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9, cellPadding: { top: 5, right: 6, bottom: 5, left: 6 }, halign: 'left' as const },
      headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 55, halign: 'center' as const },
        2: { cellWidth: 32, halign: 'center' as const },
        3: { cellWidth: 32, halign: 'center' as const },
        4: { cellWidth: 32, halign: 'center' as const },
        5: { cellWidth: 35, halign: 'center' as const },
        6: { cellWidth: 50, halign: 'center' as const },
        7: { cellWidth: 70, halign: 'center' as const },
        8: { cellWidth: 90 },
      },
    })

    doc.save(`Vinyl Tech - ${importData.week_label}.pdf`)
  }

  const assignedItems = freightItems.filter(i => i.truckload_id)
  const unassignedConverted = freightItems.filter(i => i.status === 'converted' && !i.truckload_id)
  const pendingItems = freightItems.filter(i => i.status === 'pending')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="gap-1">
            <Truck className="h-3 w-3 text-green-500" />
            {assignedItems.length} assigned
          </Badge>
          {unassignedConverted.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <Package className="h-3 w-3 text-blue-500" />
              {unassignedConverted.length} orders (unassigned)
            </Badge>
          )}
          {pendingItems.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {pendingItems.length} pending
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-1.5">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 w-20">VT Code</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 w-14">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 w-20">Weight</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 w-20">Quote</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Pickup Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Pickup Driver</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Delivery Driver</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Delivery Dates</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody>
                {freightItems.map(item => {
                  const totalVinyl = item.skid_16ft + item.skid_12ft + item.skid_4x8 + item.misc
                  const isAssigned = !!item.truckload_id
                  const isOrderCreated = item.status === 'converted' && !item.truckload_id
                  const isPending = item.status === 'pending'

                  const skidParts: string[] = []
                  if (item.skid_16ft > 0) skidParts.push(`${item.skid_16ft}x 16'`)
                  if (item.skid_12ft > 0) skidParts.push(`${item.skid_12ft}x 12'`)
                  if (item.skid_4x8 > 0) skidParts.push(`${item.skid_4x8}x 4x8`)
                  if (item.misc > 0) skidParts.push(`${item.misc}x misc`)

                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-100 ${
                        isAssigned ? 'bg-green-50/30' : isOrderCreated ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {item.matched_customer_name || item.ship_to_name}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                        {item.vt_code || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono" title={skidParts.join(', ')}>
                        {totalVinyl}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 font-mono">
                        {item.weight ? item.weight.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.freight_quote ? `$${item.freight_quote}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.pickup_date ? (
                          format(new Date(item.pickup_date + 'T00:00:00'), 'MMM d, yyyy')
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.pickup_driver || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isAssigned && item.driver_name ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.driver_color || '#999' }}
                            />
                            <span className="text-sm">{item.driver_name}</span>
                            {item.trailer_number && (
                              <span className="text-xs text-gray-400">#{item.trailer_number}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isAssigned && item.truckload_start_date && item.truckload_end_date ? (
                          <span>
                            {format(new Date(item.truckload_start_date + 'T00:00:00'), 'MMM d')}
                            {' – '}
                            {format(new Date(item.truckload_end_date + 'T00:00:00'), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={
                        [item.notes_on_skids, item.additional_notes].filter(Boolean).join(' | ')
                      }>
                        {[item.notes_on_skids, item.additional_notes].filter(Boolean).join(' | ') || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface EditableCellProps {
  itemId: number
  field: EditingState['field']
  value: number | string
  editing: EditingState | null
  isEditable: boolean
  isSaving: boolean
  onStartEdit: (itemId: number, field: EditingState['field'], value: number | string) => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onChange: (value: string) => void
  type: 'number' | 'text'
  displayFormatter?: (value: number | string) => string
  prefix?: string
  className?: string
}

function EditableCell({
  itemId,
  field,
  value,
  editing,
  isEditable,
  isSaving,
  onStartEdit,
  onSave,
  onCancel,
  onKeyDown,
  onChange,
  type,
  displayFormatter,
  prefix,
  className = '',
}: EditableCellProps) {
  const isCurrentlyEditing = editing?.itemId === itemId && editing?.field === field
  const isNumber = type === 'number'

  if (isCurrentlyEditing) {
    return (
      <td className="px-1.5 py-1">
        <div className="flex items-center gap-0.5">
          <Input
            type={type}
            value={editing.value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onSave}
            autoFocus
            className={`h-7 text-xs ${isNumber ? 'w-16 text-right font-mono' : 'w-full'}`}
            min={isNumber ? 0 : undefined}
            disabled={isSaving}
          />
        </div>
      </td>
    )
  }

  const rawDisplay = displayFormatter ? displayFormatter(value) : (isNumber ? (value || '') : value)
  const displayValue = prefix && rawDisplay ? `${prefix}${rawDisplay}` : rawDisplay
  const isEmpty = !value || (isNumber && value === 0)

  return (
    <td
      className={`px-3 py-2.5 ${isNumber ? 'text-right font-mono' : ''} ${className} ${
        isEditable ? 'cursor-pointer group/cell' : ''
      }`}
      onClick={() => isEditable && onStartEdit(itemId, field, value)}
      title={isEditable ? 'Click to edit' : undefined}
    >
      <span className={`${isEditable ? 'group-hover/cell:bg-blue-50 group-hover/cell:px-1 group-hover/cell:rounded transition-colors' : ''}`}>
        {isEmpty ? (
          <span className="text-gray-200">—</span>
        ) : (
          displayValue
        )}
      </span>
    </td>
  )
}
