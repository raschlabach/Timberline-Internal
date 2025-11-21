"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

interface StackPanelProps {
  vinylStacks: VinylStack[]
  actions: LoadBuilderActions
  activeTab: 'delivery' | 'pickup'
}

const GRID_WIDTH = 8

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

export function StackPanel({ 
  vinylStacks, 
  actions, 
  activeTab 
}: StackPanelProps) {
    // Filter stacks to only show those with more than 1 item
  const multiItemStacks = vinylStacks.filter(stack => stack.skids.length > 1)

  if (multiItemStacks.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-1">
      {multiItemStacks.map(stack => {
        const stackType = getStackTypeLabel(stack)
        return (
          <Card 
            key={stack.stackId} 
            className="p-2 shrink-0 bg-white shadow-md w-full"
          >
            <div className="text-xs font-semibold mb-1 flex items-center gap-1">
              <span>Stack #{stack.stackId}</span>
              <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded">{stackType}</span>
            </div>
            <div className="space-y-1">
              {stack.skids.map((skid, index) => (
                <div
                  key={skid.item_id}
                  className={`relative p-1 rounded ${
                    skid.type === 'vinyl' ? 'border-dashed border' : 'border'
                  } ${getCustomerColorClass(skid.customerId)}`}
                >
                  {/* Visual representation of skid dimensions */}
                  <div className="mb-1">
                    <div 
                      className={`${skid.type === 'vinyl' ? 'border-dashed border' : 'border'} border-black/30 bg-black/5`}
                      style={{
                        width: `${(skid.width / GRID_WIDTH) * 100}%`,
                        height: '8px'
                      }}
                    />
                  </div>

                  {/* Trailer line for bottom skid */}
                  {index === stack.skids.length - 1 && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-[110%] h-1 bg-black rounded border-x border-black" />
                  )}
                                      <div className="flex justify-between items-start gap-1">
                    <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium bg-white/50 rounded-full w-4 h-4 flex items-center justify-center border border-black/10 shrink-0">
                          {stack.skids.length - index}
                        </span>
                        <div className="font-medium text-xs break-words">
                          {skid.customerName}
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-600 mt-0.5">
                        {skid.width}' × {skid.length}' • {skid.type === 'vinyl' ? 'Vinyl' : 'Skid'}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {index > 0 && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => actions.moveInStack(stack.stackId, skid.item_id, 'up')}
                        >
                          ↑
                        </Button>
                      )}
                      {index < stack.skids.length - 1 && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => actions.moveInStack(stack.stackId, skid.item_id, 'down')}
                        >
                          ↓
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 hover:bg-red-50 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          actions.removeFromStack(stack.stackId, skid.item_id)
                        }}
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
  )
} 