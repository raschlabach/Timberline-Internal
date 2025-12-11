'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

// Helper functions
function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return new Date().toISOString().split('T')[0]
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr
  }
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildFreightKey(item: Partial<CrossDriverFreightItem> & {
  driverName?: string | null
  date?: string | null
  action?: string | null
  dimensions?: string | null
  footage?: number | null
}): string {
  if (item.isManual && item.id) {
    return `manual:${item.id}`
  }
  const normalizedDate = normalizeDateString(item.date)
  return `${item.driverName || ''}|${normalizedDate}|${item.action || ''}|${item.dimensions || ''}|${item.footage || 0}`
}

function dedupeFreightItems(items: CrossDriverFreightItem[]): CrossDriverFreightItem[] {
  const seen = new Set<string>()
  const deduped: CrossDriverFreightItem[] = []
  items.forEach(item => {
    const key = buildFreightKey(item)
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(item)
    }
  })
  return deduped
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return ''
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parts = dateStr.split('-')
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
  }
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
}

interface TruckloadInvoiceDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  truckloadId: number
  driverId: number
  driverName?: string
  onDataUpdated?: () => void
}

interface Order {
  orderId: number
  assignmentType: 'pickup' | 'delivery'
  freightQuote: number | null
  footage: number
  pickupCustomerName: string | null
  deliveryCustomerName: string | null
}

interface Deduction {
  id: number
  driverName: string | null
  date: string
  action: string | null
  footage: number
  dimensions: string | null
  deduction: number
  isManual: boolean
  comment: string | null
}

interface TruckloadOrdersApiResponse {
  success: boolean
  orders: Array<{
    id: number
    assignment_type: 'pickup' | 'delivery'
    sequence_number: number
    pickup_customer: { id: number | null; name: string | null; address: string | null }
    delivery_customer: { id: number | null; name: string | null; address: string | null }
    freight_quote: string | null
    footage: number | null
    skids: number
    vinyl: number
    skids_data: Array<{ width: number; length: number; quantity: number }>
    vinyl_data: Array<{ width: number; length: number; quantity: number }>
    comments: string | null
    is_rush: boolean
    needs_attention: boolean
    is_transfer_order: boolean
    pickup_driver_name: string | null
    pickup_assignment_date: string | null
    delivery_driver_name: string | null
    delivery_assignment_date: string | null
  }>
}

interface AssignedOrderRow {
  orderId: string
  assignmentType: 'pickup' | 'delivery'
  sequenceNumber: number
  sequenceNumbers?: string
  pickupName: string
  deliveryName: string
  pickupAddress: string | null
  deliveryAddress: string | null
  payingCustomerName: string | null
  freightQuote: string | null
  footage: number
  skidsData: Array<{ width: number; length: number; quantity: number }>
  vinylData: Array<{ width: number; length: number; quantity: number }>
  comments: string | null
  isRush: boolean
  needsAttention: boolean
  pickupDriverName: string | null
  pickupAssignmentDate: string | null
  deliveryDriverName: string | null
  deliveryAssignmentDate: string | null
  isTransferOrder: boolean
}

interface CrossDriverFreightItem {
  id: string
  driverName: string
  date: string
  action: 'Picked up' | 'Delivered'
  footage: number
  dimensions: string
  deduction: number
  isManual: boolean
  comment?: string
}

export function TruckloadInvoiceDialog({ isOpen, onOpenChange, truckloadId, driverId, driverName, onDataUpdated }: TruckloadInvoiceDialogProps) {
  const [orders, setOrders] = useState<AssignedOrderRow[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [editableCrossDriverFreight, setEditableCrossDriverFreight] = useState<CrossDriverFreightItem[]>([])
  const [deductByFootage, setDeductByFootage] = useState(false)
  const [footageDeductionRate, setFootageDeductionRate] = useState<number>(0)
  const [updatingQuotes, setUpdatingQuotes] = useState<Set<string>>(new Set())
  const quoteUpdateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})
  const crossDriverFreightSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const editableCrossDriverFreightRef = useRef<CrossDriverFreightItem[]>([])
  
  // Keep ref in sync with state
  useEffect(() => {
    editableCrossDriverFreightRef.current = editableCrossDriverFreight
  }, [editableCrossDriverFreight])

  // Load orders when dialog opens
  useEffect(() => {
    if (!isOpen || !truckloadId) return

    async function loadOrders() {
      setIsLoadingOrders(true)
      try {
        const res = await fetch(`/api/truckloads/${truckloadId}/orders`)
        const data: TruckloadOrdersApiResponse = await res.json()
        
        if (data.success) {
          const rowsBase = data.orders.map(o => ({
            orderId: String(o.id),
            assignmentType: o.assignment_type,
            sequenceNumber: o.sequence_number,
            pickupName: o.pickup_customer?.name || 'Unknown',
            deliveryName: o.delivery_customer?.name || 'Unknown',
            pickupAddress: o.pickup_customer?.address || null,
            deliveryAddress: o.delivery_customer?.address || null,
            payingCustomerName: null as string | null,
            freightQuote: o.freight_quote,
            footage: typeof o.footage === 'number' ? o.footage : (typeof o.footage === 'string' ? parseFloat(o.footage) || 0 : 0),
            skidsData: o.skids_data || [],
            vinylData: o.vinyl_data || [],
            comments: o.comments || null,
            isRush: o.is_rush,
            needsAttention: o.needs_attention,
            pickupDriverName: o.pickup_driver_name || null,
            pickupAssignmentDate: o.pickup_assignment_date || null,
            deliveryDriverName: o.delivery_driver_name || null,
            deliveryAssignmentDate: o.delivery_assignment_date || null,
            isTransferOrder: o.is_transfer_order || false,
          }))
          
          // Fetch paying customer names
          const payingNames = await Promise.all(rowsBase.map(async (r) => {
            try {
              const res = await fetch(`/api/orders/${r.orderId}`)
              const data = await res.json()
              return data.payingCustomer?.name ?? null
            } catch {
              return null
            }
          }))
          
          const rows: AssignedOrderRow[] = rowsBase.map((r, idx) => ({ ...r, payingCustomerName: payingNames[idx] }))
          setOrders(rows)
        }
      } catch (error) {
        console.error('Error loading orders:', error)
        toast.error('Failed to load orders')
      } finally {
        setIsLoadingOrders(false)
      }
    }

    loadOrders()
  }, [isOpen, truckloadId])

  // Identify cross-driver freight (skids/vinyl handled by other drivers)
  // Only includes freight from orders in the selected truckload where the other part (pickup/delivery) was handled by a different driver
  const crossDriverFreight = useMemo(() => {
    if (!driverName) return []
    const currentDriverName = driverName
    const items: Omit<CrossDriverFreightItem, 'id' | 'deduction'>[] = []
    const seenOrders = new Set<string>() // Track orders we've already processed to avoid duplicates

    orders.forEach(order => {
      // Skip if we've already processed this order
      if (seenOrders.has(order.orderId)) return
      seenOrders.add(order.orderId)

      // Build dimensions string from skids and vinyl for this order
      const dimensionGroups: { [key: string]: number } = {}
      order.skidsData.forEach(skid => {
        const dimension = `${skid.width}x${skid.length}`
        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + skid.quantity
      })
      order.vinylData.forEach(vinyl => {
        const dimension = `${vinyl.width}x${vinyl.length}`
        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + vinyl.quantity
      })
      
      const allDimensions = Object.entries(dimensionGroups)
        .map(([dimension, quantity]) => `${quantity} ${dimension}`)
        .join(', ')

      // Only create entry if the OTHER part of the order (not the current assignment) was handled by a different driver
      // If current assignment is pickup, check if delivery was handled by another driver
      if (order.assignmentType === 'pickup' && 
          order.deliveryDriverName && 
          order.deliveryDriverName !== currentDriverName && 
          order.deliveryAssignmentDate) {
        items.push({
          driverName: order.deliveryDriverName,
          date: order.deliveryAssignmentDate,
          action: 'Delivered',
          footage: order.footage,
          dimensions: allDimensions || '—',
          isManual: false
        })
      }
      // If current assignment is delivery, check if pickup was handled by another driver
      else if (order.assignmentType === 'delivery' && 
               order.pickupDriverName && 
               order.pickupDriverName !== currentDriverName && 
               order.pickupAssignmentDate) {
        items.push({
          driverName: order.pickupDriverName,
          date: order.pickupAssignmentDate,
          action: 'Picked up',
          footage: order.footage,
          dimensions: allDimensions || '—',
          isManual: false
        })
      }
    })

    return items
  }, [orders, driverName])

  // Clear cross-driver freight immediately when truckload changes
  useEffect(() => {
    setEditableCrossDriverFreight([])
  }, [truckloadId])

  // Load cross-driver freight from database and merge with auto-detected freight
  useEffect(() => {
    if (!isOpen || !truckloadId || !driverName) return

    async function loadCrossDriverFreight() {
      try {
        const res = await fetch(`/api/truckloads/${truckloadId}/cross-driver-freight`, {
          method: 'GET',
          credentials: 'include'
        })
        
        if (!res.ok) {
          throw new Error('Failed to load cross-driver freight')
        }
        
        const data = await res.json()
        
        const loadedItems = data.success && data.items ? data.items.map((item: any) => ({
          id: `db-${item.id}`,
          driverName: item.driverName || '',
          date: formatDateForInput(item.date || ''),
          action: item.action || 'Picked up',
          footage: typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0,
          dimensions: item.dimensions || '',
          deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
          isManual: item.isManual || false,
          comment: item.comment || ''
        })) : []

        const dedupedLoadedItems = dedupeFreightItems(loadedItems)

        if (dedupedLoadedItems.length > 0) {
          setEditableCrossDriverFreight(dedupedLoadedItems)
          return
        }

        // If no items from database, use auto-detected freight
        if (crossDriverFreight.length > 0) {
          const autoItems = crossDriverFreight.map((item, idx) => ({
            ...item,
            id: `auto-${Date.now()}-${idx}`,
            deduction: 0,
            date: formatDateForInput(item.date),
            isManual: false
          }))
          setEditableCrossDriverFreight(dedupeFreightItems(autoItems))
        } else {
          setEditableCrossDriverFreight([])
        }
      } catch (error) {
        console.error('Error loading cross-driver freight:', error)
        // Fallback to auto-detected freight from current truckload only
        if (crossDriverFreight.length > 0) {
          const initialized = crossDriverFreight.map((item, idx) => ({
            ...item,
            id: `auto-${Date.now()}-${idx}`,
            deduction: 0,
            date: formatDateForInput(item.date),
            isManual: false
          }))
          setEditableCrossDriverFreight(initialized)
        } else {
          setEditableCrossDriverFreight([])
        }
      }
    }

    loadCrossDriverFreight()
  }, [isOpen, truckloadId, driverName, crossDriverFreight])

  // Auto-calculate deductions based on footage when in footage mode
  useEffect(() => {
    if (deductByFootage && footageDeductionRate > 0) {
      setEditableCrossDriverFreight(prev => 
        prev.map(item => {
          // Only auto-calculate for non-manual items
          if (!item.isManual && item.footage > 0) {
            return {
              ...item,
              deduction: item.footage * footageDeductionRate
            }
          }
          return item
        })
      )
    }
  }, [deductByFootage, footageDeductionRate])

  // Group orders by orderId to combine transfer orders
  const groupedOrders = useMemo(() => {
    const groups = new Map<string, AssignedOrderRow[]>()
    orders.forEach(order => {
      const existing = groups.get(order.orderId) || []
      groups.set(order.orderId, [...existing, order])
    })
    return Array.from(groups.values())
  }, [orders])

  // Calculate totals
  const totals = useMemo(() => {
    const totalQuotes = orders.reduce((sum, order) => {
      const quote = order.freightQuote ? parseFloat(order.freightQuote) : 0
      return sum + quote
    }, 0)
    return { totalQuotes }
  }, [orders])

  const payrollCalculations = useMemo(() => {
    const totalDeductions = editableCrossDriverFreight.reduce((sum, item) => {
      const deduction = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
      return sum + deduction
    }, 0)
    const finalDriverPay = (totals.totalQuotes || 0) - totalDeductions
    return { totalDeductions: Number(totalDeductions), finalDriverPay: Number(finalDriverPay) }
  }, [editableCrossDriverFreight, totals.totalQuotes])

  // Update order quote
  const updateOrderQuote = useCallback(async (orderId: string, newQuote: string) => {
    const key = `${truckloadId}-${orderId}`
    setUpdatingQuotes(prev => new Set(prev).add(key))

    if (quoteUpdateTimeouts.current[key]) {
      clearTimeout(quoteUpdateTimeouts.current[key])
    }

    quoteUpdateTimeouts.current[key] = setTimeout(async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            freightQuote: newQuote ? parseFloat(newQuote) : null
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update quote')
        }

        setOrders(prev => prev.map(order => 
          order.orderId === orderId 
            ? { ...order, freightQuote: newQuote || null }
            : order
        ))
        toast.success('Quote updated')
        onDataUpdated?.()
      } catch (error) {
        console.error('Error updating quote:', error)
        toast.error('Failed to update quote')
      } finally {
        setUpdatingQuotes(prev => {
          const newSet = new Set(prev)
          newSet.delete(key)
          return newSet
        })
        delete quoteUpdateTimeouts.current[key]
      }
    }, 1000)
  }, [truckloadId])

  // Save cross-driver freight
  const saveCrossDriverFreight = useCallback(async () => {
    if (!truckloadId) return

    // Use ref to get latest state
    const currentItems = editableCrossDriverFreightRef.current
    
    // Deduplicate items before saving
    const deduplicated = dedupeFreightItems(currentItems)

    try {
      const res = await fetch(`/api/truckloads/${truckloadId}/cross-driver-freight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: deduplicated.map(item => ({
            driverName: item.driverName || null,
            date: item.date || null,
            action: item.action || null,
            footage: typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0,
            dimensions: item.dimensions || null,
            deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
            isManual: item.isManual || false,
            comment: item.comment || null
          }))
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${res.status}: Failed to save cross-driver freight`
        throw new Error(errorMessage)
      }
      
      // Reload the data to ensure we have the latest from database
      const reloadRes = await fetch(`/api/truckloads/${truckloadId}/cross-driver-freight`, { method: 'GET', credentials: 'include' })
      if (reloadRes.ok) {
        const reloadData = await reloadRes.json()
        if (reloadData.success && reloadData.items) {
          const reloadedItems = reloadData.items.map((item: any) => ({
            id: `db-${item.id}`,
            driverName: item.driverName || '',
            date: formatDateForInput(item.date || ''),
            action: item.action || 'Picked up',
            footage: typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0,
            dimensions: item.dimensions || '',
            deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
            isManual: item.isManual || false,
            comment: item.comment || ''
          }))
          
          const dedupedReloadedItems = dedupeFreightItems(reloadedItems)
          
          if (dedupedReloadedItems.length > 0) {
            setEditableCrossDriverFreight(dedupedReloadedItems)
          } else {
            setEditableCrossDriverFreight([])
          }
        }
      }
      
      toast.success('Cross-driver freight saved')
      onDataUpdated?.()
    } catch (error) {
      console.error('Error saving cross-driver freight:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save cross-driver freight'
      toast.error(errorMessage)
    }
  }, [truckloadId, onDataUpdated])

  // Update deduction
  const updateCrossDriverFreightItem = useCallback((id: string, updates: Partial<CrossDriverFreightItem>) => {
    setEditableCrossDriverFreight(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ))

    if (crossDriverFreightSaveTimeout.current) {
      clearTimeout(crossDriverFreightSaveTimeout.current)
    }

    crossDriverFreightSaveTimeout.current = setTimeout(() => {
      saveCrossDriverFreight()
    }, 1000)
  }, [saveCrossDriverFreight])

  // Add new cross-driver freight item
  const addCrossDriverFreightItem = useCallback(() => {
    const newItem: CrossDriverFreightItem = {
      id: `manual-${Date.now()}-${Math.random()}`,
      driverName: '',
      date: '',
      action: 'Picked up',
      footage: 0,
      dimensions: '',
      deduction: 0,
      isManual: true,
      comment: ''
    }
    setEditableCrossDriverFreight(prev => [...prev, newItem])
    // Auto-save after adding
    if (truckloadId) {
      setTimeout(() => {
        saveCrossDriverFreight()
      }, 500)
    }
  }, [truckloadId, saveCrossDriverFreight])

  // Delete cross-driver freight item
  const deleteCrossDriverFreightItem = useCallback((id: string) => {
    setEditableCrossDriverFreight(prev => prev.filter(item => item.id !== id))
    // Auto-save after deletion
    if (truckloadId) {
      setTimeout(() => {
        saveCrossDriverFreight()
      }, 500)
    }
  }, [truckloadId, saveCrossDriverFreight])


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Truckload Invoice Details</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {isLoadingOrders ? (
              <div className="text-center py-8">Loading orders...</div>
            ) : (
              <>
                {/* Orders Table */}
                <Card className="p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-auto">#</TableHead>
                        <TableHead className="w-auto">Pickup</TableHead>
                        <TableHead className="w-auto">Delivery</TableHead>
                        <TableHead className="w-auto">Paying Customer</TableHead>
                        <TableHead style={{ width: '90px' }}>Quote</TableHead>
                        <TableHead className="w-auto">Footage</TableHead>
                        <TableHead className="w-auto">Dimensions</TableHead>
                        <TableHead className="w-auto">Handled By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedOrders.map((row) => {
                        const isTransfer = row.length > 1 || row[0].isTransferOrder
                        const totalSkidsQuantity = row[0].skidsData.reduce((sum, skid) => sum + skid.quantity, 0)
                        const totalVinylQuantity = row[0].vinylData.reduce((sum, vinyl) => sum + vinyl.quantity, 0)
                        const totalQuantity = totalSkidsQuantity + totalVinylQuantity
                        const freeItems = Math.floor(totalQuantity / 4)
                        
                        const dimensionGroups: { [key: string]: number } = {}
                        row[0].skidsData.forEach(skid => {
                          const dimension = `${skid.width}x${skid.length}`
                          dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + skid.quantity
                        })
                        row[0].vinylData.forEach(vinyl => {
                          const dimension = `${vinyl.width}x${vinyl.length}`
                          dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + vinyl.quantity
                        })
                        
                        const allDimensions = Object.entries(dimensionGroups)
                          .map(([dimension, quantity]) => `${quantity} ${dimension}`)
                          .join(', ')

                        const formatDateShort = (dateStr: string | null): string => {
                          if (!dateStr) return ''
                          if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                            const parts = dateStr.split('-')
                            const year = parseInt(parts[0], 10)
                            const month = parseInt(parts[1], 10)
                            const day = parseInt(parts[2], 10)
                            return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
                          }
                          const date = new Date(dateStr)
                          const month = String(date.getMonth() + 1).padStart(2, '0')
                          const day = String(date.getDate()).padStart(2, '0')
                          const year = String(date.getFullYear()).slice(-2)
                          return `${month}/${day}/${year}`
                        }

                        return (
                          <TableRow 
                            key={row[0].orderId}
                            className={isTransfer ? 'bg-blue-50' : (row[0].assignmentType === 'pickup' ? 'bg-red-50' : 'bg-gray-50')}
                          >
                            <TableCell className="text-sm text-center">
                              {isTransfer && row.length > 1 
                                ? row.map(r => r.sequenceNumber).join(', ')
                                : row[0].sequenceNumber}
                            </TableCell>
                            <TableCell className="text-sm">
                              {isTransfer ? (
                                <span className="font-bold">{row[0].pickupName}</span>
                              ) : (
                                row[0].assignmentType === 'pickup' ? <span className="font-bold">{row[0].pickupName}</span> : row[0].pickupName
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {isTransfer ? (
                                <span className="font-bold">{row[0].deliveryName}</span>
                              ) : (
                                row[0].assignmentType === 'delivery' ? <span className="font-bold">{row[0].deliveryName}</span> : row[0].deliveryName
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{row[0].payingCustomerName || '—'}</TableCell>
                            <TableCell className="text-sm">
                              <Input
                                type="text"
                                value={row[0].freightQuote || ''}
                                onChange={(e) => updateOrderQuote(row[0].orderId, e.target.value)}
                                placeholder="—"
                                className="h-7 text-xs px-1.5 py-0.5 border-gray-300 bg-transparent hover:bg-gray-50 focus:bg-white focus:border-blue-400 transition-colors w-full"
                                disabled={updatingQuotes.has(`${truckloadId}-${row[0].orderId}`)}
                              />
                            </TableCell>
                            <TableCell className="text-sm text-right">{row[0].footage.toFixed(0)}</TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {allDimensions ? (
                                  <>
                                    {Object.entries(dimensionGroups).map(([dimension, quantity], idx) => (
                                      <span key={idx} className="inline-block bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-xs font-mono">
                                        {quantity} {dimension}
                                      </span>
                                    ))}
                                    {freeItems > 0 && (
                                      <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-semibold">
                                        🎁 {freeItems}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {isTransfer ? (
                                <div className="text-xs text-blue-700 font-medium">Transfer</div>
                              ) : row[0].assignmentType === 'delivery' && row[0].pickupDriverName && row[0].pickupAssignmentDate ? (
                                <div className="text-xs">
                                  <div>{row[0].pickupDriverName}</div>
                                  <div className="text-gray-500">{formatDateShort(row[0].pickupAssignmentDate)}</div>
                                </div>
                              ) : row[0].assignmentType === 'pickup' && row[0].deliveryDriverName && row[0].deliveryAssignmentDate ? (
                                <div className="text-xs">
                                  <div>{row[0].deliveryDriverName}</div>
                                  <div className="text-gray-500">{formatDateShort(row[0].deliveryAssignmentDate)}</div>
                                </div>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Card>

                {/* Cross-Driver Freight Section */}
                <div className="px-2">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="text-sm font-semibold text-gray-700">
                      Freight Handled by Other Drivers
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 border border-gray-300 rounded px-2 py-1">
                        <Switch
                          checked={deductByFootage}
                          onCheckedChange={setDeductByFootage}
                          id="deduct-by-footage"
                        />
                        <Label htmlFor="deduct-by-footage" className="text-xs cursor-pointer">
                          Deduct by ft²
                        </Label>
                        {deductByFootage && (
                          <Input
                            type="number"
                            placeholder="Rate"
                            value={footageDeductionRate || ''}
                            onChange={(e) => setFootageDeductionRate(parseFloat(e.target.value) || 0)}
                            className="h-6 w-24 text-xs"
                            min="0"
                            step="0.01"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addCrossDriverFreightItem}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Line
                      </Button>
                    </div>
                  </div>
                  {editableCrossDriverFreight.length === 0 ? (
                    <div className="text-sm text-gray-500 border border-gray-300 rounded-lg p-3">
                      All freight handled by {driverName || 'selected driver'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {editableCrossDriverFreight.map((item) => {
                        if (item.isManual) {
                          // Manual items: comment field + deduction + delete button
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_auto_auto] gap-2 items-start border border-gray-300 rounded-lg p-1.5"
                            >
                              <Textarea
                                placeholder="Enter comment or description..."
                                value={item.comment || ''}
                                onChange={(e) => updateCrossDriverFreightItem(item.id, { comment: e.target.value })}
                                className="min-h-[50px] text-sm resize-none"
                                rows={2}
                              />
                              <Input
                                type="number"
                                placeholder="$0.00"
                                value={item.deduction || ''}
                                onChange={(e) => updateCrossDriverFreightItem(item.id, { deduction: parseFloat(e.target.value) || 0 })}
                                className="h-8 text-sm w-24 mt-0.5"
                                min="0"
                                step="0.01"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteCrossDriverFreightItem(item.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 mt-0.5"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        } else {
                          // Auto-populated items: read-only display + editable deduction (only if not in footage mode)
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_auto] gap-2 items-center border border-gray-300 rounded-lg p-1.5 text-sm"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{item.driverName}</span>
                                <span className="text-gray-500">-</span>
                                <span className="text-gray-600">{formatDateShort(item.date)}</span>
                                <span className="text-gray-500">-</span>
                                <span className="font-medium">{item.action}</span>
                                <span className="text-gray-500">-</span>
                                <span className="text-gray-700">{item.footage} sqft</span>
                                <span className="text-gray-500">-</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {item.dimensions && item.dimensions !== '—' ? (
                                    item.dimensions.split(', ').map((dim, idx) => {
                                      const match = dim.match(/^(\d+)\s+(.+)$/)
                                      if (match) {
                                        const [, quantity, dimension] = match
                                        return (
                                          <span key={idx} className="inline-block bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                                            {quantity} {dimension}
                                          </span>
                                        )
                                      }
                                      return <span key={idx} className="text-gray-700">{dim}</span>
                                    })
                                  ) : (
                                    <span className="text-gray-700">—</span>
                                  )}
                                </div>
                              </div>
                              {deductByFootage ? (
                                <div className="text-sm text-gray-700 w-24 text-right">
                                  ${(typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0).toFixed(2)}
                                </div>
                              ) : (
                                <Input
                                  type="number"
                                  placeholder="$0.00"
                                  value={item.deduction || ''}
                                  onChange={(e) => updateCrossDriverFreightItem(item.id, { deduction: parseFloat(e.target.value) || 0 })}
                                  className="h-8 text-sm w-24"
                                  min="0"
                                  step="0.01"
                                />
                              )}
                            </div>
                          )
                        }
                      })}
                    </div>
                  )}
                </div>

                {/* Payroll Summary */}
                <div className="px-2 mt-3">
                  <div className="border-2 border-gray-400 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Quotes</div>
                        <div className="text-lg font-bold">
                          ${totals.totalQuotes.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Deductions</div>
                        <div className="text-lg font-bold text-red-600">
                          -${payrollCalculations.totalDeductions.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Load Value</div>
                        <div className="text-xl font-bold">
                          ${payrollCalculations.finalDriverPay.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

