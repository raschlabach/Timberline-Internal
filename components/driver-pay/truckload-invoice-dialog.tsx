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

interface TruckloadInvoiceDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  truckloadId: number
  driverId: number
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

export function TruckloadInvoiceDialog({ isOpen, onOpenChange, truckloadId, driverId, onDataUpdated }: TruckloadInvoiceDialogProps) {
  const [orders, setOrders] = useState<AssignedOrderRow[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [editableCrossDriverFreight, setEditableCrossDriverFreight] = useState<CrossDriverFreightItem[]>([])
  const [deductByFootage, setDeductByFootage] = useState(false)
  const [footageDeductionRate, setFootageDeductionRate] = useState<number>(0)
  const [updatingQuotes, setUpdatingQuotes] = useState<Set<string>>(new Set())
  const quoteUpdateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})
  const crossDriverFreightSaveTimeout = useRef<NodeJS.Timeout | null>(null)

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

  // Load cross-driver freight
  useEffect(() => {
    if (!isOpen || !truckloadId) return

    async function loadCrossDriverFreight() {
      try {
        const res = await fetch(`/api/truckloads/${truckloadId}/cross-driver-freight`)
        const data = await res.json()
        
        if (data.success && data.items) {
          const items = data.items.map((item: any) => ({
            id: `db-${item.id}`,
            driverName: item.driverName || '',
            date: item.date || '',
            action: item.action || 'Picked up',
            footage: typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0,
            dimensions: item.dimensions || '',
            deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
            isManual: item.isManual || false,
            comment: item.comment || ''
          }))
          setEditableCrossDriverFreight(items)
        }
      } catch (error) {
        console.error('Error loading cross-driver freight:', error)
      }
    }

    loadCrossDriverFreight()
  }, [isOpen, truckloadId])

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
  }, [])

  // Save cross-driver freight
  const saveCrossDriverFreight = useCallback(async () => {
    if (!truckloadId) return

    try {
      const response = await fetch(`/api/truckloads/${truckloadId}/cross-driver-freight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editableCrossDriverFreight.map(item => ({
            driverName: item.driverName || null,
            date: item.date || null,
            action: item.action || null,
            footage: item.footage,
            dimensions: item.dimensions || null,
            deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
            isManual: item.isManual || false,
            comment: item.comment || null
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save deductions')
      }

      toast.success('Deductions saved')
      onDataUpdated?.()
    } catch (error) {
      console.error('Error saving deductions:', error)
      toast.error('Failed to save deductions')
    }
  }, [truckloadId, editableCrossDriverFreight])

  // Add new deduction
  const addDeduction = () => {
    const newItem: CrossDriverFreightItem = {
      id: `new-${Date.now()}`,
      driverName: '',
      date: new Date().toISOString().split('T')[0],
      action: 'Picked up',
      footage: 0,
      dimensions: '',
      deduction: 0,
      isManual: true,
      comment: ''
    }
    setEditableCrossDriverFreight(prev => [...prev, newItem])
  }

  // Delete deduction
  const deleteDeduction = (id: string) => {
    setEditableCrossDriverFreight(prev => prev.filter(item => item.id !== id))
    setTimeout(() => saveCrossDriverFreight(), 500)
  }

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

                {/* Deductions */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Cross-Driver Freight Deductions</h3>
                    <Button size="sm" onClick={addDeduction}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Deduction
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editableCrossDriverFreight.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                        <Input
                          type="date"
                          value={item.date}
                          onChange={(e) => updateCrossDriverFreightItem(item.id, { date: e.target.value })}
                          className="w-32 h-8"
                        />
                        <Input
                          type="text"
                          placeholder="Driver Name"
                          value={item.driverName}
                          onChange={(e) => updateCrossDriverFreightItem(item.id, { driverName: e.target.value })}
                          className="w-32 h-8"
                        />
                        <select
                          value={item.action}
                          onChange={(e) => updateCrossDriverFreightItem(item.id, { action: e.target.value as 'Picked up' | 'Delivered' })}
                          className="w-32 h-8 border rounded px-2"
                        >
                          <option value="Picked up">Picked up</option>
                          <option value="Delivered">Delivered</option>
                        </select>
                        <Input
                          type="number"
                          placeholder="Footage"
                          value={item.footage}
                          onChange={(e) => updateCrossDriverFreightItem(item.id, { footage: parseFloat(e.target.value) || 0 })}
                          className="w-24 h-8"
                          step="0.01"
                          min="0"
                        />
                        <Input
                          type="text"
                          placeholder="Dimensions"
                          value={item.dimensions}
                          onChange={(e) => updateCrossDriverFreightItem(item.id, { dimensions: e.target.value })}
                          className="w-32 h-8"
                        />
                        <Input
                          type="number"
                          placeholder="Deduction"
                          value={item.deduction}
                          onChange={(e) => updateCrossDriverFreightItem(item.id, { deduction: parseFloat(e.target.value) || 0 })}
                          className="w-24 h-8"
                          step="0.01"
                          min="0"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteDeduction(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Summary */}
                <Card className="p-4 bg-gray-50">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Total Quotes</div>
                      <div className="text-lg font-bold">${totals.totalQuotes.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Total Deductions</div>
                      <div className="text-lg font-bold text-red-600">-${payrollCalculations.totalDeductions.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-0.5">Load Value</div>
                      <div className="text-xl font-bold">${payrollCalculations.finalDriverPay.toFixed(2)}</div>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

