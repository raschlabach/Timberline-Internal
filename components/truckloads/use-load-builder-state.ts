"use client"

import { useState, useCallback, useMemo } from "react"

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
    setPlacedDeliverySkids: (skids) => setState(prev => ({ ...prev, placedDeliverySkids: skids })),
    setPlacedPickupSkids: (skids) => setState(prev => ({ ...prev, placedPickupSkids: skids })),
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

      // Find the customer info for the selected skid
      const customerInfo = stops.find((stop: any) => 
        stop.skids_data.some((skid: { id: number }) => skid.id === state.selectedSkid!.id) ||
        stop.vinyl_data.some((vinyl: { id: number }) => vinyl.id === state.selectedSkid!.id)
      )?.[activeTab === 'delivery' ? 'delivery_customer' : 'pickup_customer']

      if (!customerInfo) return

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
        const stackId = existingStack.stackId || nextStackId
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
        

      } else {
        // Create new stack
        const stackId = nextStackId
        newSkid.stackId = stackId
        newSkid.stackPosition = 1 // First item in new stack
        updatedLayout = [...currentLayoutFromState, newSkid]
        

      }

      // Clear selection states immediately for better UX
      actions.clearSelection()



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
          usedDeliverySkidIds: new Set([...Array.from(prev.usedDeliverySkidIds), state.selectedSkid?.id || 0]),
          tempUpdatedLayout: undefined, // Clear the temporary layout
          deliveryVinylStacks: newVinylStacks, // Update vinyl stacks
          // Increment stack counter if we created a new stack
          nextDeliveryStackId: existingStack ? prev.nextDeliveryStackId : prev.nextDeliveryStackId + 1
        }))
      } else {
        const newVinylStacks = buildVinylStacks(updatedLayout)
        setState(prev => ({
          ...prev,
          placedPickupSkids: updatedLayout,
          usedPickupSkidIds: new Set([...Array.from(prev.usedPickupSkidIds), state.selectedSkid?.id || 0]),
          tempUpdatedLayout: undefined, // Clear the temporary layout
          pickupVinylStacks: newVinylStacks, // Update vinyl stacks
          // Increment stack counter if we created a new stack
          nextPickupStackId: existingStack ? prev.nextPickupStackId : prev.nextPickupStackId + 1
        }))
      }

                    // Auto-save the layout after placing the item
              if (saveLayout) {
                try {
                  await saveLayout(updatedLayout)
                } catch (error) {
                  console.error('Failed to auto-save layout:', error)
                }
              }
    },

    handleGridMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
      if (!state.selectedSkid) return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = Math.floor((e.clientX - rect.left) / CELL_SIZE)
      const y = Math.floor((e.clientY - rect.top) / CELL_SIZE)

      actions.setPreviewPosition({ x, y })
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

      // Remove from usedSkidIds while being placed
      const newUsedSkidIds = new Set(Array.from(usedSkidIds))
      newUsedSkidIds.delete(skidToRotate.item_id)
      
      // Store the updated layout in state for immediate use
      if (activeTab === 'delivery') {
        setState(prev => ({
          ...prev,
          placedDeliverySkids: updatedLayout,
          usedDeliverySkidIds: newUsedSkidIds,
          // Store the updated layout for immediate use in grid click
          tempUpdatedLayout: updatedLayout
        }))
      } else {
        setState(prev => ({
          ...prev,
          placedPickupSkids: updatedLayout,
          usedPickupSkidIds: newUsedSkidIds,
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

      // Remove from usedSkidIds while being placed
      const newUsedSkidIds = new Set(Array.from(usedSkidIds))
      newUsedSkidIds.delete(skidToMove.item_id)
      
      // Store the updated layout in state for immediate use
      if (activeTab === 'delivery') {
        setState(prev => ({
          ...prev,
          placedDeliverySkids: updatedLayout,
          usedDeliverySkidIds: newUsedSkidIds,
          // Store the updated layout for immediate use in grid click
          tempUpdatedLayout: updatedLayout
        }))
      } else {
        setState(prev => ({
          ...prev,
          placedPickupSkids: updatedLayout,
          usedPickupSkidIds: newUsedSkidIds,
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
        
        // Remove all stack skids from usedSkidIds
        const newUsedSkidIds = new Set(Array.from(usedSkidIds))
        currentStack.skids.forEach(s => newUsedSkidIds.delete(s.item_id))
        
        // Update state with rebuilt vinyl stacks
        if (activeTab === 'delivery') {
          const newVinylStacks = buildVinylStacks(updatedLayout)
          setState(prev => ({
            ...prev,
            placedDeliverySkids: updatedLayout,
            usedDeliverySkidIds: newUsedSkidIds,
            deliveryVinylStacks: newVinylStacks
          }))
        } else {
          const newVinylStacks = buildVinylStacks(updatedLayout)
          setState(prev => ({
            ...prev,
            placedPickupSkids: updatedLayout,
            usedPickupSkidIds: newUsedSkidIds,
            pickupVinylStacks: newVinylStacks
          }))
        }
      } else {
        // For single items
        updatedLayout = currentLayout.filter(s => s.item_id !== skid.item_id)
        const newUsedSkidIds = new Set(Array.from(usedSkidIds))
        newUsedSkidIds.delete(skid.item_id)
        
        // Update state with rebuilt vinyl stacks
        if (activeTab === 'delivery') {
          const newVinylStacks = buildVinylStacks(updatedLayout)
          setState(prev => ({
            ...prev,
            placedDeliverySkids: updatedLayout,
            usedDeliverySkidIds: newUsedSkidIds,
            deliveryVinylStacks: newVinylStacks
          }))
        } else {
          const newVinylStacks = buildVinylStacks(updatedLayout)
          setState(prev => ({
            ...prev,
            placedPickupSkids: updatedLayout,
            usedPickupSkidIds: newUsedSkidIds,
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
      if (itemIndex === -1) return
      
      // Calculate new position
      const newIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1
      if (newIndex < 0 || newIndex >= stackItems.length) return
      
      // Swap positions
      const updatedStackItems = [...stackItems]
      const temp = updatedStackItems[itemIndex].stackPosition
      updatedStackItems[itemIndex].stackPosition = updatedStackItems[newIndex].stackPosition
      updatedStackItems[newIndex].stackPosition = temp
      
      // Create updated layout
      const updatedLayout = [
        ...currentLayout.filter(item => item.stackId !== stackId),
        ...updatedStackItems
      ]
      
      if (activeTab === 'delivery') {
        actions.setPlacedDeliverySkids(updatedLayout)
      } else {
        actions.setPlacedPickupSkids(updatedLayout)
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
      // Remove the skid from the layout
      const updatedLayout = currentLayout.filter(skid => skid.item_id !== skidId)
      
      // Make skid available again
      const newUsedSkidIds = new Set(Array.from(usedSkidIds))
      newUsedSkidIds.delete(skidId)
      
      if (activeTab === 'delivery') {
        actions.setPlacedDeliverySkids(updatedLayout)
        actions.setUsedDeliverySkidIds(newUsedSkidIds)
      } else {
        actions.setPlacedPickupSkids(updatedLayout)
        actions.setUsedPickupSkidIds(newUsedSkidIds)
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
  }), [activeTab, currentLayout, usedSkidIds, vinylStacks, nextStackId, state.selectedSkid, state.draggedSkid, state.deliveryVinylStacks, state.pickupVinylStacks])

  return {
    state: { ...state, currentLayout },
    actions,
    activeTab,
    setActiveTab
  }
} 