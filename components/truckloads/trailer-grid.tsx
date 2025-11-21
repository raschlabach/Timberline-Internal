"use client"

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
    <div className="flex gap-4 bg-gray-50 p-4 rounded-lg">
      <div
        className="relative border border-gray-200 bg-white"
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
            if (stackGroup && skid !== stackGroup.skids[stackGroup.skids.length - 1]) {
              return null
            }
          }

          const currentStack = skid.stackId ? vinylStacks.find(s => s.stackId === skid.stackId) : null
          const isStack = currentStack && currentStack.skids.length > 1
          const bottomSkid = isStack ? currentStack.skids[currentStack.skids.length - 1] : skid

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