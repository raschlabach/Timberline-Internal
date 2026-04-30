"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Trash2 } from "lucide-react"

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
  setSelectedSkid: (skid: any) => void
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

interface TrailerGridProps {
  activeTab: 'delivery' | 'pickup'
  placedSkids: GridPosition[]
  vinylStacks: VinylStack[]
  selectedSkid: {
    id: number
    width: number
    length: number
    type: 'skid' | 'vinyl'
    isPickup?: boolean
  } | null
  previewPosition: {x: number, y: number} | null
  draggedSkid: GridPosition | null
  actions: LoadBuilderActions | null
  stops: any[]
}

const GRID_WIDTH = 8
const GRID_LENGTH = 53
const CELL_SIZE = 24

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

const STACK_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', badge: 'bg-blue-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', badge: 'bg-emerald-500' },
  { bg: 'bg-violet-50', border: 'border-violet-400', text: 'text-violet-700', badge: 'bg-violet-500' },
  { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', badge: 'bg-amber-500' },
  { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-700', badge: 'bg-rose-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-700', badge: 'bg-cyan-500' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-400', text: 'text-fuchsia-700', badge: 'bg-fuchsia-500' },
  { bg: 'bg-lime-50', border: 'border-lime-400', text: 'text-lime-700', badge: 'bg-lime-500' },
  { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700', badge: 'bg-orange-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-700', badge: 'bg-indigo-500' },
]

export function getStackColor(stackId: number) {
  return STACK_COLORS[(stackId - 1) % STACK_COLORS.length]
}

function getCustomerColorClass(customerId: number) {
  return CUSTOMER_COLORS[customerId % CUSTOMER_COLORS.length]
}

function getStackTypeLabel(stack: VinylStack): string {
  const hasSkids = stack.skids.some(item => item.type === 'skid')
  const hasVinyl = stack.skids.some(item => item.type === 'vinyl')
  if (hasSkids && hasVinyl) return 'Skid & Vinyl'
  if (hasSkids) return 'Skid'
  return 'Vinyl'
}

export function TrailerGrid({
  activeTab,
  placedSkids,
  vinylStacks,
  selectedSkid,
  previewPosition,
  draggedSkid,
  actions,
  stops
}: TrailerGridProps) {

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!actions) return // Don't allow interaction if actions are null (inactive tab)
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / CELL_SIZE
    const y = (e.clientY - rect.top) / CELL_SIZE
    actions.handleGridClick(x, y, stops)
  }

  return (
    <div className="flex gap-4 bg-gray-50 p-4 rounded-lg print:overflow-visible print:max-h-none">
      <div
        className="relative border border-gray-200 bg-white print:overflow-visible print:max-h-none"
        style={{
          width: GRID_WIDTH * CELL_SIZE,
          height: GRID_LENGTH * CELL_SIZE
        }}
        onClick={handleGridClick}
        onMouseMove={actions?.handleGridMouseMove}
        onMouseLeave={actions?.handleGridMouseLeave}
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
            if (stackGroup) {
              const bottomSkid = stackGroup.skids[stackGroup.skids.length - 1]
              // Compare by item_id and position, not object reference
              if (skid.item_id !== bottomSkid.item_id || skid.x !== bottomSkid.x || skid.y !== bottomSkid.y) {
              return null
              }
            }
          }

          const currentStack = skid.stackId ? vinylStacks.find(s => s.stackId === skid.stackId) : null
          const isStack = currentStack && currentStack.skids.length > 1
          const bottomSkid = isStack ? currentStack.skids[currentStack.skids.length - 1] : skid

          const stackColor = isStack && currentStack?.stackId ? getStackColor(currentStack.stackId) : null

          return (
            <div
              key={`placed-${skid.item_id}-${index}-${skid.x}-${skid.y}`}
              className={`absolute ${
                isStack && stackColor
                  ? `${stackColor.bg} border-[3px] ${stackColor.border} rounded-sm` 
                  : `${skid.type === 'vinyl' ? 'border-[3px] border-dashed' : 'border-2'} border-black ${getCustomerColorClass(skid.customerId)}`
              } group`}
              style={{
                left: bottomSkid.x * CELL_SIZE,
                top: bottomSkid.y * CELL_SIZE,
                width: bottomSkid.width * CELL_SIZE,
                height: bottomSkid.length * CELL_SIZE,
                zIndex: 10,
                ...(isStack ? {
                  boxShadow: '3px 3px 0px 0px rgba(0,0,0,0.15), 6px 6px 0px 0px rgba(0,0,0,0.08)'
                } : {})
              }}
            >
              {/* Stack count badge */}
              {isStack && stackColor && (
                <div className={`absolute -top-2 -right-2 ${stackColor.badge} text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm z-20`}>
                  {currentStack.skids.length}
                </div>
              )}

              {/* Customer name and dimensions */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-center p-1 break-words">
                {isStack && stackColor ? (
                  <>
                    <div className={`font-semibold ${stackColor.text}`}>#{currentStack.stackId}</div>
                    <div className="text-[10px]">{bottomSkid.width}' × {bottomSkid.length}'</div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">{skid.customerName}</div>
                    <div>{skid.width}' × {skid.length}'</div>
                  </>
                )}
              </div>

              {/* Control buttons - only show if actions are available (active tab) */}
              {actions && (
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1 z-10">
                <TooltipProvider>
                  {/* Delete button - visible and functional */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 bg-white/90 hover:bg-white shadow-sm hover:bg-red-50 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          actions.handleRemove(skid, !!isStack, currentStack || undefined)
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
              )}
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
    </div>
  )
} 