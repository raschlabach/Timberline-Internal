"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MiniSkid } from "./mini-skid"

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

interface LoadBuilderState {
  selectedSkid: {
    id: number
    width: number
    length: number
    type: 'skid' | 'vinyl'
    isPickup?: boolean
  } | null
  placedDeliverySkids: any[]
  placedPickupSkids: any[]
  usedDeliverySkidIds: Set<number>
  usedPickupSkidIds: Set<number>
  skidRotations: Map<number, boolean>
}

interface LoadBuilderActions {
  setSelectedSkid: (skid: LoadBuilderState['selectedSkid']) => void
  setPlacedDeliverySkids: (skids: any[]) => void
  setPlacedPickupSkids: (skids: any[]) => void
  setUsedDeliverySkidIds: (ids: Set<number>) => void
  setUsedPickupSkidIds: (ids: Set<number>) => void
  setSkidRotations: (rotations: Map<number, boolean>) => void
  setPreviewPosition?: (position: {x: number, y: number} | null) => void
  handleSkidRotation: (skidId: number, isRotated: boolean) => void
}

interface AvailableItemsPanelProps {
  stops: TruckloadStop[]
  activeTab: 'delivery' | 'pickup'
  state: LoadBuilderState
  actions: LoadBuilderActions
  saveLayout?: (layout: any[]) => Promise<void>
}

export function AvailableItemsPanel({ 
  stops, 
  activeTab, 
  state, 
  actions,
  saveLayout
}: AvailableItemsPanelProps) {
  const placedSkids = activeTab === 'delivery' ? state.placedDeliverySkids : state.placedPickupSkids
  
  // Count how many times each skid ID has been placed
  const getPlacedCount = (skidId: number) => {
    return placedSkids.filter(skid => skid.item_id === skidId).length
  }
  
  // Check if a skid is fully used (all quantity placed)
  const isSkidFullyUsed = (skid: { id: number; quantity: number }) => {
    const placedCount = getPlacedCount(skid.id)
    return placedCount >= skid.quantity
  }

  const handleClear = async () => {
    // Only clear the layout for the currently active tab (incoming or outgoing)
    if (activeTab === 'delivery') {
      // Clear outgoing layout only
      actions.setPlacedDeliverySkids([])
      actions.setUsedDeliverySkidIds(new Set())
    } else {
      // Clear incoming layout only
      actions.setPlacedPickupSkids([])
      actions.setUsedPickupSkidIds(new Set())
    }
    
    // Clear selection and preview only if they're for the active tab
    // (Selection is shared, so we clear it, but it will be re-selected if needed)
    actions.setSelectedSkid(null)
    if (actions.setPreviewPosition) {
      actions.setPreviewPosition(null)
    }
    
    // Note: We don't clear skidRotations as they're shared between tabs
    // and might be needed for the other tab
    
    // Save the empty layout for the active tab only
    if (saveLayout) {
      try {
        await saveLayout([])
      } catch (error) {
        console.error('Failed to save cleared layout:', error)
      }
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Available Items</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={placedSkids.length === 0}
          title={activeTab === 'delivery' ? 'Clear all outgoing items' : 'Clear all incoming items'}
        >
          Clear {activeTab === 'delivery' ? 'Outgoing' : 'Incoming'}
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
                    isSelected={state.selectedSkid?.id === skid.id}
                    isUsed={isSkidFullyUsed(skid)}
                    customerId={activeTab === 'delivery' ? stop.delivery_customer.id : stop.pickup_customer.id}
                    customerName={activeTab === 'delivery' ? stop.delivery_customer.name : stop.pickup_customer.name}
                    onRotate={() => {
                      const newRotated = !state.skidRotations.get(skid.id)
                      actions.handleSkidRotation(skid.id, newRotated)
                      if (state.selectedSkid?.id === skid.id) {
                        actions.setSelectedSkid({
                          ...state.selectedSkid,
                          width: state.selectedSkid.length,
                          length: state.selectedSkid.width
                        })
                      }
                    }}
                    onClick={() => {
                      if (!isSkidFullyUsed(skid)) {
                        const isRotated = state.skidRotations.get(skid.id)
                        actions.setSelectedSkid({
                          id: skid.id,
                          width: isRotated ? skid.length : skid.width,
                          length: isRotated ? skid.width : skid.length,
                          type: 'skid',
                          isPickup: activeTab === 'pickup'
                        })
                      }
                    }}
                    isRotated={state.skidRotations.get(skid.id) || false}
                  />
                ))}
                {stop.vinyl_data.map((vinyl) => (
                  <MiniSkid
                    key={`vinyl-${vinyl.id}`}
                    width={vinyl.width}
                    length={vinyl.length}
                    type="vinyl"
                    isSelected={state.selectedSkid?.id === vinyl.id}
                    isUsed={isSkidFullyUsed(vinyl)}
                    customerId={activeTab === 'delivery' ? stop.delivery_customer.id : stop.pickup_customer.id}
                    customerName={activeTab === 'delivery' ? stop.delivery_customer.name : stop.pickup_customer.name}
                    onRotate={() => {
                      const newRotated = !state.skidRotations.get(vinyl.id)
                      actions.handleSkidRotation(vinyl.id, newRotated)
                      if (state.selectedSkid?.id === vinyl.id) {
                        actions.setSelectedSkid({
                          ...state.selectedSkid,
                          width: state.selectedSkid.length,
                          length: state.selectedSkid.width
                        })
                      }
                    }}
                    onClick={() => {
                      if (!isSkidFullyUsed(vinyl)) {
                        const isRotated = state.skidRotations.get(vinyl.id)
                        actions.setSelectedSkid({
                          id: vinyl.id,
                          width: isRotated ? vinyl.length : vinyl.width,
                          length: isRotated ? vinyl.width : vinyl.length,
                          type: 'vinyl',
                          isPickup: activeTab === 'pickup'
                        })
                      }
                    }}
                    isRotated={state.skidRotations.get(vinyl.id) || false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
} 