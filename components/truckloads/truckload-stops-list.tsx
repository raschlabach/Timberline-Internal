"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { 
  AlertCircle, 
  ArrowUp, 
  ArrowDown, 
  Truck, 
  Info, 
  FileText,
  MessageSquare,
  Zap
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BillOfLadingDialog } from "@/app/components/BillOfLadingDialog"
import { OrderInfoDialog } from "@/components/orders/order-info-dialog"

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
  skids_data: any[]
  vinyl_data: any[]
  pickup_date: string
  is_rush: boolean
  needs_attention: boolean
  comments: string
  freight_quote: string
  is_transfer_order: boolean
}

interface TruckloadStopsListProps {
  truckloadId: number
}

export function TruckloadStopsList({ truckloadId }: TruckloadStopsListProps) {
  const [stops, setStops] = useState<TruckloadStop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [isOrderInfoOpen, setIsOrderInfoOpen] = useState(false)

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
      setStops(data.orders)
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

  return (
    <TooltipProvider>
      <ScrollArea className="h-full pr-2">
        <div className="space-y-2.5">
          {stops.map((stop) => (
            <Card key={`${stop.id}-${stop.assignment_type}`} className="py-2.5 px-3 relative">
              <div className="absolute top-0 left-0 h-full w-1.5" 
                style={{ 
                  backgroundColor: stop.assignment_type === 'pickup' ? '#ef4444' : '#000000'
                }} 
              />
              
              <div className="pl-2.5">
                {/* Header row with sequence, type, flags and date */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-base">#{stop.sequence_number}</span>
                    <Badge variant={stop.assignment_type === 'pickup' ? 'destructive' : 'default'} className="text-sm h-6 px-2">
                      {stop.assignment_type === 'pickup' ? (
                        <><ArrowUp className="h-3.5 w-3.5 mr-0.5" /> Pickup</>
                      ) : (
                        <><ArrowDown className="h-3.5 w-3.5 mr-0.5" /> Delivery</>
                      )}
                    </Badge>
                    {stop.is_transfer_order && (
                      <Badge variant="outline" className="text-sm h-6 px-2 bg-blue-50 text-blue-800 border-blue-200">
                        Transfer
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {stop.pickup_date && format(new Date(stop.pickup_date), 'MM/dd/yy')}
                  </div>
                </div>

                {/* Locations row */}
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <div>
                    <div className="text-sm text-gray-500 leading-tight">
                      {stop.assignment_type === 'pickup' ? 'From:' : 'Origin:'}
                    </div>
                    <div className={`truncate leading-tight ${
                      stop.assignment_type === 'pickup' 
                        ? 'text-lg font-bold' 
                        : 'text-base font-medium text-gray-700'
                    }`}>
                      {stop.pickup_customer.name}
                    </div>
                    <div className="text-sm text-gray-600 truncate leading-tight">{stop.pickup_customer.address}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 leading-tight">
                      {stop.assignment_type === 'delivery' ? 'To:' : 'Dest:'}
                    </div>
                    <div className={`truncate leading-tight ${
                      stop.assignment_type === 'delivery' 
                        ? 'text-lg font-bold' 
                        : 'text-base font-medium text-gray-700'
                    }`}>
                      {stop.delivery_customer.name}
                    </div>
                    <div className="text-sm text-gray-600 truncate leading-tight">{stop.delivery_customer.address}</div>
                  </div>
                </div>

                {/* Bottom section with freight info and action icons */}
                <div className="flex justify-between items-center mt-1.5">
                  {/* Freight info */}
                  <div className="flex items-center gap-3 text-sm">
                    {stop.footage > 0 && (
                      <div>
                        <span className="text-gray-500">Ft:</span> {Math.round(stop.footage)}
                      </div>
                    )}
                    {stop.skids > 0 && (
                      <div>
                        <span className="text-gray-500">Skids:</span> {stop.skids}
                      </div>
                    )}
                    {stop.vinyl > 0 && (
                      <div>
                        <span className="text-gray-500">Vinyl:</span> {stop.vinyl}
                      </div>
                    )}
                    {stop.is_transfer_order && (
                      <Badge variant="outline" className="text-xs h-5 px-1.5 bg-blue-50 text-blue-800 border-blue-200">
                        Transfer
                      </Badge>
                    )}
                  </div>

                  {/* Action Icons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Rush Icon */}
                    {stop.is_rush && (
                      <div className="relative group">
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                        >
                          <Zap className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            Rush Order
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Attention Icon */}
                    {stop.needs_attention && (
                      <div className="relative group">
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            Needs Attention
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Comments Icon */}
                    {stop.comments && (
                      <div className="relative group">
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded max-w-xs break-words">
                            {stop.comments}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bill of Lading Icon */}
                    <div className="relative group">
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
                            }))
                          ]
                        }} 
                      >
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                        >
                          <FileText className="h-4.5 w-4.5" />
                        </Button>
                      </BillOfLadingDialog>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          Bill of Lading
                        </div>
                      </div>
                    </div>

                    {/* Info Icon */}
                    <div className="relative group">
                      <Button 
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                        onClick={() => handleOrderInfoClick(stop.id)}
                      >
                        <Info className="h-4.5 w-4.5" />
                      </Button>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          View Order Details
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Order Info Dialog */}
      {selectedOrderId && (
        <OrderInfoDialog
          isOpen={isOrderInfoOpen}
          onClose={handleOrderInfoClose}
          orderId={selectedOrderId}
          onOrderUpdate={handleOrderUpdate}
        />
      )}
    </TooltipProvider>
  )
} 