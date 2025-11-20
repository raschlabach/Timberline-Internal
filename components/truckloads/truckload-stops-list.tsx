"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { 
  AlertCircle, 
  ArrowUp, 
  ArrowDown, 
  Truck, 
  Info, 
  FileText,
  MessageSquare,
  Zap,
  GripVertical,
  MoreVertical,
  X,
  ArrowRightLeft
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BillOfLadingDialog } from "@/app/components/BillOfLadingDialog"
import { OrderInfoDialog } from "@/components/orders/order-info-dialog"
import { TransferStopDialog } from "@/components/truckloads/transfer-stop-dialog"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  rectIntersection
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface TruckloadStop {
  id: number
  assignment_type: 'pickup' | 'delivery'
  sequence_number: number
  stop_completed: boolean
  status: string
  pickup_customer: {
    id: number
    name: string
    address: string
    phone?: string
    phone2?: string
  }
  delivery_customer: {
    id: number
    name: string
    address: string
    phone?: string
    phone2?: string
  }
  skids: number
  vinyl: number
  footage: number
  hand_bundles: number
  skids_data: any[]
  vinyl_data: any[]
  hand_bundles_data: Array<{
    id: string
    quantity: number
    description: string
  }>
  pickup_date: string
  is_rush: boolean
  needs_attention: boolean
  comments: string
  freight_quote: string
  is_transfer_order: boolean
}

interface TruckloadStopsListProps {
  truckloadId: number
  onStopsUpdate?: () => void // Callback to notify parent of changes
}

interface SortableStopProps {
  stop: TruckloadStop
  onOrderInfoClick: (orderId: number) => void
  onStopUpdate: () => void
  truckloadId: number
}

interface GroupedStop {
  groupKey: string // customer ID + assignment type
  customerId: number
  assignmentType: 'pickup' | 'delivery'
  customerName: string
  customerAddress: string
  sequenceNumber: number
  stops: TruckloadStop[]
}

interface SortableGroupedStopProps {
  groupedStop: GroupedStop
  onOrderInfoClick: (orderId: number) => void
  onStopUpdate: () => void
  truckloadId: number
}

function SortableGroupedStop({ groupedStop, onOrderInfoClick, onStopUpdate, truckloadId }: SortableGroupedStopProps) {
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [isUnassigning, setIsUnassigning] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: `group-${groupedStop.groupKey}`
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : 0
  }

  async function handleUnassign(stop: TruckloadStop) {
    if (!confirm('Are you sure you want to unassign this stop?')) {
      return
    }

    setIsUnassigning(true)

    try {
      const response = await fetch(`/api/truckloads/${truckloadId}/unassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: stop.id,
          assignmentType: stop.assignment_type
        })
      })

      if (!response.ok) {
        throw new Error('Failed to unassign stop')
      }

      toast.success('Stop unassigned successfully')
      onStopUpdate()
    } catch (error) {
      console.error('Error unassigning stop:', error)
      toast.error('Failed to unassign stop')
    } finally {
      setIsUnassigning(false)
    }
  }

  return (
    <>
      <Card 
        ref={setNodeRef}
        style={style}
        className="py-1 px-2 relative"
      >
        <div className="absolute top-0 left-0 h-full w-1.5" 
          style={{ 
            backgroundColor: groupedStop.assignmentType === 'pickup' ? '#ef4444' : '#000000'
          }} 
        />
        
        <div className="pl-2.5">
          {/* Individual stops within the group - styled exactly like normal stops */}
          <div>
            {groupedStop.stops.map((stop, index) => (
              <div key={`${stop.id}-${stop.assignment_type}`} className={index > 0 ? "mt-1 pt-1 border-t border-gray-200" : ""}>
                {/* Single horizontal row with all info - using grid for dynamic column widths */}
                <div className="grid grid-cols-[auto_auto_auto_auto_auto] gap-3 items-center">
                  {/* Left side: Drag handle, sequence, badges */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                      {index === 0 && (
                        <button
                        className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-100 rounded flex-shrink-0"
                          {...attributes}
                          {...listeners}
                        >
                          <GripVertical className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      )}
                    <span className="font-medium text-xs whitespace-nowrap">#{stop.sequence_number}</span>
                    {stop.is_transfer_order ? (
                      <Badge variant="outline" className="text-xs h-4 px-1 bg-blue-50 text-blue-800 border-blue-200 whitespace-nowrap">
                        Transfer
                      </Badge>
                    ) : (
                      <Badge 
                        variant={stop.assignment_type === 'pickup' ? 'destructive' : 'default'} 
                        className={`text-xs h-4 px-1 whitespace-nowrap ${
                          stop.assignment_type === 'delivery' ? 'bg-black text-white hover:bg-black/90' : ''
                        }`}
                      >
                      {stop.assignment_type === 'pickup' ? (
                        <><ArrowUp className="h-2.5 w-2.5 mr-0.5" /> Pickup</>
                      ) : (
                        <><ArrowDown className="h-2.5 w-2.5 mr-0.5" /> Delivery</>
                      )}
                      </Badge>
                    )}
                  </div>

                  {/* Origin customer - auto width based on content */}
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500 leading-tight">
                      {stop.assignment_type === 'pickup' ? 'From:' : 'Origin:'}
                    </div>
                    <div className={`truncate leading-tight ${
                      stop.assignment_type === 'pickup' 
                        ? 'text-xs font-bold' 
                        : 'text-xs font-medium text-gray-700'
                    }`}>
                      {stop.pickup_customer.name}
                    </div>
                    <div className="text-xs text-gray-600 truncate leading-tight">{stop.pickup_customer.address}</div>
                  </div>

                  {/* Destination customer - auto width based on content */}
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500 leading-tight">
                      {stop.assignment_type === 'delivery' ? 'To:' : 'Dest:'}
                    </div>
                    <div className={`truncate leading-tight ${
                      stop.assignment_type === 'delivery' 
                        ? 'text-xs font-bold' 
                        : 'text-xs font-medium text-gray-700'
                    }`}>
                      {stop.delivery_customer.name}
                    </div>
                    <div className="text-xs text-gray-600 truncate leading-tight">{stop.delivery_customer.address}</div>
                  </div>

                  {/* Freight Info - auto width based on content */}
                  <div className="flex-shrink-0 whitespace-nowrap">
                    <div className="text-xs text-gray-500 leading-tight">Freight</div>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {stop.footage > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">Ft:</span>
                          <span className="font-medium">{Math.round(stop.footage)}</span>
                        </div>
                      )}
                      {stop.skids > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">S:</span>
                          <span className="font-medium">{stop.skids}</span>
                        </div>
                      )}
                      {stop.vinyl > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">V:</span>
                          <span className="font-medium">{stop.vinyl}</span>
                        </div>
                      )}
                      {stop.hand_bundles > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">HB:</span>
                          <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded text-xs">{stop.hand_bundles}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: Date, flags, buttons - minimal width */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <div className="text-xs text-gray-500 mr-1 whitespace-nowrap">
                      {stop.pickup_date && format(new Date(stop.pickup_date), 'MM/dd/yy')}
                    </div>
                    {stop.is_rush && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-0.5">
                            <Zap className="h-3.5 w-3.5 text-yellow-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Rush Order</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {stop.needs_attention && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-0.5">
                            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Needs Attention</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {stop.comments && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-0.5">
                            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{stop.comments}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                          onClick={() => onOrderInfoClick(stop.id)}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Order Details</p>
                      </TooltipContent>
                    </Tooltip>
                    <BillOfLadingDialog 
                      order={{
                        id: stop.id.toString(),
                        shipper: {
                          name: stop.pickup_customer.name,
                          address: stop.pickup_customer.address,
                          phone: stop.pickup_customer.phone || '',
                          phone2: stop.pickup_customer.phone2 || ''
                        },
                        consignee: {
                          name: stop.delivery_customer.name,
                          address: stop.delivery_customer.address,
                          phone: stop.delivery_customer.phone || '',
                          phone2: stop.delivery_customer.phone2 || ''
                        },
                        items: [
                          ...(stop.skids_data || []).map(skid => ({
                            packages: skid.quantity || 0,
                            description: `Skid ${skid.width}x${skid.length}`,
                            weight: 0,
                            charges: 0
                          })),
                          ...(stop.vinyl_data || []).map(vinyl => ({
                            packages: vinyl.quantity || 0,
                            description: `Vinyl ${vinyl.width}x${vinyl.length}`,
                            weight: 0,
                            charges: 0
                          })),
                          ...(stop.hand_bundles_data || []).map(handBundle => ({
                            packages: handBundle.quantity || 0,
                            description: handBundle.description || 'Hand Bundle',
                            weight: 0,
                            charges: 0
                          }))
                        ]
                      }} 
                    >
                      <Button 
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </BillOfLadingDialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => handleUnassign(stop)}
                          disabled={isUnassigning}
                        >
                          <X className="h-4 w-4 mr-2" />
                          {isUnassigning ? 'Unassigning...' : 'Unassign Stop'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setIsTransferDialogOpen(true)}
                        >
                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                          Transfer Stop
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <TransferStopDialog
        isOpen={isTransferDialogOpen}
        onClose={() => setIsTransferDialogOpen(false)}
        onTransferComplete={onStopUpdate}
        currentTruckloadId={truckloadId}
        orderId={groupedStop.stops[0]?.id || 0}
        assignmentType={groupedStop.assignmentType}
      />
    </>
  )
}

function SortableStop({ stop, onOrderInfoClick, onStopUpdate, truckloadId }: SortableStopProps) {
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [isUnassigning, setIsUnassigning] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: `${stop.id}-${stop.assignment_type}`
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : 0
  }

  async function handleUnassign() {
    if (!confirm('Are you sure you want to unassign this stop?')) {
      return
    }

    setIsUnassigning(true)

    try {
      const response = await fetch(`/api/truckloads/${truckloadId}/unassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: stop.id,
          assignmentType: stop.assignment_type
        })
      })

      if (!response.ok) {
        throw new Error('Failed to unassign stop')
      }

      toast.success('Stop unassigned successfully')
      onStopUpdate()
    } catch (error) {
      console.error('Error unassigning stop:', error)
      toast.error('Failed to unassign stop')
    } finally {
      setIsUnassigning(false)
    }
  }

  return (
    <>
      <Card 
        ref={setNodeRef}
        style={style}
        className="py-1 px-2 relative"
      >
        <div className="absolute top-0 left-0 h-full w-1.5" 
          style={{ 
            backgroundColor: stop.assignment_type === 'pickup' ? '#ef4444' : '#000000'
          }} 
        />
        
        <div className="pl-2.5">
          {/* Single horizontal row with all info - using grid for dynamic column widths */}
          <div className="grid grid-cols-[auto_auto_auto_auto_auto] gap-3 items-center">
            {/* Left side: Drag handle, sequence, badges */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <button
                className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-100 rounded flex-shrink-0"
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="h-3.5 w-3.5 text-gray-400" />
                </button>
              <span className="font-medium text-xs whitespace-nowrap">#{stop.sequence_number}</span>
              {stop.is_transfer_order ? (
                <Badge variant="outline" className="text-xs h-4 px-1 bg-blue-50 text-blue-800 border-blue-200 whitespace-nowrap">
                  Transfer
                </Badge>
              ) : (
                <Badge 
                  variant={stop.assignment_type === 'pickup' ? 'destructive' : 'default'} 
                  className={`text-xs h-4 px-1 whitespace-nowrap ${
                    stop.assignment_type === 'delivery' ? 'bg-black text-white hover:bg-black/90' : ''
                  }`}
                >
                {stop.assignment_type === 'pickup' ? (
                  <><ArrowUp className="h-2.5 w-2.5 mr-0.5" /> Pickup</>
                ) : (
                  <><ArrowDown className="h-2.5 w-2.5 mr-0.5" /> Delivery</>
                )}
                </Badge>
              )}
            </div>

            {/* Origin customer - auto width based on content */}
            <div className="min-w-0">
              <div className="text-xs text-gray-500 leading-tight">
                {stop.assignment_type === 'pickup' ? 'From:' : 'Origin:'}
              </div>
              <div className={`truncate leading-tight ${
                stop.assignment_type === 'pickup' 
                  ? 'text-xs font-bold' 
                  : 'text-xs font-medium text-gray-700'
              }`}>
                {stop.pickup_customer.name}
              </div>
              <div className="text-xs text-gray-600 truncate leading-tight">{stop.pickup_customer.address}</div>
            </div>

            {/* Destination customer - auto width based on content */}
            <div className="min-w-0">
              <div className="text-xs text-gray-500 leading-tight">
                {stop.assignment_type === 'delivery' ? 'To:' : 'Dest:'}
              </div>
              <div className={`truncate leading-tight ${
                stop.assignment_type === 'delivery' 
                  ? 'text-xs font-bold' 
                  : 'text-xs font-medium text-gray-700'
              }`}>
                {stop.delivery_customer.name}
              </div>
              <div className="text-xs text-gray-600 truncate leading-tight">{stop.delivery_customer.address}</div>
            </div>

            {/* Freight Info - auto width based on content */}
            <div className="flex-shrink-0 whitespace-nowrap">
              <div className="text-xs text-gray-500 leading-tight">Freight</div>
              <div className="flex flex-col gap-0.5 text-xs">
                {stop.footage > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Ft:</span>
                    <span className="font-medium">{Math.round(stop.footage)}</span>
                  </div>
                )}
                {stop.skids > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">S:</span>
                    <span className="font-medium">{stop.skids}</span>
                  </div>
                )}
                {stop.vinyl > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">V:</span>
                    <span className="font-medium">{stop.vinyl}</span>
                  </div>
                )}
                {stop.hand_bundles > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">HB:</span>
                    <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded text-xs">{stop.hand_bundles}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Date, flags, buttons - minimal width */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <div className="text-xs text-gray-500 mr-1 whitespace-nowrap">
                {stop.pickup_date && format(new Date(stop.pickup_date), 'MM/dd/yy')}
              </div>
              {stop.is_rush && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-0.5">
                      <Zap className="h-3.5 w-3.5 text-yellow-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Rush Order</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {stop.needs_attention && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-0.5">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Needs Attention</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {stop.comments && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-0.5">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{stop.comments}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                    onClick={() => onOrderInfoClick(stop.id)}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Order Details</p>
                </TooltipContent>
              </Tooltip>
              <BillOfLadingDialog 
                order={{
                  id: stop.id.toString(),
                  shipper: {
                    name: stop.pickup_customer.name,
                    address: stop.pickup_customer.address,
                    phone: stop.pickup_customer.phone || '',
                    phone2: stop.pickup_customer.phone2 || ''
                  },
                  consignee: {
                    name: stop.delivery_customer.name,
                    address: stop.delivery_customer.address,
                    phone: stop.delivery_customer.phone || '',
                    phone2: stop.delivery_customer.phone2 || ''
                  },
                  items: [
                    ...(stop.skids_data || []).map(skid => ({
                      packages: skid.quantity || 0,
                      description: `Skid ${skid.width}x${skid.length}`,
                      weight: 0,
                      charges: 0
                    })),
                    ...(stop.vinyl_data || []).map(vinyl => ({
                      packages: vinyl.quantity || 0,
                      description: `Vinyl ${vinyl.width}x${vinyl.length}`,
                      weight: 0,
                      charges: 0
                    })),
                    ...(stop.hand_bundles_data || []).map(handBundle => ({
                      packages: handBundle.quantity || 0,
                      description: handBundle.description || 'Hand Bundle',
                      weight: 0,
                      charges: 0
                    }))
                  ]
                }} 
              >
                <Button 
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </BillOfLadingDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={handleUnassign}
                    disabled={isUnassigning}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {isUnassigning ? 'Unassigning...' : 'Unassign Stop'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsTransferDialogOpen(true)}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transfer Stop
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>

      <TransferStopDialog
        isOpen={isTransferDialogOpen}
        onClose={() => setIsTransferDialogOpen(false)}
        onTransferComplete={onStopUpdate}
        currentTruckloadId={truckloadId}
        orderId={stop.id}
        assignmentType={stop.assignment_type}
      />
    </>
  )
}

// Function to group stops by customer ID and assignment type
function groupStopsByCustomer(stops: TruckloadStop[]): GroupedStop[] {
  const groups = new Map<string, GroupedStop>()
  
  stops.forEach(stop => {
    const customerId = stop.assignment_type === 'pickup' 
      ? stop.pickup_customer.id 
      : stop.delivery_customer.id
    
    const groupKey = `${customerId}-${stop.assignment_type}`
    
    if (groups.has(groupKey)) {
      // Add to existing group
      const existingGroup = groups.get(groupKey)!
      existingGroup.stops.push(stop)
    } else {
      // Create new group
      const customer = stop.assignment_type === 'pickup' 
        ? stop.pickup_customer 
        : stop.delivery_customer
      
      groups.set(groupKey, {
        groupKey,
        customerId,
        assignmentType: stop.assignment_type,
        customerName: customer.name,
        customerAddress: customer.address,
        sequenceNumber: stop.sequence_number,
        stops: [stop]
      })
    }
  })
  
  // Convert to array and sort by sequence number (descending)
  return Array.from(groups.values()).sort((a, b) => b.sequenceNumber - a.sequenceNumber)
}

export function TruckloadStopsList({ truckloadId, onStopsUpdate }: TruckloadStopsListProps) {
  const queryClient = useQueryClient()
  const [stops, setStops] = useState<TruckloadStop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [isOrderInfoOpen, setIsOrderInfoOpen] = useState(false)
  const [isReordering, setIsReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  async function fetchStops() {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/truckloads/${truckloadId}/orders`)
      if (!response.ok) {
        throw new Error("Failed to fetch stops")
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch stops")
      }
      // Sort stops by sequence_number in descending order
      const sortedStopsList = data.orders.sort((a: TruckloadStop, b: TruckloadStop) => b.sequence_number - a.sequence_number)
      setStops(sortedStopsList)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching stops:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (truckloadId) {
      fetchStops()
    }
  }, [truckloadId])

  const handleOrderInfoClick = (orderId: number) => {
    setSelectedOrderId(orderId)
    setIsOrderInfoOpen(true)
  }

  const handleOrderInfoClose = () => {
    setIsOrderInfoOpen(false)
    setSelectedOrderId(null)
  }

  const handleOrderUpdate = () => {
    // Refresh the stops list after an order update
    if (truckloadId) {
      fetchStops()
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      setIsReordering(true)
      
      console.log('🔄 Drag and drop event:', { active: active.id, over: over.id })
      
      // Handle grouped stops - check if it's a group ID
      const isActiveGroup = String(active.id).startsWith('group-')
      const isOverGroup = String(over.id).startsWith('group-')
      
      if (isActiveGroup && isOverGroup) {
        // Both are groups - handle group reordering
        const activeGroupKey = String(active.id).replace('group-', '')
        const overGroupKey = String(over.id).replace('group-', '')
        
        console.log('🔍 Group reordering:', { activeGroupKey, overGroupKey })
        
        const groupedStops = groupStopsByCustomer(stops)
        const activeGroupIndex = groupedStops.findIndex(g => g.groupKey === activeGroupKey)
        const overGroupIndex = groupedStops.findIndex(g => g.groupKey === overGroupKey)
        
        if (activeGroupIndex === -1 || overGroupIndex === -1) {
          console.error('Could not find group indices')
          setIsReordering(false)
          return
        }
        
        // Move the group
        const newGroupedStops = [...groupedStops]
        const [movedGroup] = newGroupedStops.splice(activeGroupIndex, 1)
        newGroupedStops.splice(overGroupIndex, 0, movedGroup)
        
        // Update sequence numbers for all stops in all groups
        const updatedStops: TruckloadStop[] = []
        newGroupedStops.forEach((group, groupIndex) => {
          const newSequenceNumber = newGroupedStops.length - groupIndex
          group.stops.forEach(stop => {
            updatedStops.push({
              ...stop,
              sequence_number: newSequenceNumber
            })
          })
        })
        
        console.log('🔍 Updated stops with new sequence numbers:', updatedStops.map(s => ({ id: s.id, type: s.assignment_type, seq: s.sequence_number })))
        
        // Update sequence numbers in the database
        try {
          const response = await fetch(`/api/truckloads/${truckloadId}/reorder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orders: updatedStops.map(stop => ({
                id: stop.id,
                assignment_type: stop.assignment_type,
                sequence_number: stop.sequence_number
              }))
            })
          })
          
          if (!response.ok) {
            throw new Error('Failed to update stop order')
          }
          
          const data = await response.json()
          if (!data.success) {
            throw new Error(data.error || 'Failed to update stop order')
          }

          // Update local state with the new sequence numbers
          setStops(updatedStops)
          
          // Invalidate the truckload-stops query to refresh the left side panel
          queryClient.invalidateQueries({ queryKey: ["truckload-stops", truckloadId] })
          
          // Also notify the parent component if callback is provided
          if (onStopsUpdate) {
            onStopsUpdate()
          }
          
        } catch (error) {
          console.error('Error updating stop order:', error)
          // Revert to original order if update fails
          fetchStops()
        } finally {
          setIsReordering(false)
        }
      } else {
        // Handle individual stop reordering (fallback for non-grouped stops)
        const [activeId, activeType] = String(active.id).split('-')
        const [overId, overType] = String(over.id).split('-')
        
        console.log('🔍 Parsed IDs:', { activeId, activeType, overId, overType })
        
        const oldIndex = stops.findIndex(stop => 
          stop.id === Number(activeId) && stop.assignment_type === activeType
        )
        const newIndex = stops.findIndex(stop => 
          stop.id === Number(overId) && stop.assignment_type === overType
        )
        
        console.log('🔍 Found indices:', { oldIndex, newIndex })
        
        // Implement proper insertion logic instead of simple swapping
        const newStops = [...stops]
        const [movedStop] = newStops.splice(oldIndex, 1)
        newStops.splice(newIndex, 0, movedStop)
        
        // Calculate the correct sequence numbers based on the new visual order
        const updatedStops = newStops.map((stop: TruckloadStop, index: number) => {
          const newSequenceNumber = newStops.length - index
          return {
            ...stop,
            sequence_number: newSequenceNumber
          }
        })
        
        // Update sequence numbers in the database
        try {
          const response = await fetch(`/api/truckloads/${truckloadId}/reorder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orders: updatedStops.map(stop => ({
                id: stop.id,
                assignment_type: stop.assignment_type,
                sequence_number: stop.sequence_number
              }))
            })
          })
          
          if (!response.ok) {
            throw new Error('Failed to update stop order')
          }
          
          const data = await response.json()
          if (!data.success) {
            throw new Error(data.error || 'Failed to update stop order')
          }

          // Update local state with the new sequence numbers
          setStops(updatedStops)
          
          // Invalidate the truckload-stops query to refresh the left side panel
          queryClient.invalidateQueries({ queryKey: ["truckload-stops", truckloadId] })
          
          // Also notify the parent component if callback is provided
          if (onStopsUpdate) {
            onStopsUpdate()
          }
          
        } catch (error) {
          console.error('Error updating stop order:', error)
          // Revert to original order if update fails
          fetchStops()
        } finally {
          setIsReordering(false)
        }
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-2 text-center text-red-500">
        <AlertCircle className="mx-auto h-6 w-6 mb-1" />
        <p className="text-base">Error loading stops: {error}</p>
      </div>
    )
  }

  if (stops.length === 0) {
    return (
      <div className="p-2 text-center text-gray-500">
        <Truck className="mx-auto h-6 w-6 mb-1" />
        <p className="text-base">No stops assigned to this truckload yet.</p>
      </div>
    )
  }

  // Group stops by customer
  const groupedStops = groupStopsByCustomer(stops)

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={groupedStops.map(group => `group-${group.groupKey}`)}
            strategy={verticalListSortingStrategy}
          >
              <div className="space-y-1 p-2 pr-4">
              {groupedStops.map((group) => (
                <SortableGroupedStop
                  key={`group-${group.groupKey}-${group.sequenceNumber}`}
                  groupedStop={group}
                  onOrderInfoClick={handleOrderInfoClick}
                  onStopUpdate={fetchStops}
                  truckloadId={truckloadId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        </div>
      </div>

      {selectedOrderId && (
        <OrderInfoDialog
          orderId={selectedOrderId}
          isOpen={isOrderInfoOpen}
          onClose={handleOrderInfoClose}
          onOrderUpdate={handleOrderUpdate}
        />
      )}
    </TooltipProvider>
  )
} 