"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { debounce } from "lodash"

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

interface LoadBuilderActions {
  setPlacedDeliverySkids: (skids: GridPosition[]) => void
  setPlacedPickupSkids: (skids: GridPosition[]) => void
  setUsedDeliverySkidIds: (ids: Set<number>) => void
  setUsedPickupSkidIds: (ids: Set<number>) => void
  setDeliveryVinylStacks: (stacks: VinylStack[]) => void
  setPickupVinylStacks: (stacks: VinylStack[]) => void
  setNextDeliveryStackId: (id: number) => void
  setNextPickupStackId: (id: number) => void
}

export function useLayoutOperations(
  truckloadId: number,
  activeTab: 'delivery' | 'pickup',
  actions: LoadBuilderActions
) {
  const [isSaving, setIsSaving] = useState(false)

  // Function to process layout data
  const processLayoutData = useCallback((layout: any[]) => {
    const stacks: VinylStack[] = []
    const finalLayout: GridPosition[] = []
    let maxStackId = 0

    // Group items by stack
    const stackMap = new Map<number, GridPosition[]>()
    layout.forEach(item => {
      if (item.stackId) {
        if (!stackMap.has(item.stackId)) {
          stackMap.set(item.stackId, [])
        }
        stackMap.get(item.stackId)?.push(item)
        maxStackId = Math.max(maxStackId, item.stackId)
      } else {
        finalLayout.push(item)
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

      // Add all items to final layout
      finalLayout.push(...items)
    })

    return { finalLayout, stacks, maxStackId }
  }, [])

  // Function to fetch layout data
  const fetchLayoutData = useCallback(async () => {
    if (!truckloadId) return

    try {
      // Fetch both layouts at once to ensure consistency
      const [deliveryLayout, pickupLayout] = await Promise.all([
        fetch(`/api/truckloads/${truckloadId}/layout?type=delivery`).then(r => r.json()),
        fetch(`/api/truckloads/${truckloadId}/layout?type=pickup`).then(r => r.json())
      ])
      
      // Process delivery layout
      if (deliveryLayout.success && deliveryLayout.layout) {
        const { finalLayout, stacks, maxStackId } = processLayoutData(deliveryLayout.layout)
        actions.setPlacedDeliverySkids(finalLayout)
        actions.setUsedDeliverySkidIds(new Set(finalLayout.map(item => item.item_id)))
        actions.setDeliveryVinylStacks(stacks)
        actions.setNextDeliveryStackId(maxStackId + 1)
      }
      
      // Process pickup layout
      if (pickupLayout.success && pickupLayout.layout) {
        const { finalLayout, stacks, maxStackId } = processLayoutData(pickupLayout.layout)
        actions.setPlacedPickupSkids(finalLayout)
        actions.setUsedPickupSkidIds(new Set(finalLayout.map(item => item.item_id)))
        actions.setPickupVinylStacks(stacks)
        actions.setNextPickupStackId(maxStackId + 1)
      }
    } catch (error) {
      console.error('Error fetching layout data:', error)
      toast.error('Failed to load layout data')
    }
  }, [truckloadId, processLayoutData, actions])

  // Immediate save function for auto-save operations
  const saveLayoutImmediate = useCallback(async (layout: GridPosition[], showSuccessToast: boolean = false) => {
    if (!truckloadId) {
      console.error('Cannot save layout: truckloadId is missing')
      return
    }
    
    setIsSaving(true)
    
    try {
      // Validate layout data before sending
      if (!Array.isArray(layout)) {
        throw new Error('Layout must be an array')
      }

      const response = await fetch(`/api/truckloads/${truckloadId}/layout?type=${activeTab}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          layout
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: Failed to save layout`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || result.details || 'Failed to save layout')
      }

      if (showSuccessToast) {
        toast.success('Layout saved successfully')
      }
    } catch (error) {
      console.error('Error auto-saving layout:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to save layout: ${errorMessage}`)
      throw error // Re-throw to allow caller to handle if needed
    } finally {
      setIsSaving(false)
    }
  }, [truckloadId, activeTab])

  // Debounced save function for manual saves
  const debouncedSaveLayout = useCallback(
    debounce(async (layout: GridPosition[], showSuccessToast: boolean = false) => {
      if (!truckloadId) {
        console.error('Cannot save layout: truckloadId is missing')
        return
      }
      
      setIsSaving(true)
      
      try {
        // Validate layout data before sending
        if (!Array.isArray(layout)) {
          throw new Error('Layout must be an array')
        }

        const response = await fetch(`/api/truckloads/${truckloadId}/layout?type=${activeTab}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            layout
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: Failed to save layout`)
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || result.details || 'Failed to save layout')
        }

        if (showSuccessToast) {
          toast.success('Layout saved successfully')
        }
      } catch (error) {
        console.error('Error saving layout:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        toast.error(`Failed to save layout: ${errorMessage}`)
      } finally {
        setIsSaving(false)
      }
    }, 250),
    [truckloadId, activeTab]
  )

  // Save layout function (uses debounced version for manual saves)
  const saveLayout = useCallback(async (layout: GridPosition[], showSuccessToast: boolean = false) => {
    await debouncedSaveLayout(layout, showSuccessToast)
  }, [debouncedSaveLayout])

  return {
    saveLayout,
    saveLayoutImmediate,
    fetchLayoutData,
    isSaving
  }
} 