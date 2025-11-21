"use client"

import { useState, useCallback, useMemo } from "react"
import { toast } from "sonner"

interface GridPosition {
  x: number
  y: number
  width: number
  length: number
  item_id: number
  type: 'skid' | 'vinyl'
  customerId: number
  rotation: number
  customerName: string
  stackId?: number
  stackPosition?: number
}

interface VinylStack {
  stackId: number
  x: number
  y: number
  skids: GridPosition[]
}

interface LoadBuilderState {
  selectedSkid: {
    id: number
    width: number
    length: number
    type: 'skid' | 'vinyl'
    isPickup?: boolean
  } | null
  placedDeliverySkids: GridPosition[]
  placedPickupSkids: GridPosition[]
  previewPosition: {x: number, y: number} | null
  usedDeliverySkidIds: Set<number>
  usedPickupSkidIds: Set<number>
  draggedSkid: GridPosition | null
  skidRotations: Map<number, boolean>
  deliveryVinylStacks: VinylStack[]
  pickupVinylStacks: VinylStack[]
  nextDeliveryStackId: number
  nextPickupStackId: number
  tempUpdatedLayout?: GridPosition[]
}

interface LoadBuilderActions {
  setSelectedSkid: (skid: LoadBuilderState['selectedSkid']) => void
  setPlacedDeliverySkids: (skids: GridPosition[]) => void
  setPlacedPickupSkids: (skids: GridPosition[]) => void
  setPreviewPosition: (position: {x: number, y: number} | null) => void
  setUsedDeliverySkidIds: (ids: Set<number>) => void
  setUsedPickupSkidIds: (ids: Set<number>) => void
  setDraggedSkid: (skid: GridPosition | null) => void
  setSkidRotations: (rotations: Map<number, boolean>) => void
  setDeliveryVinylStacks: (stacks: VinylStack[]) => void
  setPickupVinylStacks: (stacks: VinylStack[]) => void
  setNextDeliveryStackId: (id: number) => void
  setNextPickupStackId: (id: number) => void
  clearSelection: () => void
  handleGridClick: (x: number, y: number, stops: any[], saveLayout?: (layout: GridPosition[]) => Promise<void>) => void
  handleGridMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  handleGridMouseLeave: () => void
  handleRotate: (skidIndex: number) => void
  handleMove: (skidIndex: number) => void
  handleRemove: (skid: GridPosition, isStack: boolean, currentStack?: VinylStack, saveLayout?: (layout: GridPosition[]) => Promise<void>) => void
  moveInStack: (stackId: number, skidId: number, direction: 'up' | 'down', saveLayout?: (layout: GridPosition[]) => Promise<void>) => void
  removeFromStack: (stackId: number, skidId: number, saveLayout?: (layout: GridPosition[]) => Promise<void>) => void
  handleSkidRotation: (skidId: number, isRotated: boolean) => void
}

const GRID_WIDTH = 8
const GRID_LENGTH = 53
const CELL_SIZE = 24

export function useLoadBuilderState(truckloadId: number) {
  const [activeTab, setActiveTab] = useState<'delivery' | 'pickup'>('delivery')
  
  const [state, setState] = useState<LoadBuilderState>({
    selectedSkid: null,
    placedDeliverySkids: [],
    placedPickupSkids: [],
    previewPosition: null,
    usedDeliverySkidIds: new Set(),
    usedPickupSkidIds: new Set(),
    draggedSkid: null,
    skidRotations: new Map(),
    deliveryVinylStacks: [],
    pickupVinylStacks: [],
    nextDeliveryStackId: 1,
    nextPickupStackId: 1
  })

  // Computed values
  const currentLayout = useMemo(() => 
    activeTab === 'delivery' ? state.placedDeliverySkids : state.placedPickupSkids,
    [activeTab, state.placedDeliverySkids, state.placedPickupSkids]
  )

  const usedSkidIds = useMemo(() => 
    activeTab === 'delivery' ? state.usedDeliverySkidIds : state.usedPickupSkidIds,
    [activeTab, state.usedDeliverySkidIds, state.usedPickupSkidIds]
  )

  const vinylStacks = useMemo(() => 
    activeTab === 'delivery' ? state.deliveryVinylStacks : state.pickupVinylStacks,
    [activeTab, state.deliveryVinylStacks, state.pickupVinylStacks]
  )

  const nextStackId = useMemo(() => 
    activeTab === 'delivery' ? state.nextDeliveryStackId : state.nextPickupStackId,
    [activeTab, state.nextDeliveryStackId, state.nextPickupStackId]
  )

  // Helper functions
  const hasCollisions = useCallback((skid: GridPosition, allSkids: GridPosition[], excludeIndex?: number) => {
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
  }, [])

  const getVinylStackAtPosition = useCallback((x: number, y: number): VinylStack | undefined => {
    return vinylStacks.find(stack => stack.x === x && stack.y === y)
  }, [vinylStacks])

  // Actions
  const actions: LoadBuilderActions = useMemo(() => ({
    setSelectedSkid: (skid) => setState(prev => ({ ...prev, selectedSkid: skid })),
    setPlacedDeliverySkids: (skids) => {
      console.log('setPlacedDeliverySkids called with', skids.length, 'items', skids)
      setState(prev => {
        console.log('Updating delivery skids state, prev count:', prev.placedDeliverySkids.length, 'new count:', skids.length)
        // Create a new array reference to ensure React detects the change
        return { ...prev, placedDeliverySkids: [...skids] }
      })
    },
    setPlacedPickupSkids: (skids) => {
      console.log('setPlacedPickupSkids called with', skids.length, 'items', skids)
      setState(prev => {
        console.log('Updating pickup skids state, prev count:', prev.placedPickupSkids.length, 'new count:', skids.length)
        // Create a new array reference to ensure React detects the change
        return { ...prev, placedPickupSkids: [...skids] }
      })
    },
    setPreviewPosition: (position) => setState(prev => ({ ...prev, previewPosition: position })),
    setUsedDeliverySkidIds: (ids) => setState(prev => ({ ...prev, usedDeliverySkidIds: ids })),
    setUsedPickupSkidIds: (ids) => setState(prev => ({ ...prev, usedPickupSkidIds: ids })),
    setDraggedSkid: (skid) => setState(prev => ({ ...prev, draggedSkid: skid })),
    setSkidRotations: (rotations) => setState(prev => ({ ...prev, skidRotations: rotations })),
    setDeliveryVinylStacks: (stacks) => setState(prev => ({ ...prev, deliveryVinylStacks: stacks })),
    setPickupVinylStacks: (stacks) => setState(prev => ({ ...prev, pickupVinylStacks: stacks })),
    setNextDeliveryStackId: (id) => setState(prev => ({ ...prev, nextDeliveryStackId: id })),
    setNextPickupStackId: (id) => setState(prev => ({ ...prev, nextPickupStackId: id })),
    clearSelection: () => {
      setState(prev => ({
        ...prev,
        selectedSkid: null,
        previewPosition: null,
        draggedSkid: null,
        tempUpdatedLayout: undefined // Clear the temporary layout
      }))
    },
                handleGridClick: async (x: number, y: number, stops: any[], saveLayout?: (layout: GridPosition[]) => Promise<void>) => {
              if (!state.selectedSkid) return

      // Validate input parameters
      if (typeof x !== 'number' || typeof y !== 'number' || !Array.isArray(stops)) {
        console.error('Invalid parameters passed to handleGridClick')
        return
      }

      // Find the stop and item data for the selected skid
      const stopWithItem = stops.find((stop: any) => 
        stop.skids_data.some((skid: { id: number }) => skid.id === state.selectedSkid!.id) ||
        stop.vinyl_data.some((vinyl: { id: number }) => vinyl.id === state.selectedSkid!.id)
      )

      if (!stopWithItem) {
        console.error('Stop not found for skid:', state.selectedSkid)
        return
      }

      // Get the item data (skid or vinyl) to check quantity
      const itemData = stopWithItem.skids_data.find((skid: { id: number }) => skid.id === state.selectedSkid!.id) ||
                      stopWithItem.vinyl_data.find((vinyl: { id: number }) => vinyl.id === state.selectedSkid!.id)

      if (!itemData || !itemData.quantity) {
        console.error('Item data not found for skid:', state.selectedSkid)
        return
      }

      // Count how many times this item has already been placed
      const placedCount = currentLayout.filter(skid => skid.item_id === state.selectedSkid!.id).length

      // Check if we've reached the quantity limit
      if (placedCount >= itemData.quantity) {
        toast.warning(`Cannot place more items: All ${itemData.quantity} of this item have already been placed`)
        return // Don't allow placement if quantity is exceeded
      }

      const customerInfo = stopWithItem[activeTab === 'delivery' ? 'delivery_customer' : 'pickup_customer']

      if (!customerInfo || !customerInfo.id || !customerInfo.name) {
        console.error('Customer info not found for skid:', state.selectedSkid, 'stops:', stops)
        return
      }

      // Snap to grid and validate bounds
      const snappedX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor(x)))
      const snappedY = Math.max(0, Math.min(GRID_LENGTH - 1, Math.floor(y)))

      // Check if placement is valid
      if (snappedX + state.selectedSkid.width > GRID_WIDTH || 
          snappedY + state.selectedSkid.length > GRID_LENGTH) {
        return // Invalid placement
      }

      // Use the temporary updated layout if available, otherwise use the computed currentLayout
      const currentLayoutFromState = state.tempUpdatedLayout || currentLayout
      
      // Check for existing stack at this position (any item at the same x,y coordinates)
      const existingStack = currentLayoutFromState.find(skid => 
        skid.x === snappedX && 
        skid.y === snappedY
      )
      


      // Check for collisions with non-stack items
      const hasCollision = currentLayoutFromState.some(skid => {
        // Skip collision check with items at the same position (stacking is allowed)
        if (skid.x === snappedX && skid.y === snappedY) return false
        
        const horizontalOverlap = !(
          snappedX >= skid.x + skid.width ||
          snappedX + state.selectedSkid!.width <= skid.x
        )
        const verticalOverlap = !(
          snappedY >= skid.y + skid.length ||
          snappedY + state.selectedSkid!.length <= skid.y
        )
        return horizontalOverlap && verticalOverlap
      })

      if (hasCollision) return // Invalid placement if collision (stacking is handled separately)

      // Create the new skid
      const newSkid: GridPosition = {
        x: snappedX,
        y: snappedY,
        width: state.selectedSkid.width,
        length: state.selectedSkid.length,
        item_id: state.selectedSkid.id,
        type: state.selectedSkid.type,
        customerId: customerInfo.id,
        rotation: state.draggedSkid?.rotation || 0,
        customerName: customerInfo.name
      }

      // Prepare the layout update
      let updatedLayout: GridPosition[]
      if (existingStack) {
        // Add to existing stack
        const stackId = existingStack.stackId
        if (!stackId) {
          // If existing stack has no ID, assign the next available ID
          const newStackId = nextStackId
          newSkid.stackId = newStackId
          newSkid.stackPosition = 1
          updatedLayout = [...currentLayoutFromState, newSkid]
        } else {
          // Add to existing stack with known ID
        const stackItems = currentLayoutFromState.filter(item => 
          item.stackId === stackId || (item.x === snappedX && item.y === snappedY)
        )
        
        // Add new item to stack
        newSkid.stackId = stackId
        newSkid.stackPosition = (stackItems.length + 1) // New item goes on top
        
        // Update all items in the stack to ensure proper positions and same stackId
        const updatedStackItems = stackItems.map((item, index) => ({
          ...item,
          stackId: stackId, // Ensure all items in stack have same stackId
          stackPosition: index + 1 // Ensure proper positions (1, 2, 3, etc.)
        }))
        
        // Combine updated stack items with new item and non-stack items
        updatedLayout = [
          ...currentLayoutFromState.filter(item => 
            item.stackId !== stackId && !(item.x === snappedX && item.y === snappedY)
          ),
          ...updatedStackItems,
          newSkid
        ]
        }
      } else {
        // Create new stack with next sequential ID
        const stackId = nextStackId
        newSkid.stackId = stackId
        newSkid.stackPosition = 1 // First item in new stack
        updatedLayout = [...currentLayoutFromState, newSkid]
      }

      // Don't clear selection - allow placing multiple items of the same type
      // Preview position and dragged skid will be cleared in the layout update below

      // Helper function to build vinyl stacks from layout
      const buildVinylStacks = (layout: GridPosition[]) => {
        const stacks: VinylStack[] = []
        const stackMap = new Map<number, GridPosition[]>()
        
        // Group items by stack
        layout.forEach(item => {
          if (item.stackId) {
            if (!stackMap.has(item.stackId)) {
              stackMap.set(item.stackId, [])
            }
            stackMap.get(item.stackId)?.push(item)
          }
        })

        // Process stacks
        stackMap.forEach((items, stackId) => {
          // Sort by stack position (highest first)
          items.sort((a, b) => (b.stackPosition || 0) - (a.stackPosition || 0))
          
          // Create stack object
          stacks.push({
            stackId,
            skids: items,
            x: items[items.length - 1].x,
            y: items[items.length - 1].y
          })
        })

        return stacks
      }

      // Update state based on active tab using setState callback and clear temp layout
      if (activeTab === 'delivery') {
        const newVinylStacks = buildVinylStacks(updatedLayout)
        setState(prev => ({
          ...prev,
          placedDeliverySkids: updatedLayout,
          // Don't add to usedSkidIds - we'll check quantity dynamically
          tempUpdatedLayout: undefined, // Clear the temporary layout
          deliveryVinylStacks: newVinylStacks, // Update vinyl stacks
          previewPosition: null, // Clear preview position after placement
          draggedSkid: null, // Clear dragged skid after placement
          selectedSkid: null, // Deselect skid after placement
          // Increment stack counter if we created a new stack
          nextDeliveryStackId: existingStack ? prev.nextDeliveryStackId : prev.nextDeliveryStackId + 1
        }))
      } else {
        const newVinylStacks = buildVinylStacks(updatedLayout)
        setState(prev => ({
          ...prev,
          placedPickupSkids: updatedLayout,
          // Don't add to usedSkidIds - we'll check quantity dynamically
          tempUpdatedLayout: undefined, // Clear the temporary layout
          pickupVinylStacks: newVinylStacks, // Update vinyl stacks
          previewPosition: null, // Clear preview position after placement
          draggedSkid: null, // Clear dragged skid after placement
          selectedSkid: null, // Deselect skid after placement
          // Increment stack counter if we created a new stack
          nextPickupStackId: existingStack ? prev.nextPickupStackId : prev.nextPickupStackId + 1
        }))
      }

                    // Auto-save the layout after placing the item
              if (saveLayout) {
                try {
                  console.log(`Saving ${activeTab} layout with ${updatedLayout.length} items. Active tab: ${activeTab}`)
                  console.log('Updated layout items:', updatedLayout.map(item => ({
                    item_id: item.item_id,
                    x: item.x,
                    y: item.y,
                    stackId: item.stackId,
                    customerName: item.customerName
                  })))
                  await saveLayout(updatedLayout)
                  console.log(`Layout saved successfully for ${activeTab} tab`)
                } catch (error) {
                  console.error('Failed to auto-save layout:', error)
                  toast.error(`Failed to save layout: ${error instanceof Error ? error.message : 'Unknown error'}`)
                }
              } else {
                console.warn('saveLayout function not provided to handleGridClick')
              }
    },

    handleGridMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
      if (!state.selectedSkid) {
        // If no skid is selected, make sure preview is cleared
        if (state.previewPosition) {
          actions.setPreviewPosition(null)
        }
        return
      }

      const rect = e.currentTarget.getBoundingClientRect()
      const x = Math.floor((e.clientX - rect.left) / CELL_SIZE)
      const y = Math.floor((e.clientY - rect.top) / CELL_SIZE)

      // Only update preview if we have a valid position
      const snappedX = Math.max(0, Math.min(GRID_WIDTH - 1, x))
      const snappedY = Math.max(0, Math.min(GRID_LENGTH - 1, y))
      
      actions.setPreviewPosition({ x: snappedX, y: snappedY })
    },

    handleGridMouseLeave: () => {
      actions.setPreviewPosition(null)
    },

                handleRotate: (skidIndex: number) => {
              const skidToRotate = currentLayout[skidIndex]
      
      // Remove the skid from current layout
      const updatedLayout = currentLayout.filter((_, index) => index !== skidIndex)
      
      // Update rotation state
      const newRotations = new Map(state.skidRotations)
      const currentRotation = newRotations.get(skidToRotate.item_id) || false
      newRotations.set(skidToRotate.item_id, !currentRotation)
      actions.setSkidRotations(newRotations)
      
      // Set it as the selected skid with rotated dimensions
      actions.setSelectedSkid({
        id: skidToRotate.item_id,
        // Swap width and length
        width: skidToRotate.length,
        length: skidToRotate.width,
        type: skidToRotate.type
      })

      // Store the rotated skid info for preview
      actions.setDraggedSkid({
        ...skidToRotate,
        width: skidToRotate.length,
        length: skidToRotate.width,
        rotation: 0 // No visual rotation needed
      })
      
      // Store the updated layout in state for immediate use
      if (activeTab === 'delivery') {
        setState(prev => ({
          ...prev,
          placedDeliverySkids: updatedLayout,
          // Store the updated layout for immediate use in grid click
          tempUpdatedLayout: updatedLayout
        }))
      } else {
        setState(prev => ({
          ...prev,
          placedPickupSkids: updatedLayout,
          // Store the updated layout for immediate use in grid click
          tempUpdatedLayout: updatedLayout
        }))
      }
    },

    handleMove: (skidIndex: number) => {
      const skidToMove = currentLayout[skidIndex]
      
      // Remove the skid from current layout
      const updatedLayout = currentLayout.filter((_, index) => index !== skidIndex)
      
      // Set it as the selected skid (keep same dimensions)
      actions.setSelectedSkid({
        id: skidToMove.item_id,
        width: skidToMove.width,
        length: skidToMove.length,
        type: skidToMove.type
      })

      // Store the skid info for preview (keep same dimensions)
      actions.setDraggedSkid({
        ...skidToMove,
        rotation: 0
      })
      
      // Store the updated layout in state for immediate use
      if (activeTab === 'delivery') {
        setState(prev => ({
          ...prev,
          placedDeliverySkids: updatedLayout,
          // Store the updated layout for immediate use in grid click
          tempUpdatedLayout: updatedLayout
        }))
      } else {
        setState(prev => ({
          ...prev,
          placedPickupSkids: updatedLayout,
          // Store the updated layout for immediate use in grid click
          tempUpdatedLayout: updatedLayout
        }))
      }
    },

    handleRemove: async (skid: GridPosition, isStack: boolean, currentStack?: VinylStack, saveLayout?: (layout: GridPosition[]) => Promise<void>) => {
      let updatedLayout: GridPosition[]
      
      // Helper function to build vinyl stacks from layout
      const buildVinylStacks = (layout: GridPosition[]) => {
        const stacks: VinylStack[] = []
        const stackMap = new Map<number, GridPosition[]>()
        
        // Group items by stack
        layout.forEach(item => {
          if (item.stackId) {
            if (!stackMap.has(item.stackId)) {
              stackMap.set(item.stackId, [])
            }
            stackMap.get(item.stackId)?.push(item)
          }
        })

        // Process stacks
        stackMap.forEach((items, stackId) => {
          // Sort by stack position (highest first)
          items.sort((a, b) => (b.stackPosition || 0) - (a.stackPosition || 0))
          
          // Create stack object
          stacks.push({
            stackId,
            skids: items,
            x: items[items.length - 1].x,
            y: items[items.length - 1].y
          })
        })

        return stacks
      }
      
      if (isStack && currentStack) {
        // For stacks, remove all skids in the stack
        updatedLayout = currentLayout.filter(s => s.stackId !== currentStack.stackId)
        
        // Update state with rebuilt vinyl stacks
        if (activeTab === 'delivery') {
          const newVinylStacks = buildVinylStacks(updatedLayout)
          setState(prev => ({
            ...prev,
            placedDeliverySkids: updatedLayout,
            deliveryVinylStacks: newVinylStacks
          }))
        } else {
          const newVinylStacks = buildVinylStacks(updatedLayout)
          setState(prev => ({
            ...prev,
            placedPickupSkids: updatedLayout,
            pickupVinylStacks: newVinylStacks
          }))
        }
      } else {
        // For single items - remove only the first matching item_id
        const itemIndex = currentLayout.findIndex(s => s.item_id === skid.item_id)
        if (itemIndex !== -1) {
          updatedLayout = [...currentLayout.slice(0, itemIndex), ...currentLayout.slice(itemIndex + 1)]
        } else {
          updatedLayout = currentLayout
        }
        
        // Update state with rebuilt vinyl stacks
        if (activeTab === 'delivery') {
          const newVinylStacks = buildVinylStacks(updatedLayout)
          setState(prev => ({
            ...prev,
            placedDeliverySkids: updatedLayout,
            deliveryVinylStacks: newVinylStacks
          }))
        } else {
          const newVinylStacks = buildVinylStacks(updatedLayout)
          setState(prev => ({
            ...prev,
            placedPickupSkids: updatedLayout,
            pickupVinylStacks: newVinylStacks
          }))
        }
      }

      // Auto-save the layout after removing the item
      if (saveLayout) {
        try {
          await saveLayout(updatedLayout)
        } catch (error) {
          console.error('Failed to auto-save layout after removal:', error)
        }
      }
    },

    moveInStack: async (stackId: number, skidId: number, direction: 'up' | 'down', saveLayout?: (layout: GridPosition[]) => Promise<void>) => {
      // Get all items in this stack
      const stackItems = currentLayout.filter(item => item.stackId === stackId)
      
      // Find the item to move and its current index
      const itemIndex = stackItems.findIndex(item => item.item_id === skidId)
      if (itemIndex === -1) {
        console.error('Item not found in stack:', { stackId, skidId, stackItems })
        return
      }
      
      // Calculate new position (swapped: up arrow moves down in array, down arrow moves up in array)
      const newIndex = direction === 'up' ? itemIndex + 1 : itemIndex - 1
      if (newIndex < 0 || newIndex >= stackItems.length) {
        console.error('Invalid new index:', { newIndex, stackLength: stackItems.length })
        return
      }
      
      // Swap positions by updating stackPosition
      const updatedStackItems = stackItems.map((item, idx) => {
        if (idx === itemIndex) {
          return { ...item, stackPosition: stackItems[newIndex].stackPosition }
        }
        if (idx === newIndex) {
          return { ...item, stackPosition: stackItems[itemIndex].stackPosition }
        }
        return item
      })
      
      // Create updated layout
      const updatedLayout = [
        ...currentLayout.filter(item => item.stackId !== stackId),
        ...updatedStackItems
      ]
      
      // Rebuild vinyl stacks
      const buildVinylStacks = (layout: GridPosition[]) => {
        const stacks: VinylStack[] = []
        const stackMap = new Map<number, GridPosition[]>()
        
        layout.forEach(item => {
          if (item.stackId) {
            if (!stackMap.has(item.stackId)) {
              stackMap.set(item.stackId, [])
            }
            stackMap.get(item.stackId)?.push(item)
          }
        })

        stackMap.forEach((items, stackId) => {
          items.sort((a, b) => (b.stackPosition || 0) - (a.stackPosition || 0))
          stacks.push({
            stackId,
            skids: items,
            x: items[items.length - 1].x,
            y: items[items.length - 1].y
          })
        })

        return stacks
      }
      
      const newVinylStacks = buildVinylStacks(updatedLayout)
      
      if (activeTab === 'delivery') {
        actions.setPlacedDeliverySkids(updatedLayout)
        actions.setDeliveryVinylStacks(newVinylStacks)
      } else {
        actions.setPlacedPickupSkids(updatedLayout)
        actions.setPickupVinylStacks(newVinylStacks)
      }

      // Auto-save the layout after moving the item
      if (saveLayout) {
        try {
          await saveLayout(updatedLayout)
        } catch (error) {
          console.error('Failed to auto-save layout after move:', error)
        }
      }
    },

    removeFromStack: async (stackId: number, skidId: number, saveLayout?: (layout: GridPosition[]) => Promise<void>) => {
      // Remove the skid from the layout (remove only the first matching item_id in this stack)
      const stackItems = currentLayout.filter(item => item.stackId === stackId)
      const itemToRemove = stackItems.find(item => item.item_id === skidId)
      
      if (!itemToRemove) {
        console.error('Item not found in stack to remove:', { stackId, skidId, stackItems })
        return
      }
      
      // Remove the item and renumber remaining stack positions
      const remainingStackItems = stackItems
        .filter(item => !(item.item_id === skidId && item.x === itemToRemove.x && item.y === itemToRemove.y))
        .map((item, idx) => ({
          ...item,
          stackPosition: stackItems.length - idx // Renumber positions (highest = top)
        }))
      
      const updatedLayout = [
        ...currentLayout.filter(item => item.stackId !== stackId),
        ...remainingStackItems
      ]
      
      // Rebuild vinyl stacks
      const buildVinylStacks = (layout: GridPosition[]) => {
        const stacks: VinylStack[] = []
        const stackMap = new Map<number, GridPosition[]>()
        
        layout.forEach(item => {
          if (item.stackId) {
            if (!stackMap.has(item.stackId)) {
              stackMap.set(item.stackId, [])
            }
            stackMap.get(item.stackId)?.push(item)
          }
        })

        stackMap.forEach((items, stackId) => {
          items.sort((a, b) => (b.stackPosition || 0) - (a.stackPosition || 0))
          stacks.push({
            stackId,
            skids: items,
            x: items[items.length - 1].x,
            y: items[items.length - 1].y
          })
        })

        return stacks
      }
      
      const newVinylStacks = buildVinylStacks(updatedLayout)
      
      if (activeTab === 'delivery') {
        actions.setPlacedDeliverySkids(updatedLayout)
        actions.setDeliveryVinylStacks(newVinylStacks)
      } else {
        actions.setPlacedPickupSkids(updatedLayout)
        actions.setPickupVinylStacks(newVinylStacks)
      }

      // Auto-save the layout after removing from stack
      if (saveLayout) {
        try {
          await saveLayout(updatedLayout)
        } catch (error) {
          console.error('Failed to auto-save layout after stack removal:', error)
        }
      }
    },

    handleSkidRotation: (skidId: number, isRotated: boolean) => {
      setState(prev => {
        const next = new Map(prev.skidRotations)
        next.set(skidId, isRotated)
        return { ...prev, skidRotations: next }
      })
    }
  }), [activeTab, currentLayout, vinylStacks, nextStackId, state.selectedSkid, state.draggedSkid, state.deliveryVinylStacks, state.pickupVinylStacks])

  return {
    state: { ...state, currentLayout },
    actions,
    activeTab,
    setActiveTab
  }
} 