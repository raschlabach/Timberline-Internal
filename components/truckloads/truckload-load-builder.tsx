"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Save, Undo, RotateCw, GripHorizontal, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { debounce } from "lodash"

interface GridPosition {
  x: number
  y: number
  width: number
  length: number
  skidId: number
  type: 'skid' | 'vinyl'
  customerId: number
  rotation: number // 0, 90, 180, or 270 degrees
  customerName: string
  stackId?: number // Optional stack ID for vinyl skids
  stackPosition?: number // Optional stack position for vinyl skids
}

interface TruckloadStop {
  id: number
  assignment_type: 'pickup' | 'delivery'
  sequence_number: number
  delivery_customer: {
    id: number
    name: string
    address: string
  }
  pickup_customer: {
    id: number
    name: string
    address: string
  }
  skids_data: Array<{
    id: number
    type: 'skid'
    width: number
    length: number
    footage: number
    quantity: number
  }>
  vinyl_data: Array<{
    id: number
    type: 'vinyl'
    width: number
    length: number
    footage: number
    quantity: number
  }>
}

interface VinylStack {
  stackId: number
  x: number
  y: number
  skids: GridPosition[]
}

interface TruckloadLoadBuilderProps {
  truckloadId: number
}

const GRID_WIDTH = 8 // 8 feet wide
const GRID_LENGTH = 53 // 53 feet long
const CELL_SIZE = 24 // pixels per foot
const MINI_CELL_SIZE = 12 // pixels per foot for mini skids

const CUSTOMER_COLORS = [
  'bg-blue-100',
  'bg-green-100',
  'bg-purple-100',
  'bg-orange-100',
  'bg-pink-100',
  'bg-yellow-100',
  'bg-indigo-100',
  'bg-red-100',
  'bg-teal-100',
  'bg-cyan-100',
]

function MiniSkid({ 
  width, 
  length, 
  type, 
  isSelected, 
  isUsed, 
  customerId,
  customerName,
  onRotate,
  onClick,
  isRotated = false
}: { 
  width: number
  length: number
  type: 'skid' | 'vinyl'
  isSelected: boolean
  isUsed: boolean
  customerId: number
  customerName: string
  onRotate: () => void
  onClick: () => void
  isRotated?: boolean
}) {
  const [localRotated, setLocalRotated] = useState(isRotated)

  useEffect(() => {
    setLocalRotated(isRotated)
  }, [isRotated])

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRotate()
  }

  const displayWidth = localRotated ? length : width
  const displayLength = localRotated ? width : length

  // Get the base color class without the bg- prefix
  const colorClass = CUSTOMER_COLORS[customerId % CUSTOMER_COLORS.length]
  const borderColorClass = colorClass.replace('bg-', 'border-')

  return (
    <div
      className={`relative p-2 rounded transition-colors border-2 ${
        isSelected
          ? 'bg-blue-100 border-blue-300'
          : isUsed
          ? 'bg-gray-100 border-gray-300'
          : `hover:bg-gray-50 ${borderColorClass}`
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Mini visual representation */}
        <div className="relative">
          <div
            className={`border-2 border-black ${type === 'vinyl' ? 'border-dashed' : ''} ${isUsed ? 'bg-gray-100' : colorClass}`}
            style={{
              width: displayWidth * MINI_CELL_SIZE,
              height: displayLength * MINI_CELL_SIZE,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-[8px] text-center">
              {displayWidth}' × {displayLength}'
            </div>
          </div>
          {!isUsed && (
            <Button
              variant="outline"
              size="icon"
              className="absolute -top-2 -right-2 h-5 w-5 bg-white/90 hover:bg-white shadow-sm"
              onClick={handleRotate}
            >
              <RotateCw className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* Info text */}
        <div className="flex-1">
          <div className="text-xs">
            {type === 'skid' ? 'Skid' : 'Vinyl'}
          </div>
          <div className="text-xs text-gray-500">
            {width * length} ft²
          </div>
        </div>
      </div>
    </div>
  )
}

export function TruckloadLoadBuilder({ truckloadId }: TruckloadLoadBuilderProps) {
  const [stops, setStops] = useState<TruckloadStop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Separate states for pickup and delivery layouts
  const [selectedSkid, setSelectedSkid] = useState<{
    id: number
    width: number
    length: number
    type: 'skid' | 'vinyl'
    isPickup?: boolean
  } | null>(null)
  
  // Separate states for pickup and delivery layouts
  const [placedDeliverySkids, setPlacedDeliverySkids] = useState<GridPosition[]>([])
  const [placedPickupSkids, setPlacedPickupSkids] = useState<GridPosition[]>([])
  const [previewPosition, setPreviewPosition] = useState<{x: number, y: number} | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [usedDeliverySkidIds, setUsedDeliverySkidIds] = useState<Set<number>>(new Set())
  const [usedPickupSkidIds, setUsedPickupSkidIds] = useState<Set<number>>(new Set())
  const [draggedSkid, setDraggedSkid] = useState<GridPosition | null>(null)
  const [skidRotations, setSkidRotations] = useState<Map<number, boolean>>(new Map())
  const [deliveryVinylStacks, setDeliveryVinylStacks] = useState<VinylStack[]>([])
  const [pickupVinylStacks, setPickupVinylStacks] = useState<VinylStack[]>([])
  const [nextDeliveryStackId, setNextDeliveryStackId] = useState(1)
  const [nextPickupStackId, setNextPickupStackId] = useState(1)
  const [activeTab, setActiveTab] = useState<'delivery' | 'pickup'>('delivery')

  // Get the current active layout based on tab
  const placedSkids = activeTab === 'delivery' ? placedDeliverySkids : placedPickupSkids
  const setPlacedSkids = activeTab === 'delivery' ? setPlacedDeliverySkids : setPlacedPickupSkids
  const usedSkidIds = activeTab === 'delivery' ? usedDeliverySkidIds : usedPickupSkidIds
  const setUsedSkidIds = activeTab === 'delivery' ? setUsedDeliverySkidIds : setUsedPickupSkidIds
  const vinylStacks = activeTab === 'delivery' ? deliveryVinylStacks : pickupVinylStacks
  const setVinylStacks = activeTab === 'delivery' ? setDeliveryVinylStacks : setPickupVinylStacks
  const nextStackId = activeTab === 'delivery' ? nextDeliveryStackId : nextPickupStackId
  const setNextStackId = activeTab === 'delivery' ? setNextDeliveryStackId : setNextPickupStackId

  // Move fetchData to component scope
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      
      console.log('🔄 Fetching data for truckload:', {
        id: truckloadId,
        type: activeTab
      })
      
      // Fetch stops
      const stopsResponse = await fetch(`/api/truckloads/${truckloadId}/orders`)
      if (!stopsResponse.ok) {
        throw new Error("Failed to fetch stops")
      }
      const stopsData = await stopsResponse.json()
      if (!stopsData.success) {
        throw new Error(stopsData.error || "Failed to fetch stops")
      }
      
      console.log('📦 Fetched stops:', {
        count: stopsData.orders.length,
        orders: stopsData.orders
      })
      
      setStops(stopsData.orders)

      // Fetch layout for current tab
      console.log('🔄 Fetching layout for type:', activeTab)
      const layoutResponse = await fetch(`/api/truckloads/${truckloadId}/layout?type=${activeTab}`)
      if (!layoutResponse.ok) {
        throw new Error("Failed to fetch layout")
      }
      
      const layoutData = await layoutResponse.json()
      console.log('📋 Layout response:', layoutData)
      
      if (layoutData.success && layoutData.layout) {
        const layout = layoutData.layout.map((item: any) => ({
          x: Number(item.x),
          y: Number(item.y),
          width: Number(item.width),
          length: Number(item.length),
          skidId: Number(item.skidId),
          type: item.type as 'skid' | 'vinyl',
          customerId: Number(item.customerId || 0),
          rotation: Number(item.rotation || 0),
          customerName: item.customerName || "",
          stackId: item.stackId ? Number(item.stackId) : undefined,
          stackPosition: item.stackPosition ? Number(item.stackPosition) : undefined
        }))

        console.log('📦 Processed layout:', {
          itemCount: layout.length,
          layout
        })

        // Set the layout based on active tab
        if (activeTab === 'delivery') {
          setPlacedDeliverySkids(layout)
          setUsedDeliverySkidIds(new Set(layout.map((item: GridPosition) => item.skidId)))
        } else {
          setPlacedPickupSkids(layout)
          setUsedPickupSkidIds(new Set(layout.map((item: GridPosition) => item.skidId)))
        }
        
        // Process stacks
        const stackGroups = new Map<number, GridPosition[]>()
        layout.forEach((item: GridPosition) => {
          if (item.stackId) {
            const stack = stackGroups.get(item.stackId) || []
            stack.push(item)
            stackGroups.set(item.stackId, stack)
          }
        })

        const stacks: VinylStack[] = []
        stackGroups.forEach((items, stackId) => {
          if (items.length > 0) {
            const stack: VinylStack = {
              stackId,
              x: items[0].x,
              y: items[0].y,
              skids: items.sort((a, b) => (b.stackPosition || 0) - (a.stackPosition || 0))
            }
            stacks.push(stack)
          }
        })

        console.log('📚 Processed stacks:', {
          count: stacks.length,
          stacks
        })

        // Set stacks based on active tab
        if (activeTab === 'delivery') {
          setDeliveryVinylStacks(stacks)
          const maxStackId = Math.max(0, ...Array.from(stackGroups.keys()))
          setNextDeliveryStackId(maxStackId + 1)
        } else {
          setPickupVinylStacks(stacks)
          const maxStackId = Math.max(0, ...Array.from(stackGroups.keys()))
          setNextPickupStackId(maxStackId + 1)
        }
      }
    } catch (error) {
      console.error('❌ Error fetching data:', error)
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [truckloadId, activeTab])

  // Update useEffect to use the new fetchData
  useEffect(() => {
    if (truckloadId) {
      fetchData()
    }
  }, [truckloadId, activeTab, fetchData]) // Add activeTab as a dependency

  // Debounced save function
  const debouncedSaveLayout = useCallback(
    debounce(async (layout: GridPosition[], showSuccessToast: boolean = false) => {
      if (!truckloadId) return
      
      setIsSaving(true)
      
      try {
        console.log('Saving layout:', {
          truckloadId,
          type: activeTab,
          layoutLength: layout.length,
          layout: layout
        })

        const response = await fetch(`/api/truckloads/${truckloadId}/layout?type=${activeTab}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            layout
          })
        })

        const data = await response.json()
        console.log('Save response:', data)

        if (!response.ok) {
          const errorData = data
          throw new Error(errorData.error || 'Failed to save layout')
        }

        if (showSuccessToast) {
          toast.success('Layout saved successfully')
        }
      } catch (error) {
        console.error('Error saving layout:', error)
        toast.error(`Failed to save layout: ${error instanceof Error ? error.message : 'Unknown error'}`)
        
        // Optionally trigger a refresh to ensure UI is in sync with server
        if (truckloadId) {
          fetchData()
        }
      } finally {
        setIsSaving(false)
      }
    }, 500),
    [truckloadId, activeTab, fetchData]
  )

  function handleClear() {
    setPlacedSkids([])
    setSelectedSkid(null)
    setPreviewPosition(null)
    setUsedSkidIds(new Set())
    setDraggedSkid(null)
    setSkidRotations(new Map())
    setVinylStacks([])
    setNextStackId(1)
    // Clear in database with empty array
    debouncedSaveLayout([])
  }

  function getCustomerColorClass(customerId: number) {
    // Use modulo to cycle through colors if we have more customers than colors
    return CUSTOMER_COLORS[customerId % CUSTOMER_COLORS.length]
  }

  function handleRotate(skidIndex: number) {
    const skidToRotate = placedSkids[skidIndex]
    
    // Remove the skid from placedSkids
    setPlacedSkids(prev => prev.filter((_, index) => index !== skidIndex))
    
    // Set it as the selected skid with rotated dimensions
    setSelectedSkid({
      id: skidToRotate.skidId,
      // Swap width and length
      width: skidToRotate.length,
      length: skidToRotate.width,
      type: skidToRotate.type
    })

    // Store the rotated skid info for preview
    setDraggedSkid({
      ...skidToRotate,
      width: skidToRotate.length,
      length: skidToRotate.width,
      rotation: 0 // No visual rotation needed
    })

    // Remove from usedSkidIds while being placed
    setUsedSkidIds(prev => {
      const newSet = new Set(Array.from(prev))
      newSet.delete(skidToRotate.skidId)
      return newSet
    })
  }

  function hasCollisions(skid: GridPosition, allSkids: GridPosition[], excludeIndex?: number) {
    return allSkids.some((other, index) => {
      if (excludeIndex !== undefined && index === excludeIndex) return false
      
      const horizontalOverlap = !(
        skid.x >= other.x + other.width ||
        skid.x + skid.width <= other.x
      )
      const verticalOverlap = !(
        skid.y >= other.y + other.length ||
        skid.y + skid.length <= other.y
      )
      return horizontalOverlap && verticalOverlap
    })
  }

  function getVinylStackAtPosition(x: number, y: number): VinylStack | undefined {
    return vinylStacks.find(stack => 
      stack.x === x && stack.y === y
    )
  }

  function getStackTypeLabel(stack: VinylStack): string {
    const hasSkids = stack.skids.some(item => item.type === 'skid')
    const hasVinyl = stack.skids.some(item => item.type === 'vinyl')
    if (hasSkids && hasVinyl) return 'Skid & Vinyl'
    if (hasSkids) return 'Skid'
    return 'Vinyl'
  }

  // Update handleGridClick for proper stack position handling
  function handleGridClick(x: number, y: number) {
    if (!selectedSkid) return

    // Find the customer info for the selected skid
    const customerInfo = stops.find((stop: TruckloadStop) => 
      stop.skids_data.some((skid: { id: number }) => skid.id === selectedSkid.id) ||
      stop.vinyl_data.some((vinyl: { id: number }) => vinyl.id === selectedSkid.id)
    )?.delivery_customer

    if (!customerInfo) return

    // Snap to grid
    const snappedX = Math.floor(x)
    const snappedY = Math.floor(y)

    // Check if placement is valid
    if (snappedX + selectedSkid.width > GRID_WIDTH || 
        snappedY + selectedSkid.length > GRID_LENGTH) {
      return // Invalid placement
    }

    // Check for existing stack or collision
    const existingStack = getVinylStackAtPosition(snappedX, snappedY)
    const hasCollision = placedSkids.some(skid => {
      if (existingStack && skid.stackId === existingStack.stackId) return false
      
      const horizontalOverlap = !(
        snappedX >= skid.x + skid.width ||
        snappedX + selectedSkid.width <= skid.x
      )
      const verticalOverlap = !(
        snappedY >= skid.y + skid.length ||
        snappedY + selectedSkid.length <= skid.y
      )
      return horizontalOverlap && verticalOverlap
    })

    if (hasCollision && !existingStack) return // Invalid placement if collision and not stacking

    // Create the new skid
    const newSkid: GridPosition = {
      x: snappedX,
      y: snappedY,
      width: selectedSkid.width,
      length: selectedSkid.length,
      skidId: selectedSkid.id,
      type: selectedSkid.type,
      customerId: customerInfo.id,
      rotation: draggedSkid?.rotation || 0,
      customerName: customerInfo.name,
      stackId: existingStack?.stackId
    }

    let updatedPlacedSkids: GridPosition[] = []

    if (existingStack) {
      // Add to existing stack at the TOP
      newSkid.stackId = existingStack.stackId
      
      // Get current stack items and add new item
      const currentStack = [newSkid, ...existingStack.skids]
      
      // Update positions (position 1 is bottom, higher numbers at top)
      currentStack.forEach((skid, index) => {
        skid.stackPosition = currentStack.length - index // Highest number at top
      })
      
      const updatedStack = {
        ...existingStack,
        skids: currentStack
      }
      
      setVinylStacks(prev => prev.map(stack => 
        stack.stackId === existingStack.stackId ? updatedStack : stack
      ))
      
      updatedPlacedSkids = placedSkids.map(skid => {
        if (skid.stackId === existingStack.stackId) {
          const stackSkid = currentStack.find(s => s.skidId === skid.skidId)
          return stackSkid || skid
        }
        return skid
      })
      updatedPlacedSkids.push(newSkid)
    } else {
      // Create new stack
      const stackId = nextStackId
      newSkid.stackId = stackId
      newSkid.stackPosition = 1 // First item is position 1
      const newStack: VinylStack = {
        stackId,
        x: snappedX,
        y: snappedY,
        skids: [newSkid]
      }
      setVinylStacks(prev => [...prev, newStack])
      updatedPlacedSkids = [...placedSkids, newSkid]
      setNextStackId(prev => prev + 1)
    }

    setPlacedSkids(updatedPlacedSkids)
    setUsedSkidIds(prev => new Set([...Array.from(prev), selectedSkid.id]))
    setSelectedSkid(null)
    setPreviewPosition(null)
    setDraggedSkid(null)

    // Save to database with updated stack information
    debouncedSaveLayout(updatedPlacedSkids, true)
  }

  function handleGridMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectedSkid) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE)
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE)

    setPreviewPosition({ x, y })
  }

  // Add function to handle rotation state
  function handleSkidRotation(skidId: number, isRotated: boolean) {
    setSkidRotations(prev => {
      const next = new Map(prev)
      next.set(skidId, isRotated)
      return next
    })
  }

  // Update moveInStack to ensure positions are updated correctly
  function moveInStack(stackId: number, skidId: number, direction: 'up' | 'down') {
    setVinylStacks(prev => {
      const stackIndex = prev.findIndex(s => s.stackId === stackId)
      if (stackIndex === -1) return prev

      const stack = prev[stackIndex]
      const skidIndex = stack.skids.findIndex(s => s.skidId === skidId)
      if (skidIndex === -1) return prev

      const newSkids = [...stack.skids]
      if (direction === 'up' && skidIndex > 0) {
        // Move towards top (swap with the item above)
        [newSkids[skidIndex], newSkids[skidIndex - 1]] = [newSkids[skidIndex - 1], newSkids[skidIndex]]
      } else if (direction === 'down' && skidIndex < newSkids.length - 1) {
        // Move towards bottom (swap with the item below)
        [newSkids[skidIndex], newSkids[skidIndex + 1]] = [newSkids[skidIndex + 1], newSkids[skidIndex]]
      }

      // Update positions after swap (position 1 is bottom)
      newSkids.forEach((skid, index) => {
        skid.stackPosition = newSkids.length - index
      })

      const newStack = { ...stack, skids: newSkids }
      const newStacks = [...prev]
      newStacks[stackIndex] = newStack

      // Update placedSkids with new positions
      const updatedPlacedSkids = placedSkids.map(skid => {
        if (skid.stackId === stackId) {
          const newSkid = newSkids.find(s => s.skidId === skid.skidId)
          if (newSkid) {
            return {
              ...skid,
              stackPosition: newSkid.stackPosition
            }
          }
        }
        return skid
      })
      
      setPlacedSkids(updatedPlacedSkids)
      
      // Save the updated layout immediately
      debouncedSaveLayout(updatedPlacedSkids, true)

      return newStacks
    })
  }

  // Update removeFromStack to save after removal
  function removeFromStack(stackId: number, skidId: number) {
    const stack = vinylStacks.find(s => s.stackId === stackId)
    if (!stack) return

    // Remove skid from stack
    const updatedStack = {
      ...stack,
      skids: stack.skids.filter(s => s.skidId !== skidId)
    }

    // Update or remove stack
    if (updatedStack.skids.length === 0) {
      setVinylStacks(prev => prev.filter(s => s.stackId !== stackId))
    } else {
      setVinylStacks(prev => prev.map(s => 
        s.stackId === stackId ? updatedStack : s
      ))
    }

    // Update placedSkids
    const updatedPlacedSkids = placedSkids.filter(s => s.skidId !== skidId)
    setPlacedSkids(updatedPlacedSkids)
    
    // Make skid available again
    setUsedSkidIds(prev => {
      const newSet = new Set(Array.from(prev))
      newSet.delete(skidId)
      return newSet
    })

    // Save to database with updated stack information
    debouncedSaveLayout(updatedPlacedSkids)
  }

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
        <div>{error}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab buttons */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'delivery' ? 'default' : 'outline'}
          onClick={() => setActiveTab('delivery')}
        >
          Deliveries
        </Button>
        <Button
          variant={activeTab === 'pickup' ? 'default' : 'outline'}
          onClick={() => setActiveTab('pickup')}
        >
          Pickups
        </Button>
      </div>

      <div className="grid grid-cols-[300px,1fr] gap-4">
        {/* Left side - Available Skids */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Available Items</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={placedSkids.length === 0}
            >
              Clear All
            </Button>
          </div>
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-4">
              {stops
                .filter(stop => stop.assignment_type === activeTab)
                .map((stop) => (
                <div key={stop.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="font-medium">
                        {activeTab === 'delivery' ? stop.delivery_customer.name : stop.pickup_customer.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {stop.skids_data.length} skids • {stop.vinyl_data.length} vinyl
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {stop.skids_data.map((skid) => (
                      <MiniSkid
                        key={`skid-${skid.id}`}
                        width={skid.width}
                        length={skid.length}
                        type="skid"
                        isSelected={selectedSkid?.id === skid.id}
                        isUsed={usedSkidIds.has(skid.id)}
                        customerId={activeTab === 'delivery' ? stop.delivery_customer.id : stop.pickup_customer.id}
                        customerName={activeTab === 'delivery' ? stop.delivery_customer.name : stop.pickup_customer.name}
                        onRotate={() => {
                          const newRotated = !skidRotations.get(skid.id)
                          handleSkidRotation(skid.id, newRotated)
                          if (selectedSkid?.id === skid.id) {
                            setSelectedSkid({
                              ...selectedSkid,
                              width: selectedSkid.length,
                              length: selectedSkid.width
                            })
                          }
                        }}
                        onClick={() => {
                          if (!usedSkidIds.has(skid.id)) {
                            const isRotated = skidRotations.get(skid.id)
                            setSelectedSkid({
                              id: skid.id,
                              width: isRotated ? skid.length : skid.width,
                              length: isRotated ? skid.width : skid.length,
                              type: 'skid',
                              isPickup: activeTab === 'pickup'
                            })
                          }
                        }}
                        isRotated={skidRotations.get(skid.id) || false}
                      />
                    ))}
                    {stop.vinyl_data.map((vinyl) => (
                      <MiniSkid
                        key={`vinyl-${vinyl.id}`}
                        width={vinyl.width}
                        length={vinyl.length}
                        type="vinyl"
                        isSelected={selectedSkid?.id === vinyl.id}
                        isUsed={usedSkidIds.has(vinyl.id)}
                        customerId={activeTab === 'delivery' ? stop.delivery_customer.id : stop.pickup_customer.id}
                        customerName={activeTab === 'delivery' ? stop.delivery_customer.name : stop.pickup_customer.name}
                        onRotate={() => {
                          const newRotated = !skidRotations.get(vinyl.id)
                          handleSkidRotation(vinyl.id, newRotated)
                          if (selectedSkid?.id === vinyl.id) {
                            setSelectedSkid({
                              ...selectedSkid,
                              width: selectedSkid.length,
                              length: selectedSkid.width
                            })
                          }
                        }}
                        onClick={() => {
                          if (!usedSkidIds.has(vinyl.id)) {
                            const isRotated = skidRotations.get(vinyl.id)
                            setSelectedSkid({
                              id: vinyl.id,
                              width: isRotated ? vinyl.length : vinyl.width,
                              length: isRotated ? vinyl.width : vinyl.length,
                              type: 'vinyl',
                              isPickup: activeTab === 'pickup'
                            })
                          }
                        }}
                        isRotated={skidRotations.get(vinyl.id) || false}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Right side - Grid Layout */}
        <Card className="flex-grow p-4 overflow-hidden">
          <div className="mb-4">
            <h3 className="font-semibold">Trailer Layout - {activeTab === 'delivery' ? 'Deliveries' : 'Pickups'}</h3>
            <p className="text-sm text-gray-600">Click to place selected items on the grid</p>
          </div>
          <div className="flex gap-4">
            <div
              className="relative border border-gray-200 bg-white"
              style={{
                width: GRID_WIDTH * CELL_SIZE,
                height: GRID_LENGTH * CELL_SIZE
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = (e.clientX - rect.left) / CELL_SIZE
                const y = (e.clientY - rect.top) / CELL_SIZE
                handleGridClick(x, y)
              }}
              onMouseMove={handleGridMouseMove}
              onMouseLeave={() => setPreviewPosition(null)}
            >
              {/* Grid lines */}
              {Array.from({ length: GRID_WIDTH }).map((_, i) => (
                <div
                  key={`v-${i}`}
                  className="absolute border-l border-gray-100"
                  style={{
                    left: i * CELL_SIZE,
                    height: '100%'
                  }}
                />
              ))}
              {Array.from({ length: GRID_LENGTH }).map((_, i) => (
                <div
                  key={`h-${i}`}
                  className="absolute border-t border-gray-100"
                  style={{
                    top: i * CELL_SIZE,
                    width: '100%'
                  }}
                />
              ))}

              {/* Placed skids and stacks */}
              {placedSkids.map((skid, index) => {
                // If skid is part of a stack and not the bottom skid, don't render
                if (skid.stackId) {
                  const stackGroup = vinylStacks.find(s => s.stackId === skid.stackId)
                  if (stackGroup && skid !== stackGroup.skids[stackGroup.skids.length - 1]) {
                    return null
                  }
                }

                const currentStack = skid.stackId ? vinylStacks.find(s => s.stackId === skid.stackId) : null
                const isStack = currentStack && currentStack.skids.length > 1
                const bottomSkid = isStack ? currentStack.skids[currentStack.skids.length - 1] : skid // Get bottom skid for dimensions

                return (
                  <div
                    key={`placed-${index}`}
                    className={`absolute ${
                      isStack 
                        ? 'bg-gray-100/70 border-2 border-dotted border-gray-400' 
                        : `${skid.type === 'vinyl' ? 'border-[3px] border-dashed' : 'border-2'} border-black ${getCustomerColorClass(skid.customerId)}`
                    } group`}
                    style={{
                      left: bottomSkid.x * CELL_SIZE,
                      top: bottomSkid.y * CELL_SIZE,
                      width: bottomSkid.width * CELL_SIZE,
                      height: bottomSkid.length * CELL_SIZE
                    }}
                  >
                    {/* Customer name and dimensions */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-center p-1 break-words">
                      {isStack ? (
                        <>
                          <div className="font-medium">Stack #{currentStack.stackId}</div>
                          <div>{bottomSkid.width}' × {bottomSkid.length}'</div>
                          <div className="text-gray-500">{currentStack.skids.length} skids</div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium">{skid.customerName}</div>
                          <div>{skid.width}' × {skid.length}'</div>
                        </>
                      )}
                    </div>

                    {/* Control buttons - now showing for both stacks and individual skids */}
                    <div className="absolute top-1 right-1 hidden group-hover:flex gap-1 z-10">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 bg-white/90 hover:bg-white shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRotate(index)
                              }}
                            >
                              <RotateCw className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Rotate 90°</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 bg-white/90 hover:bg-white shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isStack) {
                                  // For stacks, move the entire stack
                                  const stackSkids = currentStack.skids
                                  // Remove all skids in the stack
                                  setPlacedSkids(prev => prev.filter(s => s.stackId !== currentStack.stackId))
                                  // Set the bottom skid as the selected skid
                                  setDraggedSkid(bottomSkid)
                                  setSelectedSkid({
                                    id: bottomSkid.skidId,
                                    width: bottomSkid.width,
                                    length: bottomSkid.length,
                                    type: bottomSkid.type
                                  })
                                  // Remove all stack skids from usedSkidIds
                                  setUsedSkidIds(prev => {
                                    const newSet = new Set(Array.from(prev))
                                    stackSkids.forEach(s => newSet.delete(s.skidId))
                                    return newSet
                                  })
                                  // Remove the stack
                                  setVinylStacks(prev => prev.filter(s => s.stackId !== currentStack.stackId))
                                } else {
                                  // Original single skid move logic
                                  setPlacedSkids(prev => prev.filter(s => s.skidId !== skid.skidId))
                                  setDraggedSkid(skid)
                                  setSelectedSkid({
                                    id: skid.skidId,
                                    width: skid.width,
                                    length: skid.length,
                                    type: skid.type
                                  })
                                  setUsedSkidIds(prev => {
                                    const newSet = new Set(Array.from(prev))
                                    newSet.delete(skid.skidId)
                                    return newSet
                                  })
                                }
                                // Save the removal to database
                                debouncedSaveLayout(placedSkids.filter(s => 
                                  isStack ? s.stackId !== currentStack.stackId : s.skidId !== skid.skidId
                                ))
                              }}
                            >
                              <GripHorizontal className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isStack ? 'Move stack' : 'Move skid'}</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 bg-white/90 hover:bg-white shadow-sm hover:bg-red-50 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isStack) {
                                  // For stacks, remove all skids in the stack
                                  const stackSkids = currentStack.skids
                                  setPlacedSkids(prev => prev.filter(s => s.stackId !== currentStack.stackId))
                                  // Remove all stack skids from usedSkidIds
                                  setUsedSkidIds(prev => {
                                    const newSet = new Set(Array.from(prev))
                                    stackSkids.forEach(s => newSet.delete(s.skidId))
                                    return newSet
                                  })
                                  // Remove the stack
                                  setVinylStacks(prev => prev.filter(s => s.stackId !== currentStack.stackId))
                                  // Clear any rotation states
                                  stackSkids.forEach(s => {
                                    setSkidRotations(prev => {
                                      const next = new Map(prev)
                                      next.delete(s.skidId)
                                      return next
                                    })
                                  })
                                } else {
                                  // Original single skid remove logic
                                  setPlacedSkids(prev => prev.filter(s => s.skidId !== skid.skidId))
                                  setUsedSkidIds(prev => {
                                    const newSet = new Set(Array.from(prev))
                                    newSet.delete(skid.skidId)
                                    return newSet
                                  })
                                  setSkidRotations(prev => {
                                    const next = new Map(prev)
                                    next.delete(skid.skidId)
                                    return next
                                  })
                                }
                                // Save the removal to database
                                debouncedSaveLayout(placedSkids.filter(s => 
                                  isStack ? s.stackId !== currentStack.stackId : s.skidId !== skid.skidId
                                ))
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isStack ? 'Remove stack' : 'Remove skid'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                )
              })}

              {/* Preview */}
              {selectedSkid && previewPosition && (
                <div
                  className="absolute border-2 border-dashed border-blue-400 bg-blue-50 opacity-50"
                  style={{
                    left: previewPosition.x * CELL_SIZE,
                    top: previewPosition.y * CELL_SIZE,
                    width: selectedSkid.width * CELL_SIZE,
                    height: selectedSkid.length * CELL_SIZE,
                    pointerEvents: 'none'
                  }}
                />
              )}
            </div>

            {/* Stack Panels */}
            {vinylStacks.some(stack => stack.skids.length > 1) && (
              <div className="flex flex-col gap-2 w-80">
                {vinylStacks.filter(stack => stack.skids.length > 1).map(stack => {
                  const stackType = getStackTypeLabel(stack)
                  return (
                    <Card 
                      key={stack.stackId} 
                      className="p-4 shrink-0 bg-white shadow-md"
                    >
                      <div className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <span>Stack #{stack.stackId}</span>
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">{stackType}</span>
                      </div>
                      <div className="space-y-2">
                        {stack.skids.map((skid, index) => (
                          <div
                            key={skid.skidId}
                            className={`relative p-2 rounded ${
                              skid.type === 'vinyl' ? 'border-dashed border' : 'border'
                            } ${getCustomerColorClass(skid.customerId)}`}
                          >
                            {/* Visual representation of skid dimensions */}
                            <div className="mb-1.5">
                              <div 
                                className={`${skid.type === 'vinyl' ? 'border-dashed border' : 'border'} border-black/30 bg-black/5`}
                                style={{
                                  width: `${(skid.width / GRID_WIDTH) * 100}%`,
                                  height: '12px'
                                }}
                              />
                            </div>

                            {/* Trailer line for bottom skid */}
                            {index === stack.skids.length - 1 && (
                              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-[110%] h-2 bg-black rounded border-x-2 border-black" />
                            )}
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium bg-white/50 rounded-full w-5 h-5 flex items-center justify-center border border-black/10">
                                    {stack.skids.length - index}
                                  </span>
                                  <div className="font-medium text-sm truncate">
                                    {skid.customerName}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {skid.width}' × {skid.length}' • {skid.type === 'vinyl' ? 'Vinyl' : 'Skid'}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                {index > 0 && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => moveInStack(stack.stackId, skid.skidId, 'up')}
                                  >
                                    ↑
                                  </Button>
                                )}
                                {index < stack.skids.length - 1 && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => moveInStack(stack.stackId, skid.skidId, 'down')}
                                  >
                                    ↓
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => removeFromStack(stack.stackId, skid.skidId)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
} 