'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { Printer, Edit3, Search, MessageSquare, ChevronDown, ChevronRight, Check, CheckCircle, Timer, Plus, Trash2, Gift, AlertTriangle, DollarSign, ArrowLeft } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import EditTruckloadDialog from '@/components/invoices/edit-truckload-dialog'
import { OrderInfoDialog } from '@/components/orders/order-info-dialog'
import { BillOfLadingDialog } from '@/app/components/BillOfLadingDialog'
import { toast } from 'sonner'

interface TruckloadInvoicePageProps {}

interface DriverGroup {
  driverId: string
  driverName: string
  driverColor: string | null
}

interface TruckloadListItem {
  id: string
  startDate: string
  endDate: string | null
  driver: DriverGroup
  displayLabel: string
  description: string | null
  billOfLadingNumber: string | null
  isCompleted: boolean
  allQuotesFilled?: boolean
}

interface TruckloadsApiResponse {
  success: boolean
  truckloads: Array<{
    id: string
    driverId: string | null
    driverName: string | null
    driverColor: string | null
    startDate: string
    endDate: string | null
    billOfLadingNumber: string | null
    description: string | null
    isCompleted: boolean
    allQuotesFilled?: boolean
  }>
}

interface TruckloadOrdersApiResponse {
  success: boolean
  orders: Array<{
    id: string
    assignment_type: 'pickup' | 'delivery'
    sequence_number: number
    pickup_customer: { id: string | null; name: string | null; address: string | null }
    delivery_customer: { id: string | null; name: string | null; address: string | null }
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
  sequenceNumbers?: string // For transfer orders to show both sequence numbers
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
  isManual: boolean // Track if this is a manually added item
  comment?: string // For manual items
  isAddition?: boolean // Track if this is an addition (true) or deduction (false). Only applies to manual items.
  appliesTo?: 'load_value' | 'driver_pay' // For manual items: whether it applies to load value or driver pay. Defaults to 'driver_pay'
  customerName?: string // Customer name for pickup/delivery (for automatic items)
}

export default function TruckloadInvoicePage({}: TruckloadInvoicePageProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Read URL parameters
  const urlTruckloadId = searchParams?.get('truckloadId')
  const urlDriverId = searchParams?.get('driverId')
  const urlStartDate = searchParams?.get('startDate')
  const urlEndDate = searchParams?.get('endDate')
  const fromDriverPay = searchParams?.get('from') === 'driver-pay'
  
  const [searchValue, setSearchValue] = useState<string>('')
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<string | null>(null)
  const [truckloads, setTruckloads] = useState<TruckloadListItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasError, setHasError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [orders, setOrders] = useState<AssignedOrderRow[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false)
  const [hasOrdersError, setHasOrdersError] = useState<boolean>(false)
  const [ordersErrorMessage, setOrdersErrorMessage] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [isOrderInfoDialogOpen, setIsOrderInfoDialogOpen] = useState<boolean>(false)
  const [selectedOrderIdForInfo, setSelectedOrderIdForInfo] = useState<number | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<string>('default')
  const [collapsedDrivers, setCollapsedDrivers] = useState<Set<string>>(new Set())
  const [editableCrossDriverFreight, setEditableCrossDriverFreight] = useState<CrossDriverFreightItem[]>([])
  const [showCompleted, setShowCompleted] = useState<boolean>(true)
  const [deductByFootage, setDeductByFootage] = useState<boolean>(false)
  const [footageDeductionRate, setFootageDeductionRate] = useState<number>(0)
  const [updatingQuotes, setUpdatingQuotes] = useState<Set<string>>(new Set())
  const [driverLoadPercentage, setDriverLoadPercentage] = useState<number>(30.00) // Default 30%
  const selectedTruckload = useMemo(() => truckloads.find(t => t.id === selectedTruckloadId) || null, [truckloads, selectedTruckloadId])
  const crossDriverFreightSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const editableCrossDriverFreightRef = useRef<CrossDriverFreightItem[]>([])
  
  // Keep ref in sync with state
  useEffect(() => {
    editableCrossDriverFreightRef.current = editableCrossDriverFreight
  }, [editableCrossDriverFreight])
  
  // Auto-select truckload from URL parameter when from driver pay
  // This effect should run whenever URL params change
  useEffect(() => {
    // Re-read params inside effect to ensure we get latest values
    const currentTruckloadId = searchParams?.get('truckloadId')
    const currentFromDriverPay = searchParams?.get('from') === 'driver-pay'
    
    if (currentFromDriverPay && currentTruckloadId && truckloads.length > 0) {
      // Find truckload by ID (handle both string and number comparisons)
      const matchingTruckload = truckloads.find(t => 
        String(t.id) === String(currentTruckloadId) || 
        Number(t.id) === Number(currentTruckloadId)
      )
      if (matchingTruckload) {
        const matchingId = String(matchingTruckload.id)
        // Always update if URL param differs from current selection
        if (selectedTruckloadId !== matchingId) {
          console.log('Setting truckload from URL:', currentTruckloadId, 'matched to:', matchingId)
          setSelectedTruckloadId(matchingId)
        }
      } else {
        console.log('No matching truckload found for ID:', currentTruckloadId, 'Available IDs:', truckloads.map(t => t.id))
      }
    }
  }, [searchParams, truckloads, selectedTruckloadId])

  // Fetch driver's load percentage when truckload is selected
  useEffect(() => {
    if (selectedTruckload?.driver.driverId) {
      const driverId = selectedTruckload.driver.driverId
      fetch(`/api/drivers/pay-settings/${driverId}`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.settings) {
            setDriverLoadPercentage(data.settings.loadPercentage || 30.00)
          } else {
            // If no settings found, use default
            setDriverLoadPercentage(30.00)
          }
        })
        .catch(err => {
          console.error('Error fetching driver pay settings:', err)
          // Keep default 30%
          setDriverLoadPercentage(30.00)
        })
    } else {
      // Reset to default if no truckload selected
      setDriverLoadPercentage(30.00)
    }
  }, [selectedTruckload?.driver.driverId])

  // Group orders by orderId to combine transfer orders
  const groupedOrders = useMemo(() => {
    const groups = new Map<string, AssignedOrderRow[]>()
    
    orders.forEach(order => {
      const existing = groups.get(order.orderId) || []
      existing.push(order)
      groups.set(order.orderId, existing)
    })
    
    // Convert to array of combined rows
    const combined: Array<AssignedOrderRow & { isCombined?: boolean }> = []
    const processedOrderIds = new Set<string>()
    
    groups.forEach((groupOrders, orderId) => {
      // Check if this is a transfer order (has both pickup and delivery in same truckload)
      const hasPickup = groupOrders.some(o => o.assignmentType === 'pickup')
      const hasDelivery = groupOrders.some(o => o.assignmentType === 'delivery')
      const isTransfer = hasPickup && hasDelivery
      
      if (isTransfer && !processedOrderIds.has(orderId)) {
        // Combine into single row - prefer delivery order for transfer orders
        const pickupOrder = groupOrders.find(o => o.assignmentType === 'pickup')
        const deliveryOrder = groupOrders.find(o => o.assignmentType === 'delivery')
        // For transfers, use delivery order (or pickup if delivery doesn't exist)
        const transferOrder = deliveryOrder || pickupOrder!
        
        // Get both sequence numbers for display
        const pickupSeq = pickupOrder?.sequenceNumber || 0
        const deliverySeq = deliveryOrder?.sequenceNumber || 0
        const sequenceNumbers = pickupSeq !== deliverySeq 
          ? `${Math.min(pickupSeq, deliverySeq)}, ${Math.max(pickupSeq, deliverySeq)}`
          : pickupSeq.toString()
        
        combined.push({
          ...transferOrder,
          assignmentType: 'delivery', // Use delivery as primary for transfer orders
          sequenceNumber: Math.min(...groupOrders.map(o => o.sequenceNumber)), // Use lowest for sorting
          sequenceNumbers: sequenceNumbers, // Store both for display
          isCombined: true
        })
        processedOrderIds.add(orderId)
      } else if (!isTransfer) {
        // Non-transfer orders, add each one
        groupOrders.forEach(order => {
          const uniqueKey = `${orderId}-${order.assignmentType}`
          if (!processedOrderIds.has(uniqueKey)) {
            combined.push(order)
            processedOrderIds.add(uniqueKey)
          }
        })
      }
    })
    
    return combined.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  }, [orders])

  // Calculate totals for payroll using groupedOrders to avoid double-counting transfers
  const totals = useMemo(() => {
    // Count based on grouped orders (transfers are already combined)
    const pickupCount = groupedOrders.filter(o => o.assignmentType === 'pickup' && !(o as any).isCombined).length
    const deliveryCount = groupedOrders.filter(o => o.assignmentType === 'delivery' && !(o as any).isCombined).length
    const transferCount = groupedOrders.filter(o => (o as any).isCombined).length
    
    // Calculate total quotes from grouped orders (each order counted once)
    const totalQuotes = groupedOrders.reduce((sum, order) => {
      if (order.freightQuote) {
        // Parse quote string (could be "$123.45" or "123.45")
        const cleaned = order.freightQuote.replace(/[^0-9.-]/g, '')
        const value = parseFloat(cleaned)
        return sum + (isNaN(value) ? 0 : value)
      }
      return sum
    }, 0)
    return { pickupCount, deliveryCount, transferCount, totalQuotes }
  }, [groupedOrders])

  // Helper function to format dates for date input (YYYY-MM-DD)
  function formatDateForInput(dateStr: string | null): string {
    if (!dateStr) return new Date().toISOString().split('T')[0]
    // Convert to YYYY-MM-DD format for date input
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function normalizeDateString(dateStr: string | null | undefined): string {
    if (!dateStr) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
    try {
      return new Date(dateStr).toISOString().split('T')[0]
    } catch {
      return String(dateStr)
    }
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
    const footageValue = typeof item.footage === 'number'
      ? item.footage
      : parseFloat(String(item.footage || 0)) || 0
    return [
      'auto',
      item.driverName || '',
      normalizedDate,
      item.action || '',
      item.dimensions || '',
      footageValue.toFixed(2)
    ].join('|')
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

  // Identify cross-driver freight (skids/vinyl handled by other drivers)
  // Only includes freight from orders in the selected truckload where the other part (pickup/delivery) was handled by a different driver
  const crossDriverFreight = useMemo(() => {
    if (!selectedTruckload) return []
    const currentDriverName = selectedTruckload.driver.driverName
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
          isManual: false,
          customerName: order.deliveryName // Delivery customer name
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
          isManual: false,
          customerName: order.pickupName // Pickup customer name
        })
      }
    })

    return items
  }, [orders, selectedTruckload])

  // Clear cross-driver freight immediately when truckload changes
  useEffect(() => {
    setEditableCrossDriverFreight([])
  }, [selectedTruckloadId])

  // Load cross-driver freight from database and merge with auto-detected freight
  useEffect(() => {
    if (!selectedTruckloadId || !selectedTruckload) {
      return
    }

    async function loadCrossDriverFreight() {
      try {
        const res = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-freight`, {
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
          comment: item.comment || '',
          isAddition: item.isAddition || false,
          appliesTo: item.appliesTo || (item.isManual ? 'driver_pay' : undefined),
          customerName: item.customerName || undefined
        })) : []

        const dedupedLoadedItems = dedupeFreightItems(loadedItems)

        if (dedupedLoadedItems.length > 0) {
          setEditableCrossDriverFreight(dedupedLoadedItems)
          return
        }

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
  }, [selectedTruckloadId, crossDriverFreight, selectedTruckload])

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

  // Calculate detailed breakdown of deductions, additions, and driver pay
  const payrollCalculations = useMemo(() => {
    const totalQuotes = totals.totalQuotes || 0
    
    // Separate deductions/additions by where they apply
    // Manual items that apply to load value
    const manualDeductionsFromLoadValue = editableCrossDriverFreight.reduce((sum, item) => {
      const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
      if (item.isManual && !item.isAddition && item.appliesTo === 'load_value') {
        return sum + amount
      }
      return sum
    }, 0)
    
    const manualAdditionsToLoadValue = editableCrossDriverFreight.reduce((sum, item) => {
      if (item.isManual && item.isAddition && item.appliesTo === 'load_value') {
        const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
        return sum + amount
      }
      return sum
    }, 0)
    
    // Automatic deductions (always from driver pay)
    const automaticDeductions = editableCrossDriverFreight.reduce((sum, item) => {
      const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
      if (!item.isManual) {
        return sum + amount
      }
      return sum
    }, 0)
    
    // Manual items that apply to driver pay
    const manualDeductionsFromDriverPay = editableCrossDriverFreight.reduce((sum, item) => {
      const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
      if (item.isManual && !item.isAddition && (item.appliesTo === 'driver_pay' || !item.appliesTo)) {
        return sum + amount
      }
      return sum
    }, 0)
    
    const manualAdditionsToDriverPay = editableCrossDriverFreight.reduce((sum, item) => {
      if (item.isManual && item.isAddition && (item.appliesTo === 'driver_pay' || !item.appliesTo)) {
        const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
        return sum + amount
      }
      return sum
    }, 0)
    
    // Calculate load value (quotes - manual deductions from load value + manual additions to load value)
    const loadValue = totalQuotes - manualDeductionsFromLoadValue + manualAdditionsToLoadValue
    
    // Calculate base driver pay (load value × percentage)
    const baseDriverPay = loadValue * (driverLoadPercentage / 100)
    
    // Calculate final driver pay (base driver pay - automatic deductions - manual deductions from driver pay + manual additions to driver pay)
    const finalDriverPay = baseDriverPay - automaticDeductions - manualDeductionsFromDriverPay + manualAdditionsToDriverPay
    
    return { 
      totalQuotes: Number(totalQuotes),
      manualDeductionsFromLoadValue: Number(manualDeductionsFromLoadValue),
      manualAdditionsToLoadValue: Number(manualAdditionsToLoadValue),
      loadValue: Number(loadValue),
      baseDriverPay: Number(baseDriverPay),
      automaticDeductions: Number(automaticDeductions),
      manualDeductionsFromDriverPay: Number(manualDeductionsFromDriverPay),
      manualAdditionsToDriverPay: Number(manualAdditionsToDriverPay),
      finalDriverPay: Number(finalDriverPay),
      driverLoadPercentage: Number(driverLoadPercentage)
    }
  }, [editableCrossDriverFreight, totals.totalQuotes, driverLoadPercentage])

  // Ref to store debounce timeouts
  const quoteUpdateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})

  // Function to update order quote with auto-save
  const updateOrderQuote = useCallback(async (orderId: string, newQuote: string): Promise<void> => {
    setUpdatingQuotes(prev => new Set(prev).add(orderId))
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freightQuote: newQuote
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update quote')
      }
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.orderId === orderId 
          ? { ...order, freightQuote: newQuote || null }
          : order
      ))
    } catch (error) {
      console.error('Error updating quote:', error)
      toast.error('Failed to update quote')
      // Revert the change on error - reload orders
      if (selectedTruckloadId) {
        const id = selectedTruckloadId
        setSelectedTruckloadId(null)
        setTimeout(() => setSelectedTruckloadId(id), 0)
      }
    } finally {
      setUpdatingQuotes(prev => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }, [selectedTruckloadId])

  // Debounced quote update function
  const debouncedUpdateQuote = useCallback((orderId: string, newQuote: string) => {
    // Clear existing timeout for this order
    if (quoteUpdateTimeouts.current[orderId]) {
      clearTimeout(quoteUpdateTimeouts.current[orderId])
    }
    
    // Update local state immediately for responsive UI
    setOrders(prev => prev.map(order => 
      order.orderId === orderId 
        ? { ...order, freightQuote: newQuote || null }
        : order
    ))
    
    // Debounce the API call
    quoteUpdateTimeouts.current[orderId] = setTimeout(() => {
      updateOrderQuote(orderId, newQuote)
      delete quoteUpdateTimeouts.current[orderId]
    }, 1000) // Wait 1 second after user stops typing
  }, [updateOrderQuote])

  // Functions to manage editable cross-driver freight
  function addCrossDriverFreightItem(isAddition: boolean = false): void {
    const newItem: CrossDriverFreightItem = {
      id: `manual-${Date.now()}-${Math.random()}`,
      driverName: '',
      date: '',
      action: 'Picked up',
      footage: 0,
      dimensions: '',
      deduction: 0,
      isManual: true,
      comment: '',
      isAddition: isAddition,
      appliesTo: 'driver_pay' // Default to driver pay
    }
    setEditableCrossDriverFreight([...editableCrossDriverFreight, newItem])
    // Auto-save after adding
    if (selectedTruckloadId) {
      setTimeout(() => {
        saveCrossDriverFreight()
      }, 500)
    }
  }

  function updateCrossDriverFreightItem(id: string, updates: Partial<CrossDriverFreightItem>): void {
    setEditableCrossDriverFreight(items =>
      items.map(item => item.id === id ? { ...item, ...updates } : item)
    )
    
    // Auto-save after a delay
    if (selectedTruckloadId) {
      if (crossDriverFreightSaveTimeout.current) {
        clearTimeout(crossDriverFreightSaveTimeout.current)
      }
      crossDriverFreightSaveTimeout.current = setTimeout(() => {
        saveCrossDriverFreight()
      }, 1000)
    }
  }

  // Function to save cross-driver freight to database
  const saveCrossDriverFreight = useCallback(async (): Promise<void> => {
    if (!selectedTruckloadId) return

    // Use ref to get latest state
    const currentItems = editableCrossDriverFreightRef.current

    // Deduplicate items before saving
    const deduplicated = dedupeFreightItems(currentItems)
    
    console.log(`[Save] Deduplicated ${currentItems.length} items to ${deduplicated.length} items before saving`)

    try {
      const res = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-freight`, {
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
            comment: item.comment || null,
            isAddition: item.isAddition || false,
            appliesTo: item.appliesTo || (item.isManual ? 'driver_pay' : undefined)
          }))
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${res.status}: Failed to save cross-driver freight`
        console.error('Error saving cross-driver freight:', errorMessage, errorData)
        throw new Error(errorMessage)
      }
      
      const responseData = await res.json()
      console.log('Save response:', responseData)
      
      // Reload the data to ensure we have the latest from database
      if (responseData.success && responseData.verifiedCount > 0) {
        // Trigger a reload of cross-driver freight
        const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-freight`, {
          method: 'GET',
          credentials: 'include'
        })
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json()
          if (reloadData.success && reloadData.items) {
            // Helper to normalize dates for comparison (YYYY-MM-DD format)
            const normalizeDate = (dateStr: string | null | undefined): string => {
              if (!dateStr) return ''
              // If already in YYYY-MM-DD format, return as-is
              if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
              // Try to parse and format
              try {
                return new Date(dateStr).toISOString().split('T')[0]
              } catch {
                return String(dateStr)
              }
            }
            
            const reloadedItems = reloadData.items.map((item: any) => ({
              id: `db-${item.id}`,
              driverName: item.driverName || '',
              date: formatDateForInput(item.date || ''),
              action: item.action || 'Picked up',
              footage: typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0,
              dimensions: item.dimensions || '',
              deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
              isManual: item.isManual || false,
              comment: item.comment || '',
              isAddition: item.isAddition || false,
              appliesTo: item.appliesTo || (item.isManual ? 'driver_pay' : undefined),
              customerName: item.customerName || undefined
            }))
            
            console.log('Reloaded items from DB:', reloadedItems)
            
            const dedupedReloadedItems = dedupeFreightItems(reloadedItems)
            
            if (dedupedReloadedItems.length > 0) {
              setEditableCrossDriverFreight(dedupedReloadedItems)
              console.log('Merged items (from DB):', dedupedReloadedItems)
            } else if (crossDriverFreight.length > 0) {
              const autoItems = crossDriverFreight.map((item, idx) => ({
                ...item,
                id: `auto-${Date.now()}-${idx}`,
                deduction: 0,
                date: formatDateForInput(item.date),
                isManual: false
              }))
              const dedupedAuto = dedupeFreightItems(autoItems)
              setEditableCrossDriverFreight(dedupedAuto)
              console.log('Merged items (auto-detected fallback):', dedupedAuto)
            } else {
              setEditableCrossDriverFreight([])
            }
          }
        }
      }
      
      // Show success message
      toast.success('Cross-driver freight saved')
    } catch (error) {
      console.error('Error saving cross-driver freight:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save cross-driver freight'
      toast.error(errorMessage)
    }
  }, [selectedTruckloadId])

  function deleteCrossDriverFreightItem(id: string): void {
    setEditableCrossDriverFreight(items => items.filter(item => item.id !== id))
    // Auto-save after deletion
    if (selectedTruckloadId) {
      setTimeout(() => {
        saveCrossDriverFreight()
      }, 500)
    }
  }

  useEffect(function loadTruckloads() {
    let isCancelled = false
    async function run(): Promise<void> {
      try {
        setIsLoading(true)
        setHasError(false)
        setErrorMessage('')
        const res = await fetch('/api/truckloads', { method: 'GET', credentials: 'include' })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}: ${body || 'Failed to fetch truckloads'}`)
        }
        const data = (await res.json()) as TruckloadsApiResponse
        if (!data.success) throw new Error('API returned success=false')
        const items: TruckloadListItem[] = data.truckloads.map(t => {
          const idStr = String(t.id)
          const driverIdStr = t.driverId ? String(t.driverId) : 'unassigned'
          return {
            id: idStr,
            startDate: t.startDate,
            endDate: t.endDate,
            driver: {
              driverId: driverIdStr,
              driverName: t.driverName || 'Unassigned',
              driverColor: t.driverColor || null,
            },
            displayLabel: `${t.billOfLadingNumber ? `BOL ${t.billOfLadingNumber}` : `TL ${idStr.slice(0, 6)}`}`,
            description: t.description,
            billOfLadingNumber: t.billOfLadingNumber,
            isCompleted: t.isCompleted || false,
            allQuotesFilled: t.allQuotesFilled || false,
          }
        })
        if (!isCancelled) {
          setTruckloads(items)
          // Only auto-select first truckload if not coming from driver pay
          // (the useEffect will handle selection from URL params)
          if (items.length > 0 && !fromDriverPay) {
            setSelectedTruckloadId(items[0].id)
          }
        }
      } catch (e) {
        if (!isCancelled) {
          setHasError(true)
          setErrorMessage(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }
    run()
    return () => {
      isCancelled = true
    }
  }, [fromDriverPay])

  useEffect(function loadOrdersForTruckload() {
    let isCancelled = false
    async function fetchPayingCustomerName(orderId: string): Promise<string | null> {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { method: 'GET', credentials: 'same-origin' })
        if (!res.ok) return null
        const data = await res.json()
        return data.payingCustomer?.name ?? null
      } catch (_e) {
        return null
      }
    }

    async function run(): Promise<void> {
      if (!selectedTruckloadId) {
        setOrders([])
        return
      }
      try {
        setIsLoadingOrders(true)
        setHasOrdersError(false)
        setOrdersErrorMessage('')
        const res = await fetch(`/api/truckloads/${selectedTruckloadId}/orders`, { method: 'GET', credentials: 'include' })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}: ${body || 'Failed to fetch truckload orders'}`)
        }
        const data = (await res.json()) as TruckloadOrdersApiResponse
        if (!data.success) throw new Error('API returned success=false')
        
        const rowsBase = data.orders.map(o => ({
          orderId: o.id,
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
        // Fetch paying customer names in parallel
        const payingNames = await Promise.all(rowsBase.map(r => fetchPayingCustomerName(r.orderId)))
        const rows: AssignedOrderRow[] = rowsBase.map((r, idx) => ({ ...r, payingCustomerName: payingNames[idx] }))
        if (!isCancelled) setOrders(rows)
      } catch (e) {
        if (!isCancelled) {
          setHasOrdersError(true)
          setOrdersErrorMessage(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!isCancelled) setIsLoadingOrders(false)
      }
    }

    run()
    return () => {
      isCancelled = true
    }
  }, [selectedTruckloadId])

  const groupedTruckloads = useMemo(() => {
    const items: TruckloadListItem[] = truckloads
    const groups: Record<string, { group: DriverGroup; items: TruckloadListItem[] }> = {}

    let filteredItems = items
      .filter(i => {
        // Apply driver filter
        if (selectedDriverId !== 'default' && i.driver.driverId !== selectedDriverId) {
          return false
        }
        // Apply search filter
        const matchesSearch = i.displayLabel.toLowerCase().includes(searchValue.toLowerCase()) ||
          i.driver.driverName.toLowerCase().includes(searchValue.toLowerCase())
        if (!matchesSearch) {
          return false
        }
        // Apply completed filter based on toggle
        if (showCompleted) {
          // Show completed truckloads (regardless of quotes filled status)
          return i.isCompleted === true
        } else {
          // Show only incomplete truckloads (not completed)
          return i.isCompleted !== true
        }
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate)) // Sort descending for most recent first

    // If showing incomplete, limit to 5 newest
    if (!showCompleted) {
      filteredItems = filteredItems.slice(0, 5)
    }

    filteredItems.forEach(i => {
      const key = i.driver.driverId
      if (!groups[key]) {
        groups[key] = { group: i.driver, items: [] }
      }
      groups[key].items.push(i)
    })

    return Object.values(groups)
  }, [searchValue, truckloads, selectedDriverId, showCompleted])

  // Auto-select first truckload when filter changes and current selection doesn't match
  useEffect(() => {
    const allFilteredTruckloads = groupedTruckloads.flatMap(g => g.items)
    const currentTruckload = allFilteredTruckloads.find(t => t.id === selectedTruckloadId)
    
    if (!currentTruckload && allFilteredTruckloads.length > 0) {
      setSelectedTruckloadId(allFilteredTruckloads[0].id)
    } else if (allFilteredTruckloads.length === 0) {
      setSelectedTruckloadId(null)
    }
  }, [groupedTruckloads, selectedTruckloadId])

  // Get unique drivers for dropdown
  const uniqueDrivers = useMemo(() => {
    const driverMap = new Map<string, DriverGroup>()
    truckloads.forEach(t => {
      if (!driverMap.has(t.driver.driverId)) {
        driverMap.set(t.driver.driverId, t.driver)
      }
    })
    return Array.from(driverMap.values())
  }, [truckloads])

  function toggleDriverCollapse(driverId: string): void {
    setCollapsedDrivers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(driverId)) {
        newSet.delete(driverId)
      } else {
        newSet.add(driverId)
      }
      return newSet
    })
  }

  function handlePrint(): void {
    window.print()
  }

  function formatDateShort(dateStr: string | null): string {
    if (!dateStr) return ''
    // Parse date string manually to avoid timezone shifts
    // Date strings from API are in YYYY-MM-DD format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = dateStr.split('-')
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
    }
    // Fallback for other date formats
    const date = new Date(dateStr)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${month}/${day}/${year}`
  }

  // Handle back button navigation
  const handleBackToDriverPay = () => {
    if (urlDriverId && urlStartDate && urlEndDate) {
      const params = new URLSearchParams({
        driverId: urlDriverId,
        startDate: urlStartDate,
        endDate: urlEndDate
      })
      router.push(`/dashboard/driver-pay?${params.toString()}`)
    } else {
      router.push('/dashboard/driver-pay')
    }
  }

  return (
    <div className="flex h-full w-full gap-4">
      {!fromDriverPay && (
      <div className="w-[280px] flex-shrink-0 border rounded-md bg-white p-3 flex flex-col print:hidden">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search driver, truckload…"
          />
        </div>
        <div className="mb-2">
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              {uniqueDrivers.map(driver => (
                <SelectItem key={driver.driverId} value={driver.driverId}>
                  {driver.driverName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mb-2 flex items-center justify-between gap-2 border border-gray-300 rounded-md px-3 py-2">
          <Label htmlFor="completed-toggle" className="text-xs cursor-pointer flex-1">
            {showCompleted ? 'Completed' : 'Incomplete (5 newest)'}
          </Label>
          <Switch
            id="completed-toggle"
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
          />
        </div>
        <Separator className="my-2" />
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="text-sm text-gray-500 p-2">Loading…</div>
          ) : hasError ? (
            <div className="text-sm text-red-600 p-2">Failed to load truckloads. {errorMessage && (<span className="break-all">{errorMessage}</span>)}</div>
          ) : groupedTruckloads.length === 0 ? (
            <div className="text-sm text-gray-500 p-2">No truckloads yet.</div>
          ) : (
            <div className="space-y-4">
              {groupedTruckloads.map(({ group, items }) => {
                const isCollapsed = collapsedDrivers.has(group.driverId)
                const displayItems = selectedDriverId === 'default' ? items.slice(0, 5) : items
                
                return (
                  <div key={group.driverId}>
                    <Collapsible open={!isCollapsed} onOpenChange={() => toggleDriverCollapse(group.driverId)}>
                      <CollapsibleTrigger className="w-full flex items-center gap-1 text-xs font-semibold text-gray-600 mb-2 hover:text-gray-900 transition-colors">
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {group.driverName}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-1">
                          {displayItems.map(item => {
                            const isCompleted = item.isCompleted
                            
                            // Convert hex color to RGB for opacity
                            const hexToRgb = (hex: string | null): { r: number; g: number; b: number } | null => {
                              if (!hex) return null
                              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                              return result ? {
                                r: parseInt(result[1], 16),
                                g: parseInt(result[2], 16),
                                b: parseInt(result[3], 16)
                              } : null
                            }
                            
                            const rgb = hexToRgb(item.driver.driverColor)
                            const bgColorStyle = rgb 
                              ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` 
                              : 'rgba(128, 128, 128, 0.15)'
                            
                            const formatDateShort = (dateStr: string | null): string => {
                              if (!dateStr) return ''
                              // Parse date string manually to avoid timezone shifts
                              // Date strings from API are in YYYY-MM-DD format
                              if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                                const parts = dateStr.split('-')
                                const year = parseInt(parts[0], 10)
                                const month = parseInt(parts[1], 10)
                                const day = parseInt(parts[2], 10)
                                return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
                              }
                              // Fallback for other date formats
                              const date = new Date(dateStr)
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const day = String(date.getDate()).padStart(2, '0')
                              const year = String(date.getFullYear()).slice(-2)
                              return `${month}/${day}/${year}`
                            }
                            
                            return (
                              <button
                                key={item.id}
                                onClick={() => setSelectedTruckloadId(item.id)}
                                className={`w-full text-left px-2 py-1.5 rounded-md border-2 transition-colors flex items-start gap-2 ${
                                  selectedTruckloadId === item.id
                                    ? 'border-blue-500'
                                    : 'border-gray-200'
                                }`}
                                style={{ backgroundColor: bgColorStyle }}
                              >
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {isCompleted ? (
                                    item.allQuotesFilled ? (
                                      <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                                  ) : (
                                      <CheckCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                                    )
                                  ) : (
                                    <Timer className="h-4 w-4 text-red-600 mt-0.5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium">{formatDateShort(item.startDate)} - {formatDateShort(item.endDate)}</div>
                                  {item.description && (
                                    <div className="text-xs text-gray-600 mt-0.5 truncate">{item.description}</div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>
      )}

      <div className={`flex-1 flex flex-col ${fromDriverPay ? 'w-full' : ''}`}>
        <div className="flex items-center justify-between mb-3 print:hidden">
          <div className="flex items-center gap-3">
            {fromDriverPay && (
              <Button variant="outline" onClick={handleBackToDriverPay} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Driver Pay
              </Button>
            )}
            <div>
              <h2 className="text-xl font-semibold">Invoice Page</h2>
              {!fromDriverPay && (
                <p className="text-sm text-gray-500">Select a truckload to view assigned orders.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!selectedTruckloadId} onClick={() => setIsEditDialogOpen(true)}>
              <Edit3 className="h-4 w-4 mr-2" /> Edit Truckload
            </Button>
            <Button onClick={handlePrint} variant="default">
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
          </div>
        </div>

        <Card className="flex-1 p-4">
          {selectedTruckload && (
            <div className="mb-4 pb-3 border-b">
              <div className="flex items-center gap-3 text-lg">
                {selectedTruckload.driver.driverColor && (
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedTruckload.driver.driverColor }}
                  />
                )}
                <span className="font-semibold">{selectedTruckload.driver.driverName}</span>
                <span className="text-base text-gray-600">
                  {formatDateShort(selectedTruckload.startDate)} - {formatDateShort(selectedTruckload.endDate)}
                </span>
                {selectedTruckload.description && (
                  <span className="text-sm text-gray-600">{selectedTruckload.description}</span>
                )}
                {selectedTruckload.billOfLadingNumber && (
                  <span className="text-base font-medium">BOL {selectedTruckload.billOfLadingNumber}</span>
                )}
              </div>
            </div>
          )}
          {!selectedTruckloadId ? (
            <div className="text-sm text-gray-500">No truckload selected.</div>
          ) : isLoadingOrders ? (
            <div className="text-sm text-gray-500">Loading orders…</div>
          ) : hasOrdersError ? (
            <div className="text-sm text-red-600">Failed to load assigned orders. {ordersErrorMessage && (<span className="break-all">{ordersErrorMessage}</span>)}</div>
          ) : orders.length === 0 ? (
            <div className="text-sm text-gray-500">No assigned orders.</div>
          ) : (
            <>
              {/* Screen view with table */}
              <div className="print:hidden">
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
                      <TableHead className="w-auto">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedOrders.map((row) => {
                      // Calculate total quantity of skids and vinyl combined
                      const totalSkidsQuantity = row.skidsData.reduce((sum, skid) => sum + skid.quantity, 0)
                      const totalVinylQuantity = row.vinylData.reduce((sum, vinyl) => sum + vinyl.quantity, 0)
                      const totalQuantity = totalSkidsQuantity + totalVinylQuantity
                      const freeItems = Math.floor(totalQuantity / 4)
                      
                      // Build dimensions string - combine skids and vinyl by dimension
                      const dimensionGroups: { [key: string]: number } = {}
                      row.skidsData.forEach(skid => {
                        const dimension = `${skid.width}x${skid.length}`
                        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + skid.quantity
                      })
                      row.vinylData.forEach(vinyl => {
                        const dimension = `${vinyl.width}x${vinyl.length}`
                        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + vinyl.quantity
                      })
                      
                      const allDimensions = Object.entries(dimensionGroups)
                        .map(([dimension, quantity]) => `${quantity} ${dimension}`)
                        .join(', ')
                      
                      const isTransfer = (row as any).isCombined || false
                      
                      return (
                        <TableRow 
                          key={`${row.orderId}${isTransfer ? '-transfer' : `-${row.assignmentType}`}`} 
                          className={`${isTransfer ? 'bg-blue-50' : (row.assignmentType === 'pickup' ? 'bg-red-50' : 'bg-gray-50')} hover:bg-gray-300 transition-colors cursor-pointer hover:shadow-sm`}
                        >
                          <TableCell className="text-sm text-center">
                            {isTransfer && (row as any).sequenceNumbers ? (row as any).sequenceNumbers : row.sequenceNumber}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isTransfer ? (
                              <span className="font-bold">{row.pickupName}</span>
                            ) : (
                              row.assignmentType === 'pickup' ? <span className="font-bold">{row.pickupName}</span> : row.pickupName
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isTransfer ? (
                              <span className="font-bold">{row.deliveryName}</span>
                            ) : (
                              row.assignmentType === 'delivery' ? <span className="font-bold">{row.deliveryName}</span> : row.deliveryName
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{row.payingCustomerName || '—'}</TableCell>
                          <TableCell className="text-sm" style={{ width: '90px' }}>
                            <Input
                              type="text"
                              value={row.freightQuote || ''}
                              onChange={(e) => debouncedUpdateQuote(row.orderId, e.target.value)}
                              placeholder="—"
                              className="h-7 text-xs px-1.5 py-0.5 border-gray-300 bg-transparent hover:bg-gray-50 focus:bg-white focus:border-blue-400 transition-colors w-full"
                              disabled={updatingQuotes.has(row.orderId)}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-right">{row.footage}</TableCell>
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
                                    <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-semibold animate-[pulse_2s_ease-in-out_infinite]">
                                      <Gift className="h-3 w-3" />
                                      {freeItems}
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
                            ) : row.assignmentType === 'delivery' && row.pickupDriverName && row.pickupAssignmentDate ? (
                              <div className="text-xs flex items-center gap-1.5">
                                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                  {row.pickupDriverName !== selectedTruckload?.driver.driverName && (
                                    <AlertTriangle className="h-4 w-4 text-red-500 animate-[pulse_1s_ease-in-out_infinite]" />
                                  )}
                                </div>
                                <div>
                                  <div>{row.pickupDriverName}</div>
                                  <div className="text-gray-500">{formatDateShort(row.pickupAssignmentDate)}</div>
                                </div>
                              </div>
                            ) : row.assignmentType === 'pickup' && row.deliveryDriverName && row.deliveryAssignmentDate ? (
                              <div className="text-xs flex items-center gap-1.5">
                                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                  {row.deliveryDriverName !== selectedTruckload?.driver.driverName && (
                                    <AlertTriangle className="h-4 w-4 text-red-500 animate-[pulse_1s_ease-in-out_infinite]" />
                                  )}
                                </div>
                                <div>
                                  <div>{row.deliveryDriverName}</div>
                                  <div className="text-gray-500">{formatDateShort(row.deliveryAssignmentDate)}</div>
                                </div>
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (row.comments) {
                                    alert(row.comments)
                                  }
                                }}
                                className={row.comments ? "p-1 h-7 w-7 border-yellow-500 bg-yellow-50 hover:bg-yellow-100" : "p-1 h-7 w-7 invisible"}
                                disabled={!row.comments}
                              >
                                <MessageSquare className="h-3 w-3 text-yellow-700" />
                              </Button>
                              <BillOfLadingDialog
                                order={{
                                  id: row.orderId,
                                  shipper: {
                                    name: row.pickupName,
                                    address: row.pickupAddress || '',
                                    phone: '',
                                    phone2: ''
                                  },
                                  consignee: {
                                    name: row.deliveryName,
                                    address: row.deliveryAddress || '',
                                    phone: '',
                                    phone2: ''
                                  },
                                  items: [
                                    ...(row.skidsData?.map(skid => ({
                                      packages: skid.quantity,
                                      description: `Skid ${skid.width}x${skid.length}`,
                                      weight: 0,
                                      charges: 0
                                    })) || []),
                                    ...(row.vinylData?.map(vinyl => ({
                                      packages: vinyl.quantity,
                                      description: `Vinyl ${vinyl.width}x${vinyl.length}`,
                                      weight: 0,
                                      charges: 0
                                    })) || [])
                                  ]
                                }}
                              >
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                >
                                  BOL
                                </Button>
                              </BillOfLadingDialog>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrderIdForInfo(parseInt(row.orderId))
                                  setIsOrderInfoDialogOpen(true)
                                }}
                                className="h-7 px-2 text-xs"
                              >
                                Info
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                
                {/* Totals Section */}
                {orders.length > 0 && (
                  <div className="mt-4 space-y-3 border-t-2 border-gray-300 pt-3">
                    {/* Summary Totals */}
                    <div className="grid grid-cols-2 gap-4 px-2">
                      <div className="border border-gray-300 rounded-lg p-2">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Pickups</div>
                        <div className="text-xl font-bold">{totals.pickupCount}</div>
                      </div>
                      <div className="border border-gray-300 rounded-lg p-2">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Deliveries</div>
                        <div className="text-xl font-bold">{totals.deliveryCount}</div>
                      </div>
                    </div>

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
                        </div>
                      </div>
                      
                      {/* Automatic Deductions Section */}
                      {editableCrossDriverFreight.filter(item => !item.isManual).length > 0 && (
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-gray-300"></div>
                            <h4 className="text-sm font-semibold text-gray-700 px-2">Automatic Deductions</h4>
                            <div className="h-px flex-1 bg-gray-300"></div>
                          </div>
                          <div className="space-y-1.5">
                            {editableCrossDriverFreight
                              .filter(item => !item.isManual)
                              .map((item) => (
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
                                    {item.customerName && (
                                      <>
                                        <span className="text-gray-500">from</span>
                                        <span className="text-gray-700">{item.customerName}</span>
                                      </>
                                    )}
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
                              ))}
                          </div>
                          {/* Add Line button under automatic deductions */}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addCrossDriverFreightItem(false)}
                            className="h-7 text-xs w-full"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Manual Deduction
                          </Button>
                        </div>
                      )}

                      {/* Manual Additions and Deductions - Side by Side */}
                      {(editableCrossDriverFreight.filter(item => item.isManual && item.isAddition).length > 0 || 
                        editableCrossDriverFreight.filter(item => item.isManual && !item.isAddition).length > 0 ||
                        editableCrossDriverFreight.filter(item => !item.isManual).length === 0) && (
                        <div className="grid grid-cols-2 gap-4">
                          {/* Left: Manual Additions (Green) */}
                          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-green-800">Manual Additions</h4>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => addCrossDriverFreightItem(true)}
                                className="h-7 text-xs bg-white hover:bg-green-100 border-green-400 text-green-700"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {editableCrossDriverFreight
                                .filter(item => item.isManual && item.isAddition)
                                .map((item) => (
                                  <div
                                    key={item.id}
                                    className="bg-white border border-green-300 rounded-lg p-2 space-y-2"
                                  >
                                    <Textarea
                                      placeholder="Enter description..."
                                      value={item.comment || ''}
                                      onChange={(e) => updateCrossDriverFreightItem(item.id, { comment: e.target.value })}
                                      className="min-h-[50px] text-sm resize-none border-green-200"
                                      rows={2}
                                    />
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={item.appliesTo || 'driver_pay'}
                                        onValueChange={(value) => updateCrossDriverFreightItem(item.id, { appliesTo: value as 'load_value' | 'driver_pay' })}
                                      >
                                        <SelectTrigger className="h-8 w-32 text-xs border-green-300">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="load_value">Load Value</SelectItem>
                                          <SelectItem value="driver_pay">Driver Pay</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        placeholder="$0.00"
                                        value={item.deduction || ''}
                                        onChange={(e) => updateCrossDriverFreightItem(item.id, { deduction: parseFloat(e.target.value) || 0 })}
                                        className="h-8 text-sm w-24 border-green-300"
                                        min="0"
                                        step="0.01"
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => deleteCrossDriverFreightItem(item.id)}
                                        className="h-8 w-8 text-red-500 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              {editableCrossDriverFreight.filter(item => item.isManual && item.isAddition).length === 0 && (
                                <div className="text-xs text-green-600 italic text-center py-2">No additions yet</div>
                              )}
                            </div>
                          </div>

                          {/* Right: Manual Deductions (Red) */}
                          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-red-800">Manual Deductions</h4>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => addCrossDriverFreightItem(false)}
                                className="h-7 text-xs bg-white hover:bg-red-100 border-red-400 text-red-700"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {editableCrossDriverFreight
                                .filter(item => item.isManual && !item.isAddition)
                                .map((item) => (
                                  <div
                                    key={item.id}
                                    className="bg-white border border-red-300 rounded-lg p-2 space-y-2"
                                  >
                                    <Textarea
                                      placeholder="Enter description..."
                                      value={item.comment || ''}
                                      onChange={(e) => updateCrossDriverFreightItem(item.id, { comment: e.target.value })}
                                      className="min-h-[50px] text-sm resize-none border-red-200"
                                      rows={2}
                                    />
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={item.appliesTo || 'driver_pay'}
                                        onValueChange={(value) => updateCrossDriverFreightItem(item.id, { appliesTo: value as 'load_value' | 'driver_pay' })}
                                      >
                                        <SelectTrigger className="h-8 w-32 text-xs border-red-300">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="load_value">Load Value</SelectItem>
                                          <SelectItem value="driver_pay">Driver Pay</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        placeholder="$0.00"
                                        value={item.deduction || ''}
                                        onChange={(e) => updateCrossDriverFreightItem(item.id, { deduction: parseFloat(e.target.value) || 0 })}
                                        className="h-8 text-sm w-24 border-red-300"
                                        min="0"
                                        step="0.01"
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => deleteCrossDriverFreightItem(item.id)}
                                        className="h-8 w-8 text-red-500 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              {editableCrossDriverFreight.filter(item => item.isManual && !item.isAddition).length === 0 && (
                                <div className="text-xs text-red-600 italic text-center py-2">No deductions yet</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Empty state when no items at all */}
                      {editableCrossDriverFreight.length === 0 && (
                        <div className="text-sm text-gray-500 border border-gray-300 rounded-lg p-3">
                          All freight handled by {selectedTruckload?.driver.driverName || 'selected driver'}
                        </div>
                      )}
                    </div>

                    {/* Payroll Summary */}
                    <div className="px-2 mt-3">
                      <div className="border-2 border-gray-400 rounded-lg p-4 bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Payroll Calculation</h3>
                        
                        {/* Step 1: Calculate Load Value */}
                        <div className="mb-4 pb-4 border-b-2 border-gray-300">
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Step 1: Calculate Load Value</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                              <span className="text-sm font-medium text-gray-700">Total Quotes</span>
                              <span className="text-base font-bold">${payrollCalculations.totalQuotes.toFixed(2)}</span>
                            </div>
                            
                            {/* Manual Deductions from Load Value - Detailed */}
                            {editableCrossDriverFreight.filter(item => item.isManual && !item.isAddition && item.appliesTo === 'load_value').length > 0 && (
                              <div className="bg-red-50 rounded px-3 py-2">
                                <div className="text-xs font-semibold text-red-700 mb-1.5">Manual Deductions (from Load Value)</div>
                                <div className="space-y-1">
                                  {editableCrossDriverFreight
                                    .filter(item => item.isManual && !item.isAddition && item.appliesTo === 'load_value')
                                    .map((item) => {
                                      const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
                                      if (amount === 0) return null
                                      return (
                                        <div key={item.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                                          <span className="text-red-700 flex-1 truncate">{item.comment || 'No description'}</span>
                                          <span className="text-red-600 font-semibold ml-2">-${amount.toFixed(2)}</span>
                                        </div>
                                      )
                                    })}
                                </div>
                                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-red-200">
                                  <span className="text-sm font-medium text-red-700">Subtotal</span>
                                  <span className="text-sm font-bold text-red-600">-${payrollCalculations.manualDeductionsFromLoadValue.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Manual Additions to Load Value - Detailed */}
                            {editableCrossDriverFreight.filter(item => item.isManual && item.isAddition && item.appliesTo === 'load_value').length > 0 && (
                              <div className="bg-green-50 rounded px-3 py-2">
                                <div className="text-xs font-semibold text-green-700 mb-1.5">Manual Additions (to Load Value)</div>
                                <div className="space-y-1">
                                  {editableCrossDriverFreight
                                    .filter(item => item.isManual && item.isAddition && item.appliesTo === 'load_value')
                                    .map((item) => {
                                      const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
                                      if (amount === 0) return null
                                      return (
                                        <div key={item.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                                          <span className="text-green-700 flex-1 truncate">{item.comment || 'No description'}</span>
                                          <span className="text-green-600 font-semibold ml-2">+${amount.toFixed(2)}</span>
                                        </div>
                                      )
                                    })}
                                </div>
                                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-green-200">
                                  <span className="text-sm font-medium text-green-700">Subtotal</span>
                                  <span className="text-sm font-bold text-green-600">+${payrollCalculations.manualAdditionsToLoadValue.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between bg-blue-100 rounded px-3 py-2 border-2 border-blue-300">
                              <span className="text-sm font-semibold text-blue-900">Load Value</span>
                              <span className="text-lg font-bold text-blue-900">${payrollCalculations.loadValue.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Step 2: Calculate Base Driver Pay */}
                        <div className="mb-4 pb-4 border-b-2 border-gray-300">
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Step 2: Calculate Base Driver Pay</div>
                          <div className="flex items-center justify-between bg-blue-50 rounded px-3 py-2">
                            <span className="text-sm font-medium text-blue-700">
                              Load Value × {payrollCalculations.driverLoadPercentage.toFixed(0)}%
                            </span>
                            <span className="text-base font-bold text-blue-600">${payrollCalculations.baseDriverPay.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Step 3: Apply Deductions & Additions to Driver Pay */}
                        <div className="mb-4">
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Step 3: Apply Deductions & Additions</div>
                          <div className="space-y-2">
                            {/* Automatic Deductions - Detailed */}
                            {editableCrossDriverFreight.filter(item => !item.isManual).length > 0 && (
                              <div className="bg-red-50 rounded px-3 py-2">
                                <div className="text-xs font-semibold text-red-700 mb-1.5">Automatic Deductions (Cross-Driver Freight)</div>
                                <div className="space-y-1">
                                  {editableCrossDriverFreight
                                    .filter(item => !item.isManual)
                                    .map((item) => {
                                      const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
                                      if (amount === 0) return null
                                      return (
                                        <div key={item.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                                          <span className="text-red-700 flex-1 truncate">
                                            {item.driverName} - {formatDateShort(item.date)} - {item.action} from {item.customerName || 'Unknown'} ({item.footage} sqft)
                                          </span>
                                          <span className="text-red-600 font-semibold ml-2">-${amount.toFixed(2)}</span>
                                        </div>
                                      )
                                    })}
                                </div>
                                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-red-200">
                                  <span className="text-sm font-medium text-red-700">Subtotal</span>
                                  <span className="text-sm font-bold text-red-600">-${payrollCalculations.automaticDeductions.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Manual Deductions from Driver Pay - Detailed */}
                            {editableCrossDriverFreight.filter(item => item.isManual && !item.isAddition && (item.appliesTo === 'driver_pay' || !item.appliesTo)).length > 0 && (
                              <div className="bg-red-50 rounded px-3 py-2">
                                <div className="text-xs font-semibold text-red-700 mb-1.5">Manual Deductions (from Driver Pay)</div>
                                <div className="space-y-1">
                                  {editableCrossDriverFreight
                                    .filter(item => item.isManual && !item.isAddition && (item.appliesTo === 'driver_pay' || !item.appliesTo))
                                    .map((item) => {
                                      const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
                                      if (amount === 0) return null
                                      return (
                                        <div key={item.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                                          <span className="text-red-700 flex-1 truncate">{item.comment || 'No description'}</span>
                                          <span className="text-red-600 font-semibold ml-2">-${amount.toFixed(2)}</span>
                                        </div>
                                      )
                                    })}
                                </div>
                                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-red-200">
                                  <span className="text-sm font-medium text-red-700">Subtotal</span>
                                  <span className="text-sm font-bold text-red-600">-${payrollCalculations.manualDeductionsFromDriverPay.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Manual Additions to Driver Pay - Detailed */}
                            {editableCrossDriverFreight.filter(item => item.isManual && item.isAddition && (item.appliesTo === 'driver_pay' || !item.appliesTo)).length > 0 && (
                              <div className="bg-green-50 rounded px-3 py-2">
                                <div className="text-xs font-semibold text-green-700 mb-1.5">Manual Additions (to Driver Pay)</div>
                                <div className="space-y-1">
                                  {editableCrossDriverFreight
                                    .filter(item => item.isManual && item.isAddition && (item.appliesTo === 'driver_pay' || !item.appliesTo))
                                    .map((item) => {
                                      const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
                                      if (amount === 0) return null
                                      return (
                                        <div key={item.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                                          <span className="text-green-700 flex-1 truncate">{item.comment || 'No description'}</span>
                                          <span className="text-green-600 font-semibold ml-2">+${amount.toFixed(2)}</span>
                                        </div>
                                      )
                                    })}
                                </div>
                                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-green-200">
                                  <span className="text-sm font-medium text-green-700">Subtotal</span>
                                  <span className="text-sm font-bold text-green-600">+${payrollCalculations.manualAdditionsToDriverPay.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                            
                            {(payrollCalculations.automaticDeductions === 0 && payrollCalculations.manualDeductionsFromDriverPay === 0 && payrollCalculations.manualAdditionsToDriverPay === 0) && (
                              <div className="text-xs text-gray-500 italic text-center py-2">No deductions or additions applied</div>
                            )}
                          </div>
                        </div>

                        {/* Final Result */}
                        <div className="bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg px-4 py-3 border-2 border-blue-400">
                          <div className="flex items-center justify-between">
                            <span className="text-base font-semibold text-blue-900">Final Driver Pay</span>
                            <span className="text-2xl font-bold text-blue-900">${payrollCalculations.finalDriverPay.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Print view with table - First page: Stops list */}
              <div className="hidden print:block print-invoice-content">
                <div className="print-page-break-after">
                  <Table className="print-table">
                  <TableHeader className="print-table-header">
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
                      // Calculate total quantity of skids and vinyl combined
                      const totalSkidsQuantity = row.skidsData.reduce((sum, skid) => sum + skid.quantity, 0)
                      const totalVinylQuantity = row.vinylData.reduce((sum, vinyl) => sum + vinyl.quantity, 0)
                      const totalQuantity = totalSkidsQuantity + totalVinylQuantity
                      const freeItems = Math.floor(totalQuantity / 4)
                      
                      // Build dimensions string - combine skids and vinyl by dimension
                      const dimensionGroups: { [key: string]: number } = {}
                      row.skidsData.forEach(skid => {
                        const dimension = `${skid.width}x${skid.length}`
                        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + skid.quantity
                      })
                      row.vinylData.forEach(vinyl => {
                        const dimension = `${vinyl.width}x${vinyl.length}`
                        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + vinyl.quantity
                      })
                      
                      const allDimensions = Object.entries(dimensionGroups)
                        .map(([dimension, quantity]) => `${quantity} ${dimension}`)
                        .join(', ')
                      
                      const isTransfer = (row as any).isCombined || false
                      
                      return (
                        <TableRow key={`${row.orderId}${isTransfer ? '-transfer' : `-${row.assignmentType}`}`} className="print-item-group">
                          <TableCell className="text-xs">
                            {isTransfer && row.sequenceNumbers ? row.sequenceNumbers : row.sequenceNumber}
                          </TableCell>
                          <TableCell className="text-xs">
                            {isTransfer ? (
                              <span className="font-bold">{row.pickupName}</span>
                            ) : (
                              row.assignmentType === 'pickup' ? <span className="font-bold">{row.pickupName}</span> : row.pickupName
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {isTransfer ? (
                              <span className="font-bold">{row.deliveryName}</span>
                            ) : (
                              row.assignmentType === 'delivery' ? <span className="font-bold">{row.deliveryName}</span> : row.deliveryName
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{row.payingCustomerName || '—'}</TableCell>
                          <TableCell className="text-xs" style={{ width: '90px' }}>{row.freightQuote || '—'}</TableCell>
                          <TableCell className="text-xs text-right">{row.footage}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1 flex-wrap">
                              {allDimensions ? (
                                <>
                                  {Object.entries(dimensionGroups).map(([dimension, quantity], idx) => (
                                    <span key={idx} className="inline-block bg-gray-100 border border-gray-300 px-1 py-0.5 rounded text-xs font-mono">
                                      {quantity} {dimension}
                                    </span>
                                  ))}
                                  {freeItems > 0 && (
                                    <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 px-1 py-0.5 rounded text-xs font-semibold">
                                      <Gift className="h-2.5 w-2.5" />
                                      {freeItems}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span>—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {isTransfer ? (
                              <div className="text-xs text-blue-700 font-medium">Transfer</div>
                            ) : row.assignmentType === 'delivery' && row.pickupDriverName && row.pickupAssignmentDate ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                  {row.pickupDriverName !== selectedTruckload?.driver.driverName && (
                                    <AlertTriangle className="h-3 w-3 text-red-500 animate-[pulse_1s_ease-in-out_infinite]" />
                                  )}
                                </div>
                                <div>
                                  <div className="truncate">{row.pickupDriverName}</div>
                                  <div className="text-gray-500">{formatDateShort(row.pickupAssignmentDate)}</div>
                                </div>
                              </div>
                            ) : row.assignmentType === 'pickup' && row.deliveryDriverName && row.deliveryAssignmentDate ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                  {row.deliveryDriverName !== selectedTruckload?.driver.driverName && (
                                    <AlertTriangle className="h-3 w-3 text-red-500 animate-[pulse_1s_ease-in-out_infinite]" />
                                  )}
                                </div>
                                <div>
                                  <div className="truncate">{row.deliveryDriverName}</div>
                                  <div className="text-gray-500">{formatDateShort(row.deliveryAssignmentDate)}</div>
                                </div>
                              </div>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                </div>
                
                {/* Print View Totals Section - Second page: Freight and Totals */}
                {orders.length > 0 && (
                  <div className="mt-6 space-y-4 border-t-2 border-gray-400 pt-4 print-section print-page-break-before">
                    {/* Summary Totals */}
                    <div className="grid grid-cols-2 gap-4 mb-3 print-item-group">
                      <div className="border border-gray-300 rounded p-2">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Pickups</div>
                        <div className="text-xl font-bold">{totals.pickupCount}</div>
                      </div>
                      <div className="border border-gray-300 rounded p-2">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Deliveries</div>
                        <div className="text-xl font-bold">{totals.deliveryCount}</div>
                      </div>
                    </div>

                    {/* Cross-Driver Freight Section */}
                    <div className="print-allow-break">
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        Freight Handled by Other Drivers
                      </div>
                      {editableCrossDriverFreight.length === 0 ? (
                        <div className="text-sm text-gray-600 border border-gray-300 rounded p-2 print-item-group">
                          All freight handled by {selectedTruckload?.driver.driverName || 'selected driver'}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {editableCrossDriverFreight.map((item) => {
                            if (item.isManual) {
                              const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
                              const isAddition = item.isAddition || false
                              return (
                                <div key={item.id} className="border border-gray-300 rounded p-2 text-xs print-item-group">
                                  <div className="font-medium mb-1">{item.comment || 'Comment...'}</div>
                                  <div>
                                    {isAddition ? 'Addition' : 'Deduction'}: ${amount.toFixed(2)}
                                  </div>
                                </div>
                              )
                            } else {
                              return (
                                <div key={item.id} className="border border-gray-300 rounded p-2 text-xs print-item-group">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{item.driverName}</span>
                                    <span className="text-gray-500">-</span>
                                    <span>{formatDateShort(item.date)}</span>
                                    <span className="text-gray-500">-</span>
                                    <span className="font-medium">{item.action}</span>
                                    <span className="text-gray-500">-</span>
                                    <span>{item.footage} sqft</span>
                                    <span className="text-gray-500">-</span>
                                    <span>{item.dimensions}</span>
                                    <span className="text-gray-500">-</span>
                                    <span>Deduction: ${(typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              )
                            }
                          })}
                        </div>
                      )}
                    </div>

                    {/* Payroll Summary - Print View */}
                    <div className="mt-4 border-t-2 border-gray-400 pt-4 print-keep-together">
                      <div className="border-2 border-gray-400 rounded p-3">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Total Quotes</div>
                            <div className="text-lg font-bold">
                              ${totals.totalQuotes.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Total Quotes</div>
                            <div className="text-lg font-bold">
                              ${payrollCalculations.totalQuotes.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Manual Deductions (Load Value)</div>
                            <div className="text-lg font-bold text-red-600">
                              -${payrollCalculations.manualDeductionsFromLoadValue.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Manual Additions (Load Value)</div>
                            <div className="text-lg font-bold text-green-600">
                              +${payrollCalculations.manualAdditionsToLoadValue.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Load Value</div>
                            <div className="text-xl font-bold">
                              ${payrollCalculations.loadValue.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">
                              Base Driver Pay ({payrollCalculations.driverLoadPercentage.toFixed(0)}%)
                            </div>
                            <div className="text-lg font-bold text-blue-600">
                              ${payrollCalculations.baseDriverPay.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Automatic Deductions</div>
                            <div className="text-lg font-bold text-red-600">
                              -${payrollCalculations.automaticDeductions.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Manual Deductions (Driver Pay)</div>
                            <div className="text-lg font-bold text-red-600">
                              -${payrollCalculations.manualDeductionsFromDriverPay.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Manual Additions (Driver Pay)</div>
                            <div className="text-lg font-bold text-green-600">
                              +${payrollCalculations.manualAdditionsToDriverPay.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">
                              Final Driver Pay
                            </div>
                            <div className="text-xl font-bold text-blue-600">
                              ${payrollCalculations.finalDriverPay.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
        <EditTruckloadDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          truckloadId={selectedTruckloadId}
        />
        {selectedOrderIdForInfo !== null && (
          <OrderInfoDialog
            isOpen={isOrderInfoDialogOpen}
            onClose={() => setIsOrderInfoDialogOpen(false)}
            orderId={selectedOrderIdForInfo}
            onOrderUpdate={() => {
              // Refresh orders after saving
              if (selectedTruckloadId) {
                // trigger effect by resetting selection
                const id = selectedTruckloadId
                setSelectedTruckloadId(null)
                setTimeout(() => setSelectedTruckloadId(id), 0)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}


