'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from 'date-fns';
import { 
  Loader2, 
  Info, 
  Plus,
  Truck, 
  MapPin, 
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter, usePathname } from 'next/navigation'
import { CreateTruckloadDialog } from "@/components/truckloads/create-truckload-dialog";
import { EditTruckloadDialog } from "@/components/truckloads/edit-truckload-dialog";
import { ManageDriversDialog } from "@/components/drivers/manage-drivers-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Driver {
  id: number;
  full_name: string;
  color: string;
}

interface TruckloadSummary {
  id: number;
  driverId: number;
  startDate: string;
  endDate: string;
  trailerNumber: string;
  billOfLadingNumber: string;
  description: string;
  isCompleted: boolean;
  totalMileage: number;
  estimatedDuration: number;
  driverName: string;
  driverColor: string;
  pickupFootage: number;
  deliveryFootage: number;
  transferFootage: number;
}

export default function TruckloadManager() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: driversData, isLoading: isLoadingDrivers, isError: isErrorDrivers, isFetching: isFetchingDrivers, refetch: refetchDrivers } = useQuery<{ drivers: Driver[] }>({
    queryKey: ['drivers'],
    queryFn: async () => {
      const response = await fetch('/api/drivers')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch drivers: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch drivers')
      }
      // Return the data in the expected format
      return { drivers: data.drivers || [] }
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 30000, // Consider data fresh for 30 seconds
  })

  const { data: truckloadsData, isLoading: isLoadingTruckloads, isError: isErrorTruckloads, isFetching: isFetchingTruckloads, refetch: refetchTruckloads } = useQuery<{ truckloads: TruckloadSummary[] }>({
    queryKey: ['truckloads'],
    queryFn: async () => {
      const response = await fetch('/api/truckloads')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch truckloads: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch truckloads')
      }
      // Return the data in the expected format
      return { truckloads: data.truckloads || [] }
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 30000, // Consider data fresh for 30 seconds
  })

  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedTruckload, setSelectedTruckload] = useState<TruckloadSummary | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null)
  const [driverToggleStates, setDriverToggleStates] = useState<Record<number, boolean>>({})
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [driverOrder, setDriverOrder] = useState<number[]>([])
  const [selectedDrivers, setSelectedDrivers] = useState<Set<number>>(new Set())

  const queryClient = useQueryClient()

  // Set up beforeunload listener to mark refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Mark that we're about to refresh/reload
      sessionStorage.setItem('truckloadManager_isRefreshing', 'true')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Load driver order and selected drivers from localStorage on mount
  useEffect(() => {
    if (!driversData?.drivers) return
    
    // Load driver order (always load this, it's not affected by refresh)
    const savedOrder = localStorage.getItem('truckloadManager_driverOrder')
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder)
        // Validate that all current drivers are in the saved order
        const driverIds = new Set(driversData.drivers.map(d => d.id))
        const savedIds = new Set(parsed)
        
        // If saved order has all current drivers, use it
        if (parsed.every((id: number) => driverIds.has(id)) && 
            Array.from(driverIds).every(id => savedIds.has(id))) {
          setDriverOrder(parsed)
        } else {
          // Initialize with alphabetical order
          const sorted = [...driversData.drivers].sort((a, b) => 
            a.full_name.localeCompare(b.full_name)
          )
          setDriverOrder(sorted.map(d => d.id))
        }
      } catch (e) {
        console.error('Failed to parse saved driver order:', e)
        // Initialize with alphabetical order
        const sorted = [...driversData.drivers].sort((a, b) => 
          a.full_name.localeCompare(b.full_name)
        )
        setDriverOrder(sorted.map(d => d.id))
      }
    } else {
      // Initialize with alphabetical order
      const sorted = [...driversData.drivers].sort((a, b) => 
        a.full_name.localeCompare(b.full_name)
      )
      setDriverOrder(sorted.map(d => d.id))
    }

    // Load selected drivers from localStorage (but NOT on refresh)
    // Check if this was a refresh using the beforeunload flag
    if (typeof window !== 'undefined') {
      const isRefreshing = sessionStorage.getItem('truckloadManager_isRefreshing') === 'true'
      
      // Clear the refresh flag after checking
      sessionStorage.removeItem('truckloadManager_isRefreshing')
      
      // Only load from localStorage if this was NOT a refresh
      // On refresh, start with empty selection
      // On navigation from another page, restore selection
      if (!isRefreshing) {
        const savedSelected = localStorage.getItem('truckloadManager_selectedDrivers')
        if (savedSelected) {
          try {
            const parsed = JSON.parse(savedSelected)
            // Validate that all saved driver IDs still exist
            const driverIds = new Set(driversData.drivers.map(d => d.id))
            const validIds = parsed.filter((id: number) => driverIds.has(id))
            if (validIds.length > 0) {
              setSelectedDrivers(new Set(validIds))
            }
          } catch (e) {
            console.error('Failed to parse saved selected drivers:', e)
          }
        }
      }
      // If isRefreshing was true, we start with empty selection (default state)
    }
  }, [driversData?.drivers])

  // Save driver order to localStorage whenever it changes
  useEffect(() => {
    if (driverOrder.length > 0) {
      localStorage.setItem('truckloadManager_driverOrder', JSON.stringify(driverOrder))
    }
  }, [driverOrder])

  // Save selected drivers to localStorage whenever it changes
  useEffect(() => {
    // Only save if we have drivers data loaded (avoid saving empty state on initial mount)
    if (driversData?.drivers && driversData.drivers.length > 0) {
      if (selectedDrivers.size > 0) {
        localStorage.setItem('truckloadManager_selectedDrivers', JSON.stringify(Array.from(selectedDrivers)))
      } else {
        // Keep the last saved selection, don't remove it
        // This way if user deselects all, we can still restore on navigation
      }
    }
  }, [selectedDrivers, driversData?.drivers])


  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Helper function to toggle individual driver's view
  const toggleDriverView = (driverId: number) => {
    setDriverToggleStates(prev => ({
      ...prev,
      [driverId]: !prev[driverId] // Toggle the state, defaulting to true if undefined
    }))
  }

  // Toggle driver selection
  const toggleDriverSelection = (driverId: number) => {
    setSelectedDrivers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(driverId)) {
        newSet.delete(driverId)
      } else {
        newSet.add(driverId)
      }
      return newSet
    })
  }

  const updateTruckloadStatus = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number, isCompleted: boolean }) => {
      const endpoint = isCompleted ? 'complete' : 'uncomplete'
      const response = await fetch(`/api/truckloads/${id}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (!response.ok) {
        const errorData = await response.json()
        const action = isCompleted ? 'complete' : 'uncomplete'
        throw new Error(`Failed to ${action} truckload: ${errorData.error || 'Unknown error'}`)
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truckloads'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
  })


  // Show loading state if initial load, fetching, or retrying after an error
  const isRetrying = (isFetchingDrivers || isFetchingTruckloads) && (isErrorDrivers || isErrorTruckloads)
  const shouldShowLoading = isLoadingDrivers || isLoadingTruckloads || isRetrying
  
  if (shouldShowLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="min-w-[320px] flex-shrink-0">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <Card key={j} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-6 w-6 rounded" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="grid grid-cols-3 gap-2">
                          <Skeleton className="h-12 w-full rounded" />
                          <Skeleton className="h-12 w-full rounded" />
                          <Skeleton className="h-12 w-full rounded" />
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className="h-8 flex-1" />
                          <Skeleton className="h-8 flex-1" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Only show error if:
  // 1. We're not currently loading or fetching
  // 2. AND we have an actual error OR missing data after all retries
  // Don't show error during initial load or while retrying
  // Only show error if we're completely done loading/fetching AND there's an error
  // Wait for all retries to complete before showing error
  const isActivelyLoading = isLoadingDrivers || isLoadingTruckloads || isFetchingDrivers || isFetchingTruckloads
  const hasActualError = (isErrorDrivers || isErrorTruckloads) && !isActivelyLoading
  const hasData = driversData?.drivers && truckloadsData?.truckloads
  // Only show missing data error if we're done loading AND we don't have data
  // But give it a moment - sometimes data loads slightly after the loading flag turns off
  const missingDataAfterLoad = !hasData && !isActivelyLoading && (isErrorDrivers || isErrorTruckloads || (!isLoadingDrivers && !isLoadingTruckloads))

  if (hasActualError || (missingDataAfterLoad && !isFetchingDrivers && !isFetchingTruckloads)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-500">Failed to load data</p>
        {(isErrorDrivers || !driversData?.drivers) && (
          <p className="text-sm text-gray-600">Error loading drivers</p>
        )}
        {(isErrorTruckloads || !truckloadsData?.truckloads) && (
          <p className="text-sm text-gray-600">Error loading truckloads</p>
        )}
        <button
          onClick={() => {
            refetchDrivers()
            refetchTruckloads()
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  // Type guard: ensure data exists before using it
  // If we're still loading or don't have data yet, show loading state
  if (!driversData?.drivers || !truckloadsData?.truckloads) {
    // Still loading, show loading state (handled by shouldShowLoading check above)
    return null
  }

  const drivers = driversData.drivers
  const truckloads = truckloadsData.truckloads

  const getDriverTruckloads = (driverId: number) => {
    // Default to showing active truckloads if no toggle state is set
    const showActive = driverToggleStates[driverId] !== false
    
    return truckloads
      .filter((t: TruckloadSummary) => t.driverId === driverId)
      .filter((t: TruckloadSummary) => {
        if (showActive) {
          // Show active truckloads (not completed yet)
          return !t.isCompleted
        } else {
          // Show completed truckloads
          return t.isCompleted
        }
      })
      .sort((a: TruckloadSummary, b: TruckloadSummary) => {
        if (showActive) {
          // For active truckloads: sort by end date ascending (closest deadline first)
          const aEndDate = new Date(a.endDate)
          const bEndDate = new Date(b.endDate)
          return aEndDate.getTime() - bEndDate.getTime()
        } else {
          // For completed truckloads: sort by end date descending (most recently completed first)
          const aEndDate = new Date(a.endDate)
          const bEndDate = new Date(b.endDate)
          return bEndDate.getTime() - aEndDate.getTime()
        }
      })
  };

  // Get drivers to display with custom ordering
  const getDisplayDrivers = () => {
    // If we have a saved order and all drivers are in it, use that order
    if (driverOrder.length > 0 && driverOrder.length === drivers.length) {
      const orderMap = new Map(driverOrder.map((id, index) => [id, index]))
      const sorted = [...drivers].sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? 999
        const bIndex = orderMap.get(b.id) ?? 999
        return aIndex - bIndex
      })
      return sorted
    }
    
    // Otherwise, sort alphabetically and initialize order
    const sorted = [...drivers].sort((a, b) => {
      return a.full_name.localeCompare(b.full_name)
    })
    
    // Initialize driver order if not set
    if (driverOrder.length === 0 && sorted.length > 0) {
      setDriverOrder(sorted.map(d => d.id))
    }
    
    return sorted
  }

  const displayDrivers = getDisplayDrivers()

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = driverOrder.indexOf(Number(active.id))
      const newIndex = driverOrder.indexOf(Number(over.id))
      const newOrder = arrayMove(driverOrder, oldIndex, newIndex)
      setDriverOrder(newOrder)
    }
  }

  // Move driver up/down in order
  const moveDriver = (driverId: number, direction: 'up' | 'down') => {
    const currentIndex = driverOrder.indexOf(driverId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= driverOrder.length) return

    const newOrder = arrayMove(driverOrder, currentIndex, newIndex)
    setDriverOrder(newOrder)
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-gradient-to-br from-slate-50 to-white min-h-screen">
      {/* Modern Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Truckload Manager</h1>
            </div>
            <p className="text-gray-600 text-sm">
              Manage driver assignments and track truckload progress
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ManageDriversDialog />
            
            {/* Reorder Mode Toggle */}
              <Button
              variant={isReorderMode ? "default" : "outline"}
                size="sm"
              onClick={() => setIsReorderMode(!isReorderMode)}
              className="gap-2"
              >
              <GripVertical className="h-4 w-4" />
              {isReorderMode ? 'Done Reordering' : 'Reorder Columns'}
              </Button>
            
          </div>
        </div>

        {/* Driver Selector - Horizontal */}
        {drivers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-sm font-medium text-gray-700 mr-2">Select Drivers:</span>
            {displayDrivers.map((driver: Driver) => (
              <Button
                key={driver.id}
                variant={selectedDrivers.has(driver.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDriverSelection(driver.id)}
                className="text-xs h-7"
              >
                <div
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: driver.color }}
                />
                {driver.full_name}
              </Button>
            ))}
          </div>
        )}
      </div>


      {/* Driver Columns */}
      <div className="relative">
        {isReorderMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={driverOrder}
              strategy={verticalListSortingStrategy}
            >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {displayDrivers
              .filter((driver: Driver) => selectedDrivers.has(driver.id))
              .map((driver: Driver) => (
                  <SortableDriverCard 
                    key={driver.id} 
                    driver={driver} 
                    isReorderMode={isReorderMode}
                    onMoveUp={() => moveDriver(driver.id, 'up')}
                    onMoveDown={() => moveDriver(driver.id, 'down')}
                    isFirst={driverOrder.indexOf(driver.id) === 0}
                    isLast={driverOrder.indexOf(driver.id) === driverOrder.length - 1}
                  />
            ))}
          </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {displayDrivers
              .filter((driver: Driver) => selectedDrivers.has(driver.id))
              .map((driver: Driver) => (
              <DriverCard 
                key={driver.id} 
                driver={driver}
              />
            ))}
          </div>
        )}
      </div>

      <CreateTruckloadDialog 
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setSelectedDriverId(null);
        }}
        selectedDriverId={selectedDriverId}
        onTruckloadCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['truckloads'] });
        }}
      />

      {selectedTruckload && (
        <EditTruckloadDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedTruckload(null);
          }}
          truckload={{
            id: selectedTruckload.id,
            driverId: selectedTruckload.driverId,
            startDate: selectedTruckload.startDate,
            endDate: selectedTruckload.endDate,
            trailerNumber: selectedTruckload.trailerNumber,
            description: selectedTruckload.description
          }}
          onTruckloadUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['truckloads'] });
          }}
        />
      )}
    </div>
  );

  // Truckload Card Component
  function TruckloadCard({ truckload }: { truckload: TruckloadSummary }) {
    return (
      <Card 
        className={`p-3 transition-all duration-200 hover:shadow-md ${
          truckload.isCompleted 
            ? 'border-green-200 bg-green-50/30' 
            : 'border-orange-200 bg-orange-50/30 hover:border-orange-300'
        }`}
      >
        <div className="space-y-3">
          {/* Header with date and status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gray-500" />
                <span className="text-xs font-semibold text-gray-900">
                  {(() => {
                    // Parse date as local date to avoid timezone conversion
                    const dateParts = truckload.startDate.split('-')
                    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
                    return format(date, 'MMM dd')
                  })()}
                </span>
              </div>
              {truckload.isCompleted ? (
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs px-1.5 py-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                  Complete
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  In Progress
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-gray-100"
              onClick={() => {
                setSelectedTruckload(truckload);
                setIsEditDialogOpen(true);
              }}
            >
              <Info className="h-3 w-3 text-gray-500" />
            </Button>
          </div>

          {/* Description */}
          <div className="text-xs text-gray-700 leading-tight">
            {truckload.description || (
              <span className="text-gray-500 italic">No description provided</span>
            )}
          </div>

          {/* Footage breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-red-50 p-2 rounded border border-red-100">
              <div className="flex items-center gap-0.5 mb-0.5">
                <MapPin className="h-2.5 w-2.5 text-red-600" />
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">Pickup</div>
              </div>
              <div className="text-xs font-bold text-red-800">{truckload.pickupFootage.toLocaleString()} ft²</div>
            </div>
            <div className="bg-gray-50 p-2 rounded border border-gray-200">
              <div className="flex items-center gap-0.5 mb-0.5">
                <Truck className="h-2.5 w-2.5 text-gray-600" />
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Delivery</div>
              </div>
              <div className="text-xs font-bold text-gray-800">{truckload.deliveryFootage.toLocaleString()} ft²</div>
            </div>
            <div className="bg-blue-50 p-2 rounded border border-blue-100">
              <div className="flex items-center gap-0.5 mb-0.5">
                <Package className="h-2.5 w-2.5 text-blue-600" />
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Transfer</div>
              </div>
              <div className="text-xs font-bold text-blue-800">{truckload.transferFootage.toLocaleString()} ft²</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5 pt-1">
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 h-7 text-xs font-medium"
              onClick={() => {
                router.push(`/dashboard/trucking/${truckload.id}`)
              }}
            >
              View Details
            </Button>
            {!truckload.isCompleted ? (
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 h-7 text-xs font-medium border-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400"
                onClick={() => {
                  updateTruckloadStatus.mutate({ 
                    id: truckload.id, 
                    isCompleted: true 
                  })
                }}
                disabled={updateTruckloadStatus.isPending}
              >
                {updateTruckloadStatus.isPending ? (
                  <>
                    <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                    Complete
                  </>
                )}
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 h-7 text-xs font-medium border-2 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                onClick={() => {
                  updateTruckloadStatus.mutate({ 
                    id: truckload.id, 
                    isCompleted: false 
                  })
                }}
                disabled={updateTruckloadStatus.isPending}
              >
                {updateTruckloadStatus.isPending ? (
                  <>
                    <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                    Uncompleting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-2.5 w-2.5 mr-0.5" />
                    Uncomplete
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Sortable Driver Card Component
  function SortableDriverCard({ 
    driver, 
    isReorderMode,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast
  }: { 
    driver: Driver
    isReorderMode: boolean
    onMoveUp: () => void
    onMoveDown: () => void
    isFirst: boolean
    isLast: boolean
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: driver.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const driverTruckloads = getDriverTruckloads(driver.id)
    const completedTruckloads = driverTruckloads.filter(t => t.isCompleted).length
    const showActive = driverToggleStates[driver.id] !== false

    return (
      <div ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
        <Card 
          className={`w-full bg-white shadow-lg border-0 h-fit ${
            isReorderMode ? 'ring-2 ring-blue-300' : ''
          }`}
          style={{
            borderLeft: `4px solid ${driver.color}`,
          }}
        >
          <CardHeader className="pb-2 bg-gradient-to-r from-white to-gray-50/50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                {isReorderMode && (
                  <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                  >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <div 
                  className="w-3 h-3 rounded-full shadow-sm" 
                  style={{ backgroundColor: driver.color }}
                />
                <div className="flex-1">
                  <CardTitle className="text-base font-semibold text-gray-900">
                    {driver.full_name}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Package className="h-2.5 w-2.5" />
                      <span>{driverTruckloads.length} load{driverTruckloads.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                      <span>{completedTruckloads} complete</span>
                    </div>
                  </div>
                </div>
              </div>
              {isReorderMode ? (
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onMoveUp}
                    disabled={isFirst}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onMoveDown}
                    disabled={isLast}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
                  onClick={() => {
                    setSelectedDriverId(driver.id)
                    setIsCreateDialogOpen(true)
                  }}
                >
                  <Plus className="h-3 w-3 text-gray-500" />
                </Button>
              )}
            </div>
            
            {/* Toggle for Active vs Completed Truckloads */}
            {!isReorderMode && (
              <div className="mt-3 flex items-center justify-center">
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <Button
                    variant={showActive ? "default" : "ghost"}
                    size="sm"
                    className={`h-6 px-3 text-xs font-medium transition-all duration-200 ${
                      showActive 
                        ? 'bg-white shadow-sm text-gray-900' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    onClick={() => toggleDriverView(driver.id)}
                  >
                    Active
                  </Button>
                  <Button
                    variant={!showActive ? "default" : "ghost"}
                    size="sm"
                    className={`h-6 px-3 text-xs font-medium transition-all duration-200 ${
                      !showActive 
                        ? 'bg-white shadow-sm text-gray-900' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    onClick={() => toggleDriverView(driver.id)}
                  >
                    Completed
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          {!isReorderMode && (
            <CardContent className="p-3">
              <div className="space-y-3">
                {driverTruckloads.map((truckload: TruckloadSummary) => (
                  <TruckloadCard key={truckload.id} truckload={truckload} />
                ))}
                {driverTruckloads.length === 0 && (
                  <div className="text-center py-6">
                    <div className="p-3 bg-gray-50 rounded border-2 border-dashed border-gray-200">
                      <Package className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500 font-medium">
                        {showActive ? 'No active truckloads' : 'No completed truckloads'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {showActive 
                          ? 'Click the + button to add a new truckload' 
                          : 'Switch to Active view to see current truckloads'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  // Driver Card Component
  function DriverCard({ driver }: { driver: Driver }) {
    const driverTruckloads = getDriverTruckloads(driver.id);
    const completedTruckloads = driverTruckloads.filter(t => t.isCompleted).length;
    const showActive = driverToggleStates[driver.id] !== false;
    
    return (
      <Card 
        className="w-full bg-white shadow-lg border-0 h-fit"
        style={{
          borderLeft: `4px solid ${driver.color}`,
        }}
      >
        <CardHeader className="pb-2 bg-gradient-to-r from-white to-gray-50/50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div 
                className="w-3 h-3 rounded-full shadow-sm" 
                style={{ backgroundColor: driver.color }}
              />
              <div className="flex-1">
                <CardTitle className="text-base font-semibold text-gray-900">
                  {driver.full_name}
                </CardTitle>
                <div className="flex items-center gap-3 mt-0.5">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Package className="h-2.5 w-2.5" />
                    <span>{driverTruckloads.length} load{driverTruckloads.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                    <span>{completedTruckloads} complete</span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
              onClick={() => {
                setSelectedDriverId(driver.id);
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3 text-gray-500" />
            </Button>
          </div>
          
          {/* Toggle for Active vs Completed Truckloads */}
          <div className="mt-3 flex items-center justify-center">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <Button
                variant={showActive ? "default" : "ghost"}
                size="sm"
                className={`h-6 px-3 text-xs font-medium transition-all duration-200 ${
                  showActive 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => toggleDriverView(driver.id)}
              >
                Active
              </Button>
              <Button
                variant={!showActive ? "default" : "ghost"}
                size="sm"
                className={`h-6 px-3 text-xs font-medium transition-all duration-200 ${
                  !showActive 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => toggleDriverView(driver.id)}
              >
                Completed
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-3">
            {driverTruckloads.map((truckload: TruckloadSummary) => (
              <TruckloadCard key={truckload.id} truckload={truckload} />
            ))}
            {driverTruckloads.length === 0 && (
              <div className="text-center py-6">
                <div className="p-3 bg-gray-50 rounded border-2 border-dashed border-gray-200">
                  <Package className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 font-medium">
                    {showActive ? 'No active truckloads' : 'No completed truckloads'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {showActive 
                      ? 'Click the + button to add a new truckload' 
                      : 'Switch to Active view to see current truckloads'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
}