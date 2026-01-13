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

// Helper function to parse date string (YYYY-MM-DD) as local date without timezone conversion
function parseLocalDate(dateString: string): Date {
  // If the date string is in YYYY-MM-DD format, parse it as local date
  if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parts = dateString.split('-')
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
    const day = parseInt(parts[2], 10)
    return new Date(year, month, day)
  }
  // Fallback to regular Date parsing
  return new Date(dateString)
}

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

interface ColumnWidths {
  handleSequence: number
  firstCustomerCol: number  // First customer column (origin for pickups, dest for deliveries)
  secondCustomerCol: number // Second customer column (dest for pickups, origin for deliveries)
  freight: number
}

interface SortableGroupedStopProps {
  groupedStop: GroupedStop
  onOrderInfoClick: (orderId: number) => void
  onStopUpdate: () => void
  truckloadId: number
  columnWidths: ColumnWidths
}

function SortableGroupedStop({ groupedStop, onOrderInfoClick, onStopUpdate, truckloadId, columnWidths }: SortableGroupedStopProps) {
  const [transferStop, setTransferStop] = useState<TruckloadStop | null>(null)
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
        className="py-1 px-1 relative w-fit"
      >
        <div className="absolute top-0 left-0 h-full w-1.5" 
          style={{ 
            backgroundColor: groupedStop.assignmentType === 'pickup' ? '#ef4444' : '#000000'
          }} 
        />
        
        <div className="pl-1">
          {/* Individual stops within the group - styled exactly like normal stops */}
          <div>
            {groupedStop.stops.map((stop, index) => (
              <div key={`${stop.id}-${stop.assignment_type}`} className={index > 0 ? "mt-1 pt-1 border-t border-gray-200" : ""}>
                {/* Single horizontal row with all info - using CSS Grid with calculated column widths */}
                {/* For deliveries, swap column order so "To:" comes before "Origin:" */}
                <div 
                  className={`grid gap-1.5 items-center w-fit ${stop.assignment_type === 'pickup' ? 'text-red-600' : ''}`}
                  style={{
                    // Column order is always: handle, firstCustomerCol, secondCustomerCol, freight, buttons
                    // For pickups: firstCustomerCol = origin, secondCustomerCol = dest
                    // For deliveries: firstCustomerCol = dest, secondCustomerCol = origin
                    gridTemplateColumns: `${columnWidths.handleSequence}px ${columnWidths.firstCustomerCol}px ${columnWidths.secondCustomerCol}px ${columnWidths.freight}px max-content`
                  }}
                >
                  {/* Left side: Drag handle, sequence, badges */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                      {index === 0 && (
                        <button
                        className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-100 rounded flex-shrink-0"
                          {...attributes}
                          {...listeners}
                        >
                          <GripVertical className={`h-3.5 w-3.5 ${stop.assignment_type === 'pickup' ? 'text-red-400' : 'text-gray-400'}`} />
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

                  {/* For deliveries: show destination first, then origin. For pickups: show origin first, then destination */}
                  {stop.assignment_type === 'delivery' ? (
                    <>
                      {/* Destination customer (To:) - shown first for deliveries */}
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 leading-tight">To:</div>
                        <div className="truncate leading-tight text-xs font-bold">
                          {stop.delivery_customer.name}
                        </div>
                        <div className="text-xs text-gray-600 truncate leading-tight">{stop.delivery_customer.address}</div>
                      </div>
                      {/* Origin customer (Origin:) - shown second for deliveries */}
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 leading-tight">Origin:</div>
                        <div className="truncate leading-tight text-xs font-medium text-gray-700">
                          {stop.pickup_customer.name}
                        </div>
                        <div className="text-xs text-gray-600 truncate leading-tight">{stop.pickup_customer.address}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Origin customer (From:) - shown first for pickups */}
                      <div className="min-w-0">
                        <div className="text-xs text-red-500 leading-tight">From:</div>
                        <div className="truncate leading-tight text-xs font-bold text-red-600">
                          {stop.pickup_customer.name}
                        </div>
                        <div className="text-xs text-red-500 truncate leading-tight">{stop.pickup_customer.address}</div>
                      </div>
                      {/* Destination customer (Dest:) - shown second for pickups */}
                      <div className="min-w-0">
                        <div className="text-xs text-red-500 leading-tight">Dest:</div>
                        <div className="truncate leading-tight text-xs font-medium text-red-600">
                          {stop.delivery_customer.name}
                        </div>
                        <div className="text-xs text-red-500 truncate leading-tight">{stop.delivery_customer.address}</div>
                      </div>
                    </>
                  )}

                  {/* Freight Info */}
                  <div className="flex-shrink-0 whitespace-nowrap">
                    <div className={`text-xs leading-tight ${stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}`}>Freight</div>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {stop.footage > 0 && (
                        <div className="flex items-center gap-1">
                          <span className={stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}>Ft:</span>
                          <span className={`font-medium ${stop.assignment_type === 'pickup' ? 'text-red-600' : ''}`}>{Math.round(stop.footage)}</span>
                        </div>
                      )}
                      {stop.skids > 0 && (
                        <div className="flex items-center gap-1">
                          <span className={stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}>S:</span>
                          <span className={`font-medium ${stop.assignment_type === 'pickup' ? 'text-red-600' : ''}`}>{stop.skids}</span>
                        </div>
                      )}
                      {stop.vinyl > 0 && (
                        <div className="flex items-center gap-1">
                          <span className={stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}>V:</span>
                          <span className={`font-medium ${stop.assignment_type === 'pickup' ? 'text-red-600' : ''}`}>{stop.vinyl}</span>
                        </div>
                      )}
                      {stop.hand_bundles > 0 && (
                        <div className="flex items-center gap-1">
                          <span className={stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}>HB:</span>
                          <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded text-xs">{stop.hand_bundles}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: Date, flags, buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <div className={`text-xs mr-1 whitespace-nowrap ${stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}`}>
                      {stop.pickup_date && format(parseLocalDate(stop.pickup_date), 'MM/dd/yy')}
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
                          onClick={() => setTransferStop(stop)}
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
        isOpen={!!transferStop}
        onClose={() => setTransferStop(null)}
        onTransferComplete={onStopUpdate}
        currentTruckloadId={truckloadId}
        orderId={transferStop?.id || 0}
        assignmentType={transferStop?.assignment_type || 'pickup'}
      />
    </>
  )
}

interface SortableStopProps {
  stop: TruckloadStop
  onOrderInfoClick: (orderId: number) => void
  onStopUpdate: () => void
  truckloadId: number
  columnWidths?: ColumnWidths
}

function SortableStop({ stop, onOrderInfoClick, onStopUpdate, truckloadId, columnWidths }: SortableStopProps) {
  // Default column widths if not provided
  const widths = columnWidths || {
    handleSequence: 130,
    firstCustomerCol: 200,
    secondCustomerCol: 200,
    freight: 90
  }
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
        className="py-1 px-1 relative w-fit"
      >
        <div className="absolute top-0 left-0 h-full w-1.5" 
          style={{ 
            backgroundColor: stop.assignment_type === 'pickup' ? '#ef4444' : '#000000'
          }} 
        />
        
        <div className="pl-1">
          {/* Single horizontal row with all info - using CSS Grid with calculated column widths */}
          {/* Column order is always: handle, firstCustomerCol, secondCustomerCol, freight, buttons */}
          <div 
            className={`grid gap-1.5 items-center w-fit ${stop.assignment_type === 'pickup' ? 'text-red-600' : ''}`}
            style={{
              // For pickups: firstCustomerCol = origin, secondCustomerCol = dest
              // For deliveries: firstCustomerCol = dest, secondCustomerCol = origin
              gridTemplateColumns: `${widths.handleSequence}px ${widths.firstCustomerCol}px ${widths.secondCustomerCol}px ${widths.freight}px max-content`
            }}
          >
            {/* Left side: Drag handle, sequence, badges */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <button
                className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-100 rounded flex-shrink-0"
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className={`h-3.5 w-3.5 ${stop.assignment_type === 'pickup' ? 'text-red-400' : 'text-gray-400'}`} />
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

            {/* For deliveries: show destination first, then origin. For pickups: show origin first, then destination */}
            {stop.assignment_type === 'delivery' ? (
              <>
                {/* Destination customer (To:) - shown first for deliveries */}
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 leading-tight">To:</div>
                  <div className="truncate leading-tight text-xs font-bold">
                    {stop.delivery_customer.name}
                  </div>
                  <div className="text-xs text-gray-600 truncate leading-tight">{stop.delivery_customer.address}</div>
                </div>
                {/* Origin customer (Origin:) - shown second for deliveries */}
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 leading-tight">Origin:</div>
                  <div className="truncate leading-tight text-xs font-medium text-gray-700">
                    {stop.pickup_customer.name}
                  </div>
                  <div className="text-xs text-gray-600 truncate leading-tight">{stop.pickup_customer.address}</div>
                </div>
              </>
            ) : (
              <>
                {/* Origin customer (From:) - shown first for pickups */}
                <div className="min-w-0">
                  <div className="text-xs text-red-500 leading-tight">From:</div>
                  <div className="truncate leading-tight text-xs font-bold text-red-600">
                    {stop.pickup_customer.name}
                  </div>
                  <div className="text-xs text-red-500 truncate leading-tight">{stop.pickup_customer.address}</div>
                </div>
                {/* Destination customer (Dest:) - shown second for pickups */}
                <div className="min-w-0">
                  <div className="text-xs text-red-500 leading-tight">Dest:</div>
                  <div className="truncate leading-tight text-xs font-medium text-red-600">
                    {stop.delivery_customer.name}
                  </div>
                  <div className="text-xs text-red-500 truncate leading-tight">{stop.delivery_customer.address}</div>
                </div>
              </>
            )}

            {/* Freight Info */}
            <div className="flex-shrink-0 whitespace-nowrap">
              <div className={`text-xs leading-tight ${stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}`}>Freight</div>
              <div className="flex flex-col gap-0.5 text-xs">
                {stop.footage > 0 && (
                  <div className="flex items-center gap-1">
                    <span className={stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}>Ft:</span>
                    <span className={`font-medium ${stop.assignment_type === 'pickup' ? 'text-red-600' : ''}`}>{Math.round(stop.footage)}</span>
                  </div>
                )}
                {stop.skids > 0 && (
                  <div className="flex items-center gap-1">
                    <span className={stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}>S:</span>
                    <span className={`font-medium ${stop.assignment_type === 'pickup' ? 'text-red-600' : ''}`}>{stop.skids}</span>
                  </div>
                )}
                {stop.vinyl > 0 && (
                  <div className="flex items-center gap-1">
                    <span className={stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}>V:</span>
                    <span className={`font-medium ${stop.assignment_type === 'pickup' ? 'text-red-600' : ''}`}>{stop.vinyl}</span>
                  </div>
                )}
                {stop.hand_bundles > 0 && (
                  <div className="flex items-center gap-1">
                    <span className={stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}>HB:</span>
                    <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded text-xs">{stop.hand_bundles}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Date, flags, buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <div className={`text-xs mr-1 whitespace-nowrap ${stop.assignment_type === 'pickup' ? 'text-red-500' : 'text-gray-500'}`}>
                {stop.pickup_date && format(parseLocalDate(stop.pickup_date), 'MM/dd/yy')}
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
  
  // Calculate column widths based on all stops (once in parent)
  // Note: For pickups, column order is [handle, origin, dest, freight, buttons]
  //       For deliveries, column order is [handle, dest, origin, freight, buttons]
  // So we need to calculate max widths for "first customer column" and "second customer column"
  const calculateColumnWidths = () => {
    let maxHandleSequence = 0
    let maxFirstCustomerCol = 0  // For pickups: origin (From:), for deliveries: dest (To:)
    let maxSecondCustomerCol = 0 // For pickups: dest (Dest:), for deliveries: origin (Origin:)
    let maxFreight = 0
    
    stops.forEach(stop => {
      // Calculate handle + sequence + badge width (approximate)
      const sequenceText = `#${stop.sequence_number}`
      const badgeText = stop.is_transfer_order ? 'Transfer' : stop.assignment_type === 'pickup' ? 'Pickup' : 'Delivery'
      const handleWidth = 20 + sequenceText.length * 7 + badgeText.length * 8 + 35 // rough estimate with padding
      maxHandleSequence = Math.max(maxHandleSequence, handleWidth)
      
      // Calculate origin customer width (pickup_customer)
      const originLabel = stop.assignment_type === 'pickup' ? 'From:' : 'Origin:'
      const originName = stop.pickup_customer.name || ''
      const originAddr = stop.pickup_customer.address || ''
      const originWidth = Math.max(originLabel.length * 7, originName.length * 8, originAddr.length * 6.5) + 15
      
      // Calculate destination customer width (delivery_customer)
      const destLabel = stop.assignment_type === 'delivery' ? 'To:' : 'Dest:'
      const destName = stop.delivery_customer.name || ''
      const destAddr = stop.delivery_customer.address || ''
      const destWidth = Math.max(destLabel.length * 7, destName.length * 8, destAddr.length * 6.5) + 15
      
      // For pickups: first col = origin, second col = dest
      // For deliveries: first col = dest, second col = origin
      if (stop.assignment_type === 'pickup') {
        maxFirstCustomerCol = Math.max(maxFirstCustomerCol, originWidth)
        maxSecondCustomerCol = Math.max(maxSecondCustomerCol, destWidth)
      } else {
        maxFirstCustomerCol = Math.max(maxFirstCustomerCol, destWidth)
        maxSecondCustomerCol = Math.max(maxSecondCustomerCol, originWidth)
      }
      
      // Calculate freight width
      const freightItems = []
      if (stop.footage > 0) freightItems.push(`Ft: ${Math.round(stop.footage)}`)
      if (stop.skids > 0) freightItems.push(`S: ${stop.skids}`)
      if (stop.vinyl > 0) freightItems.push(`V: ${stop.vinyl}`)
      if (stop.hand_bundles > 0) freightItems.push(`HB: ${stop.hand_bundles}`)
      const freightWidth = Math.max(...freightItems.map(item => item.length * 7), 'Freight'.length * 7) + 15
      maxFreight = Math.max(maxFreight, freightWidth)
    })
    
    return {
      handleSequence: Math.max(maxHandleSequence, 130),
      firstCustomerCol: Math.max(maxFirstCustomerCol, 200),
      secondCustomerCol: Math.max(maxSecondCustomerCol, 200),
      freight: Math.max(maxFreight, 90)
    }
  }
  
  const columnWidths = calculateColumnWidths()

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
              {/* Shared grid container to ensure column alignment across all stops */}
              <div className="p-2 pr-2">
                <div className="space-y-1">
                  {groupedStops.map((group) => (
                    <SortableGroupedStop
                      key={`group-${group.groupKey}-${group.sequenceNumber}`}
                      groupedStop={group}
                      onOrderInfoClick={handleOrderInfoClick}
                      onStopUpdate={fetchStops}
                      truckloadId={truckloadId}
                      columnWidths={columnWidths}
                    />
                  ))}
                </div>
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