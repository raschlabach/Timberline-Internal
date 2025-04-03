"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, FileText, Printer, Download } from "lucide-react"
import { BillOfLadingDialog } from "@/app/components/BillOfLadingDialog"

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
  }
  delivery_customer: {
    id: number
    name: string
    address: string
  }
  skids: number
  vinyl: number
  footage: number
  skids_data: Array<{
    id: number
    type: 'skid'
    width: number
    length: number
    footage: number
    quantity: number
  }>
  vinyl_data: Array<{
    id: number
    type: 'vinyl'
    width: number
    length: number
    footage: number
    quantity: number
  }>
  pickup_date: string
  is_rush: boolean
  needs_attention: boolean
  comments: string
  freight_quote: string
  is_transfer_order: boolean
}

interface FreightItem {
  packages: number
  description: string
  weight: number
  charges: number
}

interface TruckloadLoadPapersProps {
  truckloadId: number
}

export function TruckloadLoadPapers({ truckloadId }: TruckloadLoadPapersProps) {
  const [stops, setStops] = useState<TruckloadStop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

    if (truckloadId) {
      fetchStops()
    }
  }, [truckloadId])

  const transformStopToBOL = (stop: TruckloadStop) => {
    const items: FreightItem[] = [
      ...stop.skids_data.map(skid => ({
        packages: skid.quantity,
        description: `Skid ${skid.width}" × ${skid.length}"`,
        weight: 0,
        charges: 0
      })),
      ...stop.vinyl_data.map(vinyl => ({
        packages: vinyl.quantity,
        description: `Vinyl ${vinyl.width}" × ${vinyl.length}"`,
        weight: 0,
        charges: 0
      }))
    ]

    return {
      id: stop.id.toString(),
      shipper: {
        name: stop.pickup_customer.name,
        address: stop.pickup_customer.address,
        phone: '',
        phone2: ''
      },
      consignee: {
        name: stop.delivery_customer.name,
        address: stop.delivery_customer.address,
        phone: '',
        phone2: ''
      },
      items
    }
  }

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-red-500">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-base">Error loading load papers: {error}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Bill of Lading Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Bill of Lading</h3>
            <p className="text-sm text-gray-600">Generate and manage bill of lading for this load</p>
          </div>
          <div className="flex gap-2">
            {stops.length > 0 && (
              <BillOfLadingDialog order={transformStopToBOL(stops[0])}>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  View BOL
                </Button>
              </BillOfLadingDialog>
            )}
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </Card>

      {/* Load Summary Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Load Summary</h3>
            <p className="text-sm text-gray-600">Detailed summary of all stops and items</p>
          </div>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
        <div className="space-y-4">
          {stops.map((stop) => (
            <div 
              key={stop.id}
              className={`p-4 rounded-lg ${
                stop.assignment_type === 'pickup' ? 'bg-red-50' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className={`font-medium ${
                  stop.assignment_type === 'pickup' ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {stop.sequence_number}. {stop.assignment_type === 'pickup' ? 'Pickup from' : 'Delivery to'} {
                    stop.assignment_type === 'pickup' ? stop.pickup_customer.name : stop.delivery_customer.name
                  }
                </h4>
                <span className="text-sm font-medium">
                  {stop.footage.toLocaleString()} ft²
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {stop.assignment_type === 'pickup' ? stop.pickup_customer.address : stop.delivery_customer.address}
              </div>
              <div className="mt-2 space-y-1">
                {stop.skids_data.map((skid) => (
                  <div key={skid.id} className="text-sm text-gray-600 flex items-center justify-between">
                    <span>Skid {skid.width}" × {skid.length}"</span>
                    <span>{skid.quantity}x ({skid.footage} ft²)</span>
                  </div>
                ))}
                {stop.vinyl_data.map((vinyl) => (
                  <div key={vinyl.id} className="text-sm text-gray-600 flex items-center justify-between">
                    <span>Vinyl {vinyl.width}" × {vinyl.length}"</span>
                    <span>{vinyl.quantity}x ({vinyl.footage} ft²)</span>
                  </div>
                ))}
              </div>
              {stop.comments && (
                <div className="mt-2 text-sm text-gray-600 italic">
                  Note: {stop.comments}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
} 