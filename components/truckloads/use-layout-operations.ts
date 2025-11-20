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

    // First, normalize and validate items from database
    const normalizedLayout = layout.map(item => {
      // Ensure all required fields are present and properly typed
      const normalized: GridPosition = {
        x: typeof item.x === 'number' ? item.x : parseInt(item.x) || 0,
        y: typeof item.y === 'number' ? item.y : parseInt(item.y) || 0,
        width: typeof item.width === 'number' ? item.width : parseInt(item.width) || 0,
        length: typeof item.length === 'number' ? item.length : parseInt(item.length) || 0,
        item_id: typeof item.item_id === 'number' ? item.item_id : parseInt(item.item_id) || 0,
        type: item.type || item.item_type || 'skid', // Handle both field names
        customerId: item.customerId || 0,
        rotation: typeof item.rotation === 'number' ? item.rotation : parseInt(item.rotation) || 0,
        customerName: item.customerName || '',
        stackId: item.stackId || undefined,
        stackPosition: item.stackPosition || undefined
      }
      return normalized
    }).filter(item => 
      // Filter out items with invalid required fields
      item.item_id > 0 && 
      item.customerId > 0 && 
      item.customerName && 
      (item.type === 'skid' || item.type === 'vinyl')
    )

    // Group items by stack
    const stackMap = new Map<number, GridPosition[]>()
    normalizedLayout.forEach(item => {
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

      // Validate and clean layout data before sending
      const cleanedLayout = layout.map((item: any, index) => {
        // Normalize the item first (handle both item_type and type fields from database)
        const normalized = {
          ...item,
          type: item.type || (item as any).item_type || 'skid',
          x: typeof item.x === 'number' ? item.x : parseInt(String(item.x)) || 0,
          y: typeof item.y === 'number' ? item.y : parseInt(String(item.y)) || 0,
          width: typeof item.width === 'number' ? item.width : parseInt(String(item.width)) || 0,
          length: typeof item.length === 'number' ? item.length : parseInt(String(item.length)) || 0,
          item_id: typeof item.item_id === 'number' ? item.item_id : parseInt(String(item.item_id)) || 0,
          rotation: typeof item.rotation === 'number' ? item.rotation : parseInt(String(item.rotation)) || 0,
          customerId: typeof item.customerId === 'number' ? item.customerId : parseInt(String(item.customerId)) || 0,
          customerName: item.customerName || ''
        }
        
        // Check which fields are invalid
        const errors: string[] = []
        if (typeof normalized.x !== 'number' || isNaN(normalized.x)) errors.push('x')
        if (typeof normalized.y !== 'number' || isNaN(normalized.y)) errors.push('y')
        if (typeof normalized.width !== 'number' || isNaN(normalized.width) || normalized.width <= 0) errors.push('width')
        if (typeof normalized.length !== 'number' || isNaN(normalized.length) || normalized.length <= 0) errors.push('length')
        if (typeof normalized.item_id !== 'number' || isNaN(normalized.item_id) || normalized.item_id <= 0) errors.push('item_id')
        if (typeof normalized.customerId !== 'number' || isNaN(normalized.customerId) || normalized.customerId <= 0) errors.push('customerId')
        if (!normalized.type || (normalized.type !== 'skid' && normalized.type !== 'vinyl')) errors.push('type')
        if (!normalized.customerName || typeof normalized.customerName !== 'string') errors.push('customerName')
        if (typeof normalized.rotation !== 'number' || isNaN(normalized.rotation)) errors.push('rotation')
        
        if (errors.length > 0) {
          console.error(`Invalid layout item at index ${index} - missing/invalid fields: ${errors.join(', ')}`, normalized)
          return null
        }
        return normalized as GridPosition
      }).filter((item): item is GridPosition => item !== null)

      if (cleanedLayout.length !== layout.length) {
        const removedCount = layout.length - cleanedLayout.length
        console.warn(`Removed ${removedCount} invalid item(s) from layout before saving`)
        toast.warning(`Removed ${removedCount} invalid item(s) from layout`)
      }

      if (cleanedLayout.length === 0 && layout.length > 0) {
        throw new Error('Cannot save layout: All items are missing required fields')
      }

      const response = await fetch(`/api/truckloads/${truckloadId}/layout?type=${activeTab}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          layout: cleanedLayout
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

        // Validate and clean layout data before sending
        const cleanedLayout = layout.map((item, index) => {
          // Ensure all required fields are present and valid
          if (typeof item.x !== 'number' || isNaN(item.x) ||
              typeof item.y !== 'number' || isNaN(item.y) ||
              typeof item.width !== 'number' || isNaN(item.width) ||
              typeof item.length !== 'number' || isNaN(item.length) ||
              typeof item.item_id !== 'number' || isNaN(item.item_id) ||
              typeof item.customerId !== 'number' || isNaN(item.customerId) ||
              !item.type || (item.type !== 'skid' && item.type !== 'vinyl') ||
              !item.customerName || typeof item.customerName !== 'string' ||
              typeof item.rotation !== 'number') {
            console.error(`Invalid layout item at index ${index}:`, item)
            return null
          }
          return item
        }).filter((item): item is GridPosition => item !== null)

        if (cleanedLayout.length !== layout.length) {
          const removedCount = layout.length - cleanedLayout.length
          console.warn(`Removed ${removedCount} invalid item(s) from layout before saving`)
          toast.warning(`Removed ${removedCount} invalid item(s) from layout`)
        }

        if (cleanedLayout.length === 0 && layout.length > 0) {
          throw new Error('Cannot save layout: All items are missing required fields')
        }

        const response = await fetch(`/api/truckloads/${truckloadId}/layout?type=${activeTab}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            layout: cleanedLayout
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