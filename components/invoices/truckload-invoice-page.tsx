'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { Printer, Edit3, Search, MessageSquare, ChevronDown, ChevronRight, Check, Timer, Plus, Trash2, Gift, AlertTriangle, DollarSign } from 'lucide-react'
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
}

export default function TruckloadInvoicePage({}: TruckloadInvoicePageProps) {
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
  const [showAllQuotesFilled, setShowAllQuotesFilled] = useState<boolean>(false)
  const [deductByFootage, setDeductByFootage] = useState<boolean>(false)
  const [footageDeductionRate, setFootageDeductionRate] = useState<number>(0)
  const [updatingQuotes, setUpdatingQuotes] = useState<Set<string>>(new Set())
  const selectedTruckload = useMemo(() => truckloads.find(t => t.id === selectedTruckloadId) || null, [truckloads, selectedTruckloadId])
  const crossDriverFreightSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const editableCrossDriverFreightRef = useRef<CrossDriverFreightItem[]>([])
  
  // Keep ref in sync with state
  useEffect(() => {
    editableCrossDriverFreightRef.current = editableCrossDriverFreight
  }, [editableCrossDriverFreight])

  // Calculate totals for payroll
  const totals = useMemo(() => {
    const pickupCount = orders.filter(o => o.assignmentType === 'pickup').length
    const deliveryCount = orders.filter(o => o.assignmentType === 'delivery').length
    const totalQuotes = orders.reduce((sum, order) => {
      if (order.freightQuote) {
        // Parse quote string (could be "$123.45" or "123.45")
        const cleaned = order.freightQuote.replace(/[^0-9.-]/g, '')
        const value = parseFloat(cleaned)
        return sum + (isNaN(value) ? 0 : value)
      }
      return sum
    }, 0)
    return { pickupCount, deliveryCount, totalQuotes }
  }, [orders])

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

        // Helper to match items more precisely (driverName, date, action, dimensions, footage)
        const matchItem = (item1: CrossDriverFreightItem, item2: Omit<CrossDriverFreightItem, 'id' | 'deduction'>): boolean => {
          const date1 = normalizeDate(item1.date)
          const date2 = normalizeDate(item2.date)
          return item1.driverName === item2.driverName &&
                 date1 === date2 &&
                 item1.action === item2.action &&
                 item1.dimensions === item2.dimensions &&
                 Math.abs((item1.footage || 0) - (item2.footage || 0)) < 0.01 // Allow small floating point differences
        }
        
        // Use saved items as the source of truth - they have all the saved deductions
        // Then add any new auto-detected items that don't exist in saved items
        const savedNonManual = loadedItems.filter((item: CrossDriverFreightItem) => !item.isManual)
        const savedManual = loadedItems.filter((item: CrossDriverFreightItem) => item.isManual)
        
        // Build final list starting with saved items
        const finalItems: CrossDriverFreightItem[] = [...savedNonManual]
        
        // Add any new auto-detected items that aren't already saved
        if (crossDriverFreight.length > 0) {
          for (const autoItem of crossDriverFreight) {
            const exists = savedNonManual.some((saved: CrossDriverFreightItem) => matchItem(saved, autoItem))
            if (!exists) {
              // New auto-detected item, add with 0 deduction
              finalItems.push({
                ...autoItem,
                id: `auto-${Date.now()}-${Math.random()}`,
                deduction: 0,
                date: formatDateForInput(autoItem.date),
                isManual: false
              })
            }
          }
        }
        
        // Add manual items at the end
        finalItems.push(...savedManual)
        
        setEditableCrossDriverFreight(finalItems)
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

  // Calculate total deductions and final driver pay
  const payrollCalculations = useMemo(() => {
    const totalDeductions = editableCrossDriverFreight.reduce((sum, item) => {
      const deduction = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
      return sum + deduction
    }, 0)
    const finalDriverPay = (totals.totalQuotes || 0) - totalDeductions
    return { totalDeductions: Number(totalDeductions), finalDriverPay: Number(finalDriverPay) }
  }, [editableCrossDriverFreight, totals.totalQuotes])

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
  function addCrossDriverFreightItem(): void {
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

    try {
      const res = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-freight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: currentItems.map(item => ({
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
              comment: item.comment || ''
            }))
            
            console.log('Reloaded items from DB:', reloadedItems)
            
            // Helper to match items more precisely (driverName, date, action, dimensions, footage)
            const matchItem = (item1: CrossDriverFreightItem, item2: Omit<CrossDriverFreightItem, 'id' | 'deduction'>): boolean => {
              const date1 = normalizeDate(item1.date)
              const date2 = normalizeDate(item2.date)
              return item1.driverName === item2.driverName &&
                     date1 === date2 &&
                     item1.action === item2.action &&
                     item1.dimensions === item2.dimensions &&
                     Math.abs((item1.footage || 0) - (item2.footage || 0)) < 0.01 // Allow small floating point differences
            }
            
            // Use saved items as the source of truth - they have all the saved deductions
            // Then add any new auto-detected items that don't exist in saved items
            const savedNonManual = reloadedItems.filter((item: CrossDriverFreightItem) => !item.isManual)
            const savedManual = reloadedItems.filter((item: CrossDriverFreightItem) => item.isManual)
            
            // Build final list starting with saved items
            const finalItems: CrossDriverFreightItem[] = [...savedNonManual]
            
            // Add any new auto-detected items that aren't already saved
            if (crossDriverFreight.length > 0) {
              for (const autoItem of crossDriverFreight) {
                const exists = savedNonManual.some((saved: CrossDriverFreightItem) => matchItem(saved, autoItem))
                if (!exists) {
                  // New auto-detected item, add with 0 deduction
                  finalItems.push({
                    ...autoItem,
                    id: `auto-${Date.now()}-${Math.random()}`,
                    deduction: 0,
                    date: formatDateForInput(autoItem.date),
                    isManual: false
                  })
                }
              }
            }
            
            // Add manual items at the end
            finalItems.push(...savedManual)
            
            setEditableCrossDriverFreight(finalItems)
            console.log('Merged items (saved first, then new auto-detected):', finalItems)
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
          if (items.length > 0) setSelectedTruckloadId(items[0].id)
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
  }, [])

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
        // Apply quotes filled filter based on toggle
        if (showAllQuotesFilled) {
          // Show only truckloads with all quotes filled
          return i.allQuotesFilled === true
        } else {
          // Show only truckloads without all quotes filled
          return i.allQuotesFilled !== true
        }
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate)) // Sort descending for most recent first

    // If showing all quotes filled, limit to 5 newest
    if (showAllQuotesFilled) {
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
  }, [searchValue, truckloads, selectedDriverId, showAllQuotesFilled])

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
    const date = new Date(dateStr)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${month}/${day}/${year}`
  }

  return (
    <div className="flex h-full w-full gap-4">
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
          <Label htmlFor="quotes-toggle" className="text-xs cursor-pointer flex-1">
            {showAllQuotesFilled ? 'All Quotes Filled (5 newest)' : 'Missing Quotes'}
          </Label>
          <Switch
            id="quotes-toggle"
            checked={showAllQuotesFilled}
            onCheckedChange={setShowAllQuotesFilled}
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
                                    <Check className="h-4 w-4 text-green-600 mt-0.5" />
                                  ) : (
                                    <Timer className="h-4 w-4 text-yellow-600 mt-0.5" />
                                  )}
                                  {isCompleted && item.allQuotesFilled && (
                                    <DollarSign className="h-4 w-4 text-green-700 mt-0.5" />
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

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <div>
            <h2 className="text-xl font-semibold">Invoice Page</h2>
            <p className="text-sm text-gray-500">Select a truckload to view assigned orders.</p>
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
                    {orders.map((row) => {
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
                      
                      return (
                        <TableRow 
                          key={`${row.orderId}-${row.assignmentType}`} 
                          className={`${row.assignmentType === 'pickup' ? 'bg-red-50' : 'bg-gray-50'} hover:bg-gray-300 transition-colors cursor-pointer hover:shadow-sm`}
                        >
                          <TableCell className="text-sm text-center">{row.sequenceNumber}</TableCell>
                          <TableCell className="text-sm">{row.assignmentType === 'pickup' ? <span className="font-bold">{row.pickupName}</span> : row.pickupName}</TableCell>
                          <TableCell className="text-sm">{row.assignmentType === 'delivery' ? <span className="font-bold">{row.deliveryName}</span> : row.deliveryName}</TableCell>
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
                            {row.assignmentType === 'delivery' && row.pickupDriverName && row.pickupAssignmentDate ? (
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
                          All freight handled by {selectedTruckload?.driver.driverName || 'selected driver'}
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
                            <div className="text-xs font-medium text-gray-600 mb-0.5">Final Driver Pay</div>
                            <div className="text-xl font-bold">
                              ${payrollCalculations.finalDriverPay.toFixed(2)}
                            </div>
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
                    {orders.map((row) => {
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
                      
                      return (
                        <TableRow key={`${row.orderId}-${row.assignmentType}`} className="print-item-group">
                          <TableCell className="text-xs">{row.sequenceNumber}</TableCell>
                          <TableCell className="text-xs">{row.assignmentType === 'pickup' ? <span className="font-bold">{row.pickupName}</span> : row.pickupName}</TableCell>
                          <TableCell className="text-xs">{row.assignmentType === 'delivery' ? <span className="font-bold">{row.deliveryName}</span> : row.deliveryName}</TableCell>
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
                            {row.assignmentType === 'delivery' && row.pickupDriverName && row.pickupAssignmentDate ? (
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
                              return (
                                <div key={item.id} className="border border-gray-300 rounded p-2 text-xs print-item-group">
                                  <div className="font-medium mb-1">{item.comment || 'Comment...'}</div>
                                  <div>Deduction: ${(typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0).toFixed(2)}</div>
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
                            <div className="text-xs font-medium text-gray-600 mb-1">Total Deductions</div>
                            <div className="text-lg font-bold text-red-600">
                              -${payrollCalculations.totalDeductions.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Final Driver Pay</div>
                            <div className="text-xl font-bold">
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


