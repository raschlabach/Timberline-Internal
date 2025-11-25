"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Truck, Calendar, Hash, FileText } from "lucide-react"
import { format } from "date-fns"

interface LoadingStop {
  id: number
  sequenceNumber: number
  shippedTo: {
    id: number
    name: string
    address: string
  }
  pickupFrom: {
    id: number
    name: string
    address: string
  }
  freightSpace: number
  totalSpace: number
  count: number
  dimensions: string
  footage: number
  isRush?: boolean
  needsAttention?: boolean
  comments?: string
}

interface LoadingSheetProps {
  truckloadId: number
  driverName: string
  startDate: string
  endDate: string
  trailerNumber: string
  description: string
  driverColor?: string
}

export function LoadingSheet({ 
  truckloadId, 
  driverName, 
  startDate, 
  endDate, 
  trailerNumber, 
  description,
  driverColor = "#fbbf24"
}: LoadingSheetProps) {
  const [stops, setStops] = useState<LoadingStop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pickupFootage, setPickupFootage] = useState(0)
  const [deliveryFootage, setDeliveryFootage] = useState(0)

  useEffect(() => {
    async function fetchLoadingStops() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/truckloads/${truckloadId}/orders`)
        if (!response.ok) {
          throw new Error("Failed to fetch loading stops")
        }
        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || "Failed to fetch loading stops")
        }
        
        // Filter for delivery stops only and sort by sequence number (bottom to top)
        const loadingStops = data.orders
          .filter((stop: any) => stop.assignment_type === 'delivery')
          .sort((a: any, b: any) => b.sequence_number - a.sequence_number) // Sort bottom to top
          .map((stop: any) => {
            // Calculate count and dimensions like truckload sheet
            const counts = []
            if (stop.skids > 0) {
              const skidText = stop.skids === 1 ? '1 Skid' : `${stop.skids} Skids`
              counts.push(skidText)
            }
            if (stop.vinyl > 0) {
              counts.push(`${stop.vinyl} Vinyl`)
            }
            
            // Create dimension strings from skids and vinyl data, grouping by dimensions
            const skidGroups: { [key: string]: number } = {}
            stop.skids_data?.forEach((skid: any) => {
              const dimension = `${skid.width}x${skid.length}`
              skidGroups[dimension] = (skidGroups[dimension] || 0) + skid.quantity
            })
            
            const vinylGroups: { [key: string]: number } = {}
            stop.vinyl_data?.forEach((vinyl: any) => {
              const dimension = `${vinyl.width}x${vinyl.length}`
              vinylGroups[dimension] = (vinylGroups[dimension] || 0) + vinyl.quantity
            })
            
            const skidDimensions = Object.entries(skidGroups).map(([dimension, quantity]) => 
              `${quantity} ${dimension}`
            )
            const vinylDimensions = Object.entries(vinylGroups).map(([dimension, quantity]) => 
              `${quantity} ${dimension}`
            )
            const allDimensions = [...skidDimensions, ...vinylDimensions]
            
            return {
              id: stop.id,
              sequenceNumber: stop.sequence_number,
              shippedTo: {
                id: stop.delivery_customer.id,
                name: stop.delivery_customer.name,
                address: stop.delivery_customer.address
              },
              pickupFrom: {
                id: stop.pickup_customer.id,
                name: stop.pickup_customer.name,
                address: stop.pickup_customer.address
              },
              freightSpace: stop.footage,
              count: counts.join(' | '),
              dimensions: allDimensions.join(' | '),
              footage: stop.footage,
              isRush: stop.is_rush,
              needsAttention: stop.needs_attention,
              comments: stop.comments
            }
          })
        
        setStops(loadingStops)
        
        // Calculate footage totals like the sidebar
        const allStops = data.orders
        const pickupTotal = allStops
          .filter((stop: any) => stop.assignment_type === 'pickup' && !stop.is_transfer_order)
          .reduce((total: number, stop: any) => total + Number(stop.footage || 0), 0)
        const deliveryTotal = allStops
          .filter((stop: any) => stop.assignment_type === 'delivery' && !stop.is_transfer_order)
          .reduce((total: number, stop: any) => total + Number(stop.footage || 0), 0)
        
        setPickupFootage(pickupTotal)
        setDeliveryFootage(deliveryTotal)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        console.error("Error fetching loading stops:", err)
      } finally {
        setIsLoading(false)
      }
    }

    if (truckloadId) {
      fetchLoadingStops()
    }
  }, [truckloadId])

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Loading Sheet</CardTitle>
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-red-500">Loading Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full border-0 shadow-none">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-gray-900">Loading Sheet</CardTitle>
              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                <span>{pickupFootage.toLocaleString()} - Inbound</span>
                <span>{deliveryFootage.toLocaleString()} - Outbound</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-8">
            <div 
              className="px-4 py-2 rounded-md"
              style={{ backgroundColor: driverColor + '40' }} // 40 for 25% opacity
            >
              <div className="text-sm font-semibold text-gray-800">{driverName}</div>
              <div className="text-xs text-gray-600">
                {startDate && endDate ? (() => {
                  // Parse dates manually to avoid timezone issues
                  const parseDateString = (dateStr: string): Date => {
                    const parts = dateStr.split('-')
                    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
                  }
                  return `${format(parseDateString(startDate), 'M/d/yy')} - ${format(parseDateString(endDate), 'M/d/yy')}`
                })() : 'Date range not available'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-700">Trailer #</div>
              <div className="text-xl font-bold text-gray-900">{trailerNumber}</div>
            </div>
            
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-700">Description</div>
              <div className="text-sm text-gray-800">{description}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="border-b-2 border-gray-300">
                <TableHead className="w-[200px] text-left font-semibold text-gray-800 py-1">Shipped to</TableHead>
                <TableHead className="w-[200px] text-left font-semibold text-gray-800 py-1">Pickup From</TableHead>
                <TableHead className="w-[80px] text-center font-semibold text-gray-800 py-1">FS</TableHead>
                <TableHead className="w-[80px] text-center font-semibold text-gray-800 py-1">Count</TableHead>
                <TableHead className="w-[120px] text-center font-semibold text-gray-800 py-1">Dimensions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stops.map((stop) => (
                <TableRow key={stop.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <TableCell className="py-1">
                    <div className="font-medium text-black hover:text-gray-800 cursor-pointer underline">
                      {stop.sequenceNumber}. {stop.shippedTo.name}
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="font-medium text-red-600 hover:text-red-800 cursor-pointer underline">
                      {stop.pickupFrom.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-gray-800 py-1">
                    {stop.freightSpace}
                  </TableCell>
                  <TableCell className="text-center text-gray-800 py-1">
                    {stop.count}
                  </TableCell>
                  <TableCell className="text-center text-gray-800 py-1">
                    {stop.dimensions}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
