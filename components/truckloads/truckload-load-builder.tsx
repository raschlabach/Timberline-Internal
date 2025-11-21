"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { TrailerGrid } from "./trailer-grid"
import { AvailableItemsPanel } from "./available-items-panel"
import { StackPanel } from "./stack-panel"
import { useLoadBuilderState } from "./use-load-builder-state"
import { useLayoutOperations } from "./use-layout-operations"

interface TruckloadStop {
  id: number
  assignment_type: 'pickup' | 'delivery' | 'transfer'
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
  is_transfer_order: boolean
}

interface TruckloadLoadBuilderProps {
  truckloadId: number
}

export function TruckloadLoadBuilder({ truckloadId }: TruckloadLoadBuilderProps) {
  const [stops, setStops] = useState<TruckloadStop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBothLayouts, setShowBothLayouts] = useState(false)
  const [renderKey, setRenderKey] = useState(0)

  // Custom hooks for state management
  const {
    state,
    actions,
    activeTab,
    setActiveTab
  } = useLoadBuilderState(truckloadId)

  const {
    saveLayout,
    saveLayoutImmediate,
    fetchLayoutData,
    isSaving
  } = useLayoutOperations(truckloadId, activeTab, actions)
      
  // Fetch stops data
  useEffect(() => {
    let isMounted = true
    
    async function fetchStops() {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch(`/api/truckloads/${truckloadId}/orders`)
        if (!response.ok) {
          throw new Error("Failed to fetch stops")
        }
        
        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || "Failed to fetch stops")
        }
        
        if (isMounted) {
          setStops(data.orders)
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "An error occurred"
          setError(errorMessage)
          console.error("Error fetching stops:", err)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    if (truckloadId) {
      fetchStops()
    }

    return () => {
      isMounted = false
    }
  }, [truckloadId])


  // Fetch layout data on mount only
  useEffect(() => {
    if (truckloadId) {
      fetchLayoutData().then(() => {
        console.log('TruckloadLoadBuilder: Layout fetch complete, current state:', {
          deliveryCount: state.placedDeliverySkids.length,
          pickupCount: state.placedPickupSkids.length
        })
        // Force re-render by updating renderKey after a brief delay to ensure state is set
        setTimeout(() => {
          console.log('TruckloadLoadBuilder: Forcing re-render with renderKey update')
          setRenderKey(prev => prev + 1)
        }, 100)
      }).catch((error) => {
        console.error('TruckloadLoadBuilder: Error fetching layout data:', error)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckloadId])
  
  // Also watch for state changes and force re-render
  useEffect(() => {
    console.log('TruckloadLoadBuilder: State changed, forcing re-render', {
      deliveryCount: state.placedDeliverySkids.length,
      pickupCount: state.placedPickupSkids.length
    })
    setRenderKey(prev => prev + 1)
  }, [state.placedDeliverySkids.length, state.placedPickupSkids.length])

  // Handle tab change with proper state management
  const handleTabChange = useCallback(async (newTab: 'delivery' | 'pickup') => {
    try {
      // Save current layout before switching
      const currentLayout = activeTab === 'delivery' ? state.placedDeliverySkids : state.placedPickupSkids
      await saveLayout(currentLayout, false)
      
      // Clear temporary states
      actions.clearSelection()
      
      // Switch tab
      setActiveTab(newTab)
    } catch (error) {
      console.error('Error switching tabs:', error)
      toast.error('Failed to save layout before switching tabs')
    }
  }, [activeTab, state.placedDeliverySkids, state.placedPickupSkids, saveLayout, actions, setActiveTab])

  // Add error boundary for unexpected errors
  const handleError = useCallback((error: Error) => {
    console.error('Load builder error:', error)
    toast.error('An unexpected error occurred. Please refresh the page.')
  }, [])

  // Create wrapped action functions that include auto-save
  const wrappedActions = useMemo(() => ({
    ...actions,
    handleGridClick: (x: number, y: number, stops: TruckloadStop[]) => 
      actions.handleGridClick(x, y, stops, saveLayoutImmediate),
    handleRemove: (skid: any, isStack: boolean, currentStack?: any) => 
      actions.handleRemove(skid, isStack, currentStack, saveLayoutImmediate),
    handleMove: (skidIndex: number) => 
      actions.handleMove(skidIndex),
    moveInStack: (stackId: number, skidId: number, direction: 'up' | 'down') => 
      actions.moveInStack(stackId, skidId, direction, saveLayoutImmediate),
    removeFromStack: (stackId: number, skidId: number) => 
      actions.removeFromStack(stackId, skidId, saveLayoutImmediate)
  }), [actions, saveLayoutImmediate])

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-red-500">
        <AlertCircle className="h-8 w-8 mb-2" />
        <div>{error}</div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4 min-h-0 overflow-y-auto" role="main" aria-label="Truckload Load Builder">
      {/* Tab Navigation */}
      <div className="flex gap-4 items-center shrink-0" role="tablist" aria-label="Layout tabs">
        <div className="flex gap-4">
          <Button
            id="delivery-tab"
            variant={activeTab === 'delivery' ? 'default' : 'outline'}
            onClick={() => handleTabChange('delivery')}
            role="tab"
            aria-selected={activeTab === 'delivery'}
            aria-controls="delivery-layout"
          >
            Outgoing Layout
          </Button>
          <Button
            id="pickup-tab"
            variant={activeTab === 'pickup' ? 'default' : 'outline'}
            onClick={() => handleTabChange('pickup')}
            role="tab"
            aria-selected={activeTab === 'pickup'}
            aria-controls="pickup-layout"
          >
            Incoming Layout
          </Button>
        </div>
        
        {/* Toggle Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBothLayouts(!showBothLayouts)}
          className="shrink-0"
          title={showBothLayouts ? "Hide other layout" : "Show both layouts"}
        >
          {showBothLayouts ? "Hide Other" : "Show Both"}
        </Button>
      </div>

      {/* Main Content Grid - Responsive with Toggle */}
      <div className={`grid gap-4 flex-1 min-h-0 ${
        showBothLayouts 
          ? 'grid-cols-[300px,auto,auto]' 
          : 'grid-cols-[300px,auto]'
      }`}>
        {/* Available Items Panel */}
        <AvailableItemsPanel
          stops={stops}
          activeTab={activeTab}
          state={state}
          actions={wrappedActions}
          saveLayout={saveLayoutImmediate}
        />

        {/* Outgoing Layout */}
        <Card 
          id="delivery-layout"
          className={`p-4 overflow-hidden transition-all duration-200 w-fit ${
            activeTab === 'delivery' ? 'ring-2 ring-blue-500 shadow-lg' : 'opacity-50 pointer-events-none'
          } ${activeTab !== 'delivery' && !showBothLayouts ? 'hidden' : ''}`}
          role="tabpanel"
          aria-labelledby="delivery-tab"
          aria-hidden={activeTab !== 'delivery'}
        >
          <div className="mb-4">
            <h3 className="font-semibold">Outgoing Layout</h3>
            <p className="text-sm text-gray-600">
              {activeTab === 'delivery' 
                ? 'Click to place selected items on the grid' 
                : 'Switch to Outgoing tab to edit this layout'
              }
            </p>
          </div>
          
          {/* Footage Progress Bars */}
          <FootageProgressBars
            placedSkids={state.placedDeliverySkids}
            vinylStacks={state.deliveryVinylStacks}
            stops={stops}
            type="delivery"
          />

          {/* Grid and Stacks Side by Side - Scrollable */}
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="flex gap-4 items-start">
          {/* Trailer Grid */}
          <TrailerGrid
            key={`delivery-${renderKey}`}
            placedSkids={state.placedDeliverySkids}
            vinylStacks={state.deliveryVinylStacks}
            selectedSkid={activeTab === 'delivery' ? state.selectedSkid : null}
            previewPosition={activeTab === 'delivery' ? state.previewPosition : null}
            draggedSkid={activeTab === 'delivery' ? state.draggedSkid : null}
            activeTab={activeTab}
            actions={activeTab === 'delivery' ? wrappedActions : null}
            stops={stops}
          />

        {/* Outgoing Stack Panel */}
              <div className="flex flex-col min-w-[280px] max-w-[320px] shrink-0">
          <div className="mb-4">
            <h3 className="font-semibold text-sm">Outgoing Stacks</h3>
            <p className="text-xs text-gray-600">
              {activeTab === 'delivery' 
                ? 'Manage stacked items' 
                : 'Switch to Outgoing tab to manage stacks'
              }
            </p>
          </div>
          <StackPanel
            vinylStacks={state.deliveryVinylStacks}
            actions={wrappedActions}
            activeTab={activeTab}
          />
        </div>
            </div>
          </ScrollArea>
        </Card>

        {/* Incoming Layout */}
        <Card 
          id="pickup-layout"
          className={`p-4 overflow-hidden transition-all duration-200 w-fit ${
            activeTab === 'pickup' ? 'ring-2 ring-blue-500 shadow-lg' : 'opacity-50 pointer-events-none'
          } ${activeTab !== 'pickup' && !showBothLayouts ? 'hidden' : ''}`}
          role="tabpanel"
          aria-labelledby="pickup-tab"
          aria-hidden={activeTab !== 'pickup'}
        >
          <div className="mb-4">
            <h3 className="font-semibold">Incoming Layout</h3>
            <p className="text-sm text-gray-600">
              {activeTab === 'pickup' 
                ? 'Click to place selected items on the grid' 
                : 'Switch to Incoming tab to edit this layout'
              }
            </p>
          </div>

          {/* Footage Progress Bars */}
          <FootageProgressBars
            placedSkids={state.placedPickupSkids}
            vinylStacks={state.pickupVinylStacks}
            stops={stops}
            type="pickup"
          />

          {/* Grid and Stacks Side by Side - Scrollable */}
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="flex gap-4 items-start">
          {/* Trailer Grid */}
          <TrailerGrid
            key={`pickup-${renderKey}`}
            placedSkids={state.placedPickupSkids}
            vinylStacks={state.pickupVinylStacks}
            selectedSkid={activeTab === 'pickup' ? state.selectedSkid : null}
            previewPosition={activeTab === 'pickup' ? state.previewPosition : null}
            draggedSkid={activeTab === 'pickup' ? state.draggedSkid : null}
            activeTab={activeTab}
            actions={activeTab === 'pickup' ? wrappedActions : null}
            stops={stops}
          />

        {/* Incoming Stack Panel */}
              <div className="flex flex-col min-w-[280px] max-w-[320px] shrink-0">
          <div className="mb-4">
            <h3 className="font-semibold text-sm">Incoming Stacks</h3>
            <p className="text-xs text-gray-600">
              {activeTab === 'pickup' 
                ? 'Manage stacked items' 
                : 'Switch to Incoming tab to manage stacks'
              }
            </p>
          </div>
          <StackPanel
            vinylStacks={state.pickupVinylStacks}
            actions={wrappedActions}
            activeTab={activeTab}
          />
        </div>
            </div>
          </ScrollArea>
        </Card>
              </div>

      {/* Save Status */}
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          Saving layout...
        </div>
      )}
    </div>
  )
}

// Footage Progress Bars Component
function FootageProgressBars({ 
  placedSkids, 
  vinylStacks, 
  stops, 
  type 
}: {
  placedSkids: any[]
  vinylStacks: any[]
  stops: TruckloadStop[]
  type: 'delivery' | 'pickup'
}) {
  const calculateFootage = useCallback((filterFn: (skid: any) => boolean) => {
    return placedSkids
      .filter(skid => {
        const stack = vinylStacks.find(s => s.stackId === skid.stackId)
        const isBottomSkid = !stack || skid === stack.skids[stack.skids.length - 1]
        const stop = stops.find(s => 
          s.skids_data.some(sd => sd.id === skid.item_id) || 
          s.vinyl_data.some(vd => vd.id === skid.item_id)
        )
        return isBottomSkid && filterFn(skid)
      })
      .reduce((total, skid) => total + (skid.width * skid.length), 0)
  }, [placedSkids, vinylStacks, stops])

  const outgoingFootage = calculateFootage(skid => {
    const stop = stops.find(s => 
      s.skids_data.some(sd => sd.id === skid.item_id) || 
      s.vinyl_data.some(vd => vd.id === skid.item_id)
    )
    return !!(stop?.assignment_type === type && !stop?.is_transfer_order)
  })

  const transferFootage = calculateFootage(skid => {
    const stop = stops.find(s => 
      s.skids_data.some(sd => sd.id === skid.item_id) || 
      s.vinyl_data.some(vd => vd.id === skid.item_id)
    )
    return !!stop?.is_transfer_order
  })

  return (
    <div className="mb-4 space-y-3">
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">
            {type === 'delivery' ? 'Outgoing' : 'Incoming'} Footage
          </span>
          <span className="text-gray-600">{outgoingFootage} ft²</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ 
              width: `${Math.min(100, (outgoingFootage / 424) * 100)}%`
            }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Transfer Footage</span>
          <span className="text-gray-600">{transferFootage} ft²</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-orange-500 transition-all duration-300"
            style={{
              width: `${Math.min(100, (transferFootage / 424) * 100)}%`
            }}
          />
        </div>
      </div>
    </div>
  )
} 