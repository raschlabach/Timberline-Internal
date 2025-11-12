"use client"

import { useRouter } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { TruckloadSummary } from "@/types/truckloads"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { User, Calendar, Truck, Tag, FileText, Pencil, MoreVertical, ArrowRight, X, Hash, Check } from "lucide-react"
import { useState, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner'
import { TruckloadDetailsCard } from "./truckload-details-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { TransferStopDialog } from "@/components/truckloads/transfer-stop-dialog"

interface TruckloadSidebarListProps {
  truckloadId: number
}

interface TruckloadStop {
  id: number
  assignment_type: 'pickup' | 'delivery'
  sequence_number: number
  stop_completed: boolean
  status: string
  order_id: number
  pickup_customer: {
    id: number
    name: string
    address: string
    phone?: string
    phone2?: string
  }
  delivery_customer: {
    id: number
    name: string
    address: string
    phone?: string
    phone2?: string
  }
  skids: number
  vinyl: number
  footage: number
  skids_data: any[]
  vinyl_data: any[]
  pickup_date: string
  is_rush: boolean
  needs_attention: boolean
  comments: string
  freight_quote: string
  is_transfer_order: boolean
}

export function TruckloadSidebarList({ truckloadId }: TruckloadSidebarListProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState<{
    driver: boolean
    description: boolean
    bol: boolean
    trailer: boolean
    dates: boolean
  }>({
    driver: false,
    description: false,
    bol: false,
    trailer: false,
    dates: false
  })
  const [editValues, setEditValues] = useState({
    driver: '',
    description: '',
    bol: '',
    trailer: '',
    startDate: '',
    endDate: ''
  })
  const [drivers, setDrivers] = useState<{ id: number; full_name: string; color: string }[]>([])
  const [selectedStop, setSelectedStop] = useState<TruckloadStop | null>(null)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [isSequenceDialogOpen, setIsSequenceDialogOpen] = useState(false)
  const [newSequenceNumber, setNewSequenceNumber] = useState<number>(0)
  const [isOptimizeDialogOpen, setIsOptimizeDialogOpen] = useState(false)
  const [optimizedStops, setOptimizedStops] = useState<TruckloadStop[]>([])
  const [currentRouteMetrics, setCurrentRouteMetrics] = useState<{ distance: string; duration: string } | null>(null)
  const [optimizedRouteMetrics, setOptimizedRouteMetrics] = useState<{ distance: string; duration: string } | null>(null)
  const queryClient = useQueryClient()

  const { data: truckload } = useQuery({
    queryKey: ["truckload", truckloadId],
    queryFn: async () => {
      const response = await fetch(`/api/truckloads/${truckloadId}`)
      if (!response.ok) throw new Error("Failed to fetch truckload")
      const data = await response.json()
      if (!data.success) throw new Error("Failed to fetch truckload")
      return data.truckload
    }
  })

  const { data: stopsData, isLoading, error } = useQuery<TruckloadStop[]>({
    queryKey: ["truckload-stops", truckloadId],
    queryFn: async () => {
      const response = await fetch(`/api/truckloads/${truckloadId}/orders`)
      if (!response.ok) throw new Error("Failed to fetch stops")
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to fetch stops")
      return data.orders
    }
  })

  const stops = stopsData || []

  // Debug: Log when stops data changes
  useEffect(() => {
    console.log('🔄 Sidebar stops data updated:', {
      stopsCount: stops.length,
      stops: stops.map(s => ({ id: s.id, type: s.assignment_type, sequence: s.sequence_number }))
    })
  }, [stops])

  // Sort stops by sequence number
  const sortedStops = [...stops].sort((a: TruckloadStop, b: TruckloadStop) => 
    a.sequence_number - b.sequence_number
  )

  // Calculate total footage
  const totalFootage = sortedStops.reduce((total: number, stop: TruckloadStop) => {
    return total + (stop.footage || 0)
  }, 0)

  const updateTruckload = useMutation({
    mutationFn: async (updates: any) => {
      const response = await fetch(`/api/truckloads/${truckloadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error("Failed to update truckload")
      const data = await response.json()
      if (!data.success) throw new Error("Failed to update truckload")
      return data.truckload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["truckload", truckloadId] })
      toast.success('Truckload updated successfully')
    },
    onError: (error) => {
      toast.error('Failed to update truckload')
      console.error('Update error:', error)
    },
  })

  useEffect(() => {
    if (isEditing.driver) {
      fetchDrivers()
    }
    async function fetchDrivers() {
      try {
        const response = await fetch('/api/drivers')
        if (!response.ok) throw new Error('Failed to fetch drivers')
        const data = await response.json()
        if (!data.drivers) throw new Error('Invalid response format from drivers API')
        setDrivers(data.drivers)
      } catch (error) {
        toast.error('Failed to fetch drivers')
      }
    }
  }, [isEditing.driver])

  // Calculate current route metrics when optimization dialog opens
  useEffect(() => {
    if (isOptimizeDialogOpen && stops.length > 0) {
      // Calculate current route metrics (simple estimation)
      const currentMetrics = {
        distance: 'Calculating...',
        duration: 'Calculating...'
      }
      setCurrentRouteMetrics(currentMetrics)
      
      // In a real implementation, you could call an API to calculate current route
      // For now, we'll show placeholder values
    }
  }, [isOptimizeDialogOpen, stops])

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-red-500">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-base">Error loading truckload: {error instanceof Error ? error.message : error}</p>
      </div>
    )
  }

  if (!truckload) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500">
        <p className="text-base">Truckload not found</p>
      </div>
    )
  }
                  
  const handleEdit = (field: keyof typeof isEditing | 'dates') => {
    setIsEditing(prev => ({ ...prev, [field]: true }))
    setEditValues(prev => {
      if (field === 'dates') {
        return {
          ...prev,
          startDate: truckload?.startDate ? truckload.startDate.slice(0, 10) : '',
          endDate: truckload?.endDate ? truckload.endDate.slice(0, 10) : '',
        }
      }
      return {
      ...prev,
      [field]: truckload?.[field === 'bol' ? 'billOfLadingNumber' : field === 'trailer' ? 'trailerNumber' : field] || ''
      }
    })
  }

  const handleSave = async (field: keyof typeof isEditing | 'dates') => {
    try {
      // Validation
      if (field === 'dates') {
        if (editValues.startDate && editValues.endDate) {
          const startDate = new Date(editValues.startDate)
          const endDate = new Date(editValues.endDate)
          if (startDate > endDate) {
            toast.error('Start date cannot be after end date')
            return
          }
        }
      }
      
      if (field === 'driver' && !editValues.driver) {
        toast.error('Please select a driver')
        return
      }

      let updates: any = {}
      if (field === 'driver') {
        updates.driverId = editValues.driver ? parseInt(editValues.driver) : null
      } else if (field === 'bol') {
        updates.bill_of_lading_number = editValues.bol
      } else if (field === 'trailer') {
        updates.trailer_number = editValues.trailer
      } else if (field === 'dates') {
        updates.startDate = editValues.startDate ? new Date(editValues.startDate).toISOString() : null
        updates.endDate = editValues.endDate ? new Date(editValues.endDate).toISOString() : null
      } else {
        // Only allow string keys that exist in editValues
        if (field in editValues) {
          updates[field] = (editValues as any)[field]
        }
      }
      
      await updateTruckload.mutateAsync(updates)
      setIsEditing(prev => ({ ...prev, [field]: false }))
    } catch (error) {
      console.error('Error saving field:', error)
      // Error handling is already done in the mutation
    }
  }

  const handleCancel = (field: keyof typeof isEditing | 'dates') => {
    setIsEditing(prev => ({ ...prev, [field]: false }))
  }

  const handleUnassignStop = async () => {
    if (!selectedStop) return

    try {
      const response = await fetch(`/api/truckloads/${truckloadId}/orders/${selectedStop.id}/unassign`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to unassign stop')
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to unassign stop')

      toast.success('Stop unassigned successfully')
      // Invalidate the stops query to trigger a refresh
      queryClient.invalidateQueries({ queryKey: ["truckload-stops", truckloadId] })
    } catch (error) {
      toast.error('Failed to unassign stop')
    }
  }

  const handleOptimizeOrder = async () => {
    if (stops.length === 0) return

    try {
      console.log('🔄 Starting route optimization...')
      console.log('📍 Stops to optimize:', stops.length)
      
      // Open the dialog first so user can see the comparison
      setIsOptimizeDialogOpen(true)
      
      // Create waypoints data for the API
      const waypointsData = stops.map(stop => {
        const customer = stop.assignment_type === 'pickup' 
          ? stop.pickup_customer 
          : stop.delivery_customer
        
        if (!customer) {
          console.warn('⚠️ No customer data for stop:', stop)
          return null
        }
        
        // Use the address as provided - it should already be formatted
        const fullAddress = customer.address
        
        if (!fullAddress) {
          console.warn('⚠️ No address found for customer:', customer)
          return null
        }
        
        return {
          id: `${stop.id}-${stop.assignment_type}`, // Composite ID to handle same order as pickup/delivery
          assignment_type: stop.assignment_type,
          address: fullAddress,
          sequence_number: stop.sequence_number
        }
      }).filter(Boolean)
      
      if (waypointsData.length === 0) {
        toast.error('No valid addresses found for optimization')
        return
      }
      
      console.log('📍 Waypoints data prepared:', waypointsData.length)
      console.log('📍 Sample waypoint:', waypointsData[0])
      
      // Call our API endpoint for route optimization
      console.log('🔄 Calling optimization API...')
      const response = await fetch('/api/truckloads/optimize-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: "1350 County Road 108, Sugarcreek, OH 44687", // Timberline Warehouse
          destination: "1350 County Road 108, Sugarcreek, OH 44687", // Timberline Warehouse
          waypoints: waypointsData
        }),
      })
      
      console.log('📡 API response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('📡 API response data:', data)
      console.log('📊 Route info details:', {
        routeInfo: data.routeInfo,
        currentRouteInfo: data.currentRouteInfo,
        source: data.source,
        note: data.note
      })
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to optimize route')
      }
      
      console.log('✅ Route optimization successful:', data)
      console.log('🔍 Optimization details:', {
        optimizationApplied: data.optimizationApplied,
        currentRoute: data.currentRouteInfo,
        optimizedRoute: data.routeInfo,
        waypointsCount: data.optimizedOrder?.length || 0
      })
      
      // Store route metrics
      if (data.routeInfo) {
        setOptimizedRouteMetrics({
          distance: data.routeInfo.totalDistance,
          duration: data.routeInfo.totalDuration
        })
      }
      
      // Store current route metrics
      if (data.currentRouteInfo) {
        setCurrentRouteMetrics({
          distance: data.currentRouteInfo.totalDistance,
          duration: data.currentRouteInfo.totalDuration
        })
      }
      
      // Warn if optimization didn't improve the route
      if (data.optimizationApplied && data.routeInfo && data.currentRouteInfo) {
        const currentDistance = parseFloat(data.currentRouteInfo.totalDistance.replace(' mi', ''))
        const optimizedDistance = parseFloat(data.routeInfo.totalDistance.replace(' mi', ''))
        
        if (optimizedDistance >= currentDistance) {
          console.warn('⚠️ Route optimization did not improve distance!', {
            current: data.currentRouteInfo.totalDistance,
            optimized: data.routeInfo.totalDistance
          })
        }
      }
      
      // Create optimized stops array based on the optimized order
      console.log('🔍 Creating optimized stops array...')
      console.log('🔍 Available stops:', stops.map(s => ({ 
        id: s.id, 
        address: s.assignment_type === 'pickup' ? s.pickup_customer.address : s.delivery_customer.address, 
        type: s.assignment_type,
        pickup_customer: s.pickup_customer.name,
        delivery_customer: s.delivery_customer.name
      })))
      console.log('🔍 Optimized waypoints from API:', data.optimizedOrder)
      
      const optimized = data.optimizedOrder.map((waypoint: any, index: number) => {
        // Match by composite ID (e.g., "22-pickup" matches order 22 with pickup assignment)
        const [orderId, assignmentType] = waypoint.id.split('-')
        const originalStop = stops.find(s => 
          s.id.toString() === orderId && 
          s.assignment_type === assignmentType
        )
        
        console.log(`🔍 Matching waypoint ${index + 1}:`, { 
          waypoint, 
          parsedId: { orderId, assignmentType },
          foundStop: originalStop,
          waypointType: waypoint.assignment_type,
          originalType: originalStop?.assignment_type
        })
        
        if (!originalStop) {
          console.warn('⚠️ Could not find original stop for optimized waypoint:', waypoint)
          return null
        }
        
        // Ensure we preserve the original assignment type from the original stop
        const optimizedStop = {
          ...originalStop,
          sequence_number: index + 1
        }
        
        console.log(`✅ Created optimized stop ${index + 1}:`, {
          id: optimizedStop.id,
          type: optimizedStop.assignment_type,
          pickup_customer: optimizedStop.pickup_customer.name,
          delivery_customer: optimizedStop.delivery_customer.name,
          sequence: optimizedStop.sequence_number
        })
        
        return optimizedStop
      }).filter(Boolean)
      
      console.log('🔍 Final optimized stops array:', optimized.map((s: TruckloadStop) => ({
        id: s.id,
        type: s.assignment_type,
        pickup_customer: s.pickup_customer.name,
        delivery_customer: s.delivery_customer.name,
        sequence: s.sequence_number
      })))
      
      if (optimized.length === 0) {
        throw new Error('Failed to create optimized stops array')
      }
      
      setOptimizedStops(optimized)
      
      toast.success('Route optimization completed successfully!')
      
    } catch (error) {
      console.error('❌ Route optimization failed:', error)
      toast.error(`Failed to optimize route: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleUpdateSequence = async () => {
    if (!selectedStop || !newSequenceNumber) return

    try {
      console.log('🔄 Updating sequence for stop:', {
        id: selectedStop.id,
        assignment_type: selectedStop.assignment_type,
        currentSequence: selectedStop.sequence_number,
        newSequence: newSequenceNumber
      })
      
      // Create a new array with the updated sequence
      const newStops = [...stops]
      
      // Find the stop to move by matching both ID and assignment type
      const oldIndex = newStops.findIndex(s => 
        s.id === selectedStop.id && s.assignment_type === selectedStop.assignment_type
      )
      
      console.log('🔍 Found stop at index:', oldIndex)
      
      if (oldIndex === -1) {
        toast.error('Could not find the selected stop')
        return
      }
      
      // Find the target position by sequence number
      const newIndex = newStops.findIndex(s => s.sequence_number === newSequenceNumber)
      
      console.log('🔍 Target position index:', newIndex)
      
      if (newIndex === -1) {
        toast.error('Invalid sequence number')
        return
      }
      
      // Move the stop to its new position
      const [movedStop] = newStops.splice(oldIndex, 1)
      newStops.splice(newIndex, 0, movedStop)

      // Update sequence numbers for all stops
      const updatedStops = newStops.map((stop, index) => ({
        ...stop,
        sequence_number: index + 1
      }))

      console.log('📤 Sending reorder request with stops:', updatedStops.map(s => ({
        id: s.id,
        assignment_type: s.assignment_type,
        sequence_number: s.sequence_number
      })))

      const response = await fetch(`/api/truckloads/${truckloadId}/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orders: updatedStops.map(stop => ({
            id: stop.id,
            assignment_type: stop.assignment_type,
            sequence_number: stop.sequence_number
          }))
        }),
      })

      if (!response.ok) throw new Error('Failed to update sequence')
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to update sequence')

      console.log('✅ Sequence updated successfully')
      toast.success('Sequence updated successfully')
      setIsSequenceDialogOpen(false)
      // Invalidate the stops query to trigger a refresh
      queryClient.invalidateQueries({ queryKey: ["truckload-stops", truckloadId] })
    } catch (error) {
      console.error('❌ Sequence update failed:', error)
      toast.error('Failed to update sequence')
    }
  }

  // In the sequence dialog
  const availableSequenceNumbers = sortedStops
    .filter((s: TruckloadStop) => 
      s.id !== selectedStop?.id || s.assignment_type !== selectedStop?.assignment_type
    )
    .map((s: TruckloadStop) => s.sequence_number)

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col relative">
      <div className="p-4 space-y-4 flex-1 flex flex-col justify-start">
        <div className="space-y-4">
          {/* Truckload Details Card */}
          <TruckloadDetailsCard 
            truckload={{
              id: truckload.id,
              driverName: truckload.driverName,
              driverColor: truckload.driverColor,
              startDate: truckload.startDate,
              endDate: truckload.endDate,
              description: truckload.description,
              billOfLadingNumber: truckload.billOfLadingNumber,
              trailerNumber: truckload.trailerNumber,
              isCompleted: truckload.isCompleted
            }}
            onTruckloadUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ["truckload", truckloadId] })
            }}
          />

          {/* Stops Section */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Stops</h3>
              {stops.length > 0 && (
                <Button
                  onClick={handleOptimizeOrder}
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1 h-7"
                >
                  Optimize Order
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {sortedStops.map((stop) => (
                <div
                  key={`${stop.id}-${stop.assignment_type}`}
                  className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                    stop.assignment_type === 'pickup' ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                >
                  <span className="text-gray-500 w-4 text-right">{stop.sequence_number}</span>
                  <div className={`w-2 h-2 rounded-full ${
                    stop.assignment_type === 'pickup' ? 'bg-red-500' : 'bg-black'
                  }`} />
                  <span className="font-medium flex-1">
                    {stop.assignment_type === 'pickup' 
                      ? stop.pickup_customer.name 
                      : stop.delivery_customer.name}
                  </span>
                  <span className="text-gray-500">
                    {stop.footage?.toLocaleString()} ft²
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setSelectedStop(stop)
                        setIsTransferDialogOpen(true)
                      }}>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Transfer to Another Truck
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setSelectedStop(stop)
                        setIsSequenceDialogOpen(true)
                        setNewSequenceNumber(stop.sequence_number)
                      }}>
                        <Hash className="h-4 w-4 mr-2" />
                        Change Sequence
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => {
                          setSelectedStop(stop)
                          handleUnassignStop()
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Unassign Stop
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>

          {/* Stop Summary */}
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-2">Stop Summary</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-red-50 p-2 rounded">
                <div className="text-sm font-medium text-red-600">Pickups</div>
                <div className="text-lg font-bold">{sortedStops.filter(s => s.assignment_type === 'pickup' && !s.is_transfer_order).length}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-sm font-medium text-gray-900">Deliveries</div>
                <div className="text-lg font-bold">{sortedStops.filter(s => s.assignment_type === 'delivery' && !s.is_transfer_order).length}</div>
              </div>
              <div className="bg-blue-50 p-2 rounded">
                <div className="text-sm font-medium text-blue-600">Transfers</div>
                <div className="text-lg font-bold">{sortedStops.filter(s => s.is_transfer_order).length}</div>
              </div>
            </div>
          </Card>

          {/* Footage Summary */}
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-2">Footage Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600">Pickups</span>
                <span className="font-medium">
                  {sortedStops
                    .filter(s => s.assignment_type === 'pickup' && !s.is_transfer_order)
                    .reduce((total, stop) => total + Number(stop.footage || 0), 0)
                    .toLocaleString()} ft²
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-900">Deliveries</span>
                <span className="font-medium">
                  {sortedStops
                    .filter(s => s.assignment_type === 'delivery' && !s.is_transfer_order)
                    .reduce((total, stop) => total + Number(stop.footage || 0), 0)
                    .toLocaleString()} ft²
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-600">Transfers</span>
                <span className="font-medium">
                  {sortedStops
                    .filter(s => s.is_transfer_order)
                    .reduce((acc, stop) => {
                      const assignmentId = stop.id
                      if (!acc.processedOrders.has(assignmentId)) {
                        acc.processedOrders.add(assignmentId)
                        acc.total += Number(stop.footage || 0)
                      }
                      return acc
                    }, { total: 0, processedOrders: new Set<number>() })
                    .total
                    .toLocaleString()} ft²
                </span>
              </div>
            </div>
          </Card>

          {/* Transfer Dialog */}
          <TransferStopDialog
            isOpen={isTransferDialogOpen}
            onClose={() => setIsTransferDialogOpen(false)}
            onTransferComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["truckload-stops", truckloadId] })
            }}
            currentTruckloadId={truckloadId}
            orderId={selectedStop?.id || 0}
            assignmentType={selectedStop?.assignment_type || 'pickup'}
          />

          {/* Sequence Dialog */}
          <Dialog open={isSequenceDialogOpen} onOpenChange={setIsSequenceDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Sequence Number</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-gray-500">
                  Enter the new sequence number for this stop:
                </div>
                <Input
                  type="number"
                  value={newSequenceNumber}
                  onChange={(e) => setNewSequenceNumber(parseInt(e.target.value))}
                  min={1}
                />
                <Button onClick={handleUpdateSequence}>Update Sequence</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Optimization Dialog */}
          <Dialog open={isOptimizeDialogOpen} onOpenChange={setIsOptimizeDialogOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Route Optimization</DialogTitle>
                <DialogDescription>
                  Compare current route order with optimized route order
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6">
                {/* Current Order */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-800">Current Order</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {sortedStops.map((stop, index) => (
                      <div
                        key={`current-${stop.id}-${stop.assignment_type}`}
                        className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                          stop.assignment_type === 'pickup' ? 'bg-red-50' : 'bg-gray-50'
                        }`}
                      >
                        <span className="text-gray-500 w-6 text-right font-medium">{index + 1}</span>
                        <div className={`w-2 h-2 rounded-full ${
                          stop.assignment_type === 'pickup' ? 'bg-red-500' : 'bg-black'
                        }`} />
                        <span className="font-medium flex-1">
                          {stop.assignment_type === 'pickup' 
                            ? stop.pickup_customer.name 
                            : stop.delivery_customer.name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {stop.footage?.toLocaleString()} ft²
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Current Route Metrics */}
                  {currentRouteMetrics && (
                    <div className="pt-3 border-t border-gray-200 bg-gray-50 p-3 rounded-md">
                      <h4 className="font-medium text-gray-800 text-sm mb-2">Route Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-600">Total Distance:</span>
                          <div className="font-semibold text-gray-800">{currentRouteMetrics.distance}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Duration:</span>
                          <div className="font-semibold text-gray-800">{currentRouteMetrics.duration}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        📍 Manual sequence order
                      </div>
                    </div>
                  )}
                </div>

                {/* Optimized Order */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-800">Optimized Order</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {optimizedStops.map((stop, index) => (
                      <div
                        key={`optimized-${stop.id}-${stop.assignment_type}`}
                        className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                          stop.assignment_type === 'pickup' ? 'bg-red-50' : 'bg-gray-50'
                        }`}
                      >
                        <span className="text-gray-500 w-6 text-right font-medium">{index + 1}</span>
                        <div className={`w-2 h-2 rounded-full ${
                          stop.assignment_type === 'pickup' ? 'bg-red-500' : 'bg-black'
                        }`} />
                        <span className="font-medium flex-1">
                          {stop.assignment_type === 'pickup' 
                            ? stop.pickup_customer.name 
                            : stop.delivery_customer.name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {stop.footage?.toLocaleString()} ft²
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Optimized Route Metrics */}
                  {optimizedRouteMetrics && currentRouteMetrics && (
                    <div className={`pt-3 border-t border-gray-200 p-3 rounded-md ${
                      (() => {
                        const currentDistance = parseFloat(currentRouteMetrics.distance.replace(' mi', ''))
                        const optimizedDistance = parseFloat(optimizedRouteMetrics.distance.replace(' mi', ''))
                        return optimizedDistance < currentDistance ? 'bg-green-50' : 'bg-yellow-50'
                      })()
                    }`}>
                      <h4 className="font-medium text-gray-800 text-sm mb-2">Route Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-600">Total Distance:</span>
                          <div className="font-semibold text-gray-800">{optimizedRouteMetrics.distance}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Duration:</span>
                          <div className="font-semibold text-gray-800">{optimizedRouteMetrics.duration}</div>
                        </div>
                      </div>
                      <div className={`mt-2 text-xs px-2 py-1 rounded ${
                        (() => {
                          const currentDistance = parseFloat(currentRouteMetrics.distance.replace(' mi', ''))
                          const optimizedDistance = parseFloat(optimizedRouteMetrics.distance.replace(' mi', ''))
                          if (optimizedDistance < currentDistance) {
                            return 'text-green-700 bg-green-100'
                          } else if (optimizedDistance > currentDistance) {
                            return 'text-yellow-700 bg-yellow-100'
                          } else {
                            return 'text-blue-700 bg-blue-100'
                          }
                        })()
                      }`}>
                        {(() => {
                          const currentDistance = parseFloat(currentRouteMetrics.distance.replace(' mi', ''))
                          const optimizedDistance = parseFloat(optimizedRouteMetrics.distance.replace(' mi', ''))
                          if (optimizedDistance < currentDistance) {
                            return '✅ Distance improved!'
                          } else if (optimizedDistance > currentDistance) {
                            return '⚠️ Distance increased (but may be faster)'
                          } else {
                            return '🔄 Same distance, different route'
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsOptimizeDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      // Apply the current order (keep as is)
                      const response = await fetch(`/api/truckloads/${truckloadId}/reorder`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          orders: sortedStops.map(stop => ({
                            id: stop.id,
                            assignment_type: stop.assignment_type,
                            sequence_number: stop.sequence_number
                          }))
                        }),
                      })
                      
                      if (!response.ok) throw new Error('Failed to apply current order')
                      const data = await response.json()
                      if (!data.success) throw new Error(data.error || 'Failed to apply current order')
                      
                      toast.success('Current order applied successfully')
                      setIsOptimizeDialogOpen(false)
                      queryClient.invalidateQueries({ queryKey: ["truckload-stops", truckloadId] })
                    } catch (error) {
                      toast.error('Failed to apply current order')
                    }
                  }}
                >
                  Keep Current Order
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      // Apply the optimized order
                      const response = await fetch(`/api/truckloads/${truckloadId}/reorder`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          orders: optimizedStops.map(stop => ({
                            id: stop.id, // This is the original numeric ID, not the composite one
                            assignment_type: stop.assignment_type,
                            sequence_number: stop.sequence_number
                          }))
                        }),
                      })

                      if (!response.ok) throw new Error('Failed to apply optimized order')
                      const data = await response.json()
                      if (!data.success) throw new Error(data.error || 'Failed to apply optimized order')

                      toast.success('Optimized order applied successfully')
                      setIsOptimizeDialogOpen(false)
                      
                      // Invalidate queries to refresh the data
                      queryClient.invalidateQueries({ queryKey: ["truckload-stops", truckloadId] })
                    } catch (error) {
                      toast.error('Failed to apply optimized order')
                    }
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600"
                >
                  Apply Optimized Order
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
} 