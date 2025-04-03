"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"

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

interface TruckloadLoadPlannerProps {
  truckloadId: number
}

export function TruckloadLoadPlanner({ truckloadId }: TruckloadLoadPlannerProps) {
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
        <p className="text-base">Error loading load planner: {error}</p>
      </div>
    )
  }

  // Calculate total footage for pickups and deliveries
  const pickupFootage = stops
    .filter(stop => stop.assignment_type === 'pickup')
    .reduce((total, stop) => total + stop.footage, 0)

  const deliveryFootage = stops
    .filter(stop => stop.assignment_type === 'delivery')
    .reduce((total, stop) => total + stop.footage, 0)

  return (
    <div className="h-full flex flex-col">
      {/* Summary section */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-red-600 mb-1">Pickups</h3>
          <div className="text-2xl font-bold">{pickupFootage.toLocaleString()} ft²</div>
          <div className="text-sm text-gray-500 mt-1">
            Skids: {stops.filter(s => s.assignment_type === 'pickup').reduce((total, stop) => total + stop.skids, 0)}
            {" · "}
            Vinyl: {stops.filter(s => s.assignment_type === 'pickup').reduce((total, stop) => total + stop.vinyl, 0)}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Deliveries</h3>
          <div className="text-2xl font-bold">{deliveryFootage.toLocaleString()} ft²</div>
          <div className="text-sm text-gray-500 mt-1">
            Skids: {stops.filter(s => s.assignment_type === 'delivery').reduce((total, stop) => total + stop.skids, 0)}
            {" · "}
            Vinyl: {stops.filter(s => s.assignment_type === 'delivery').reduce((total, stop) => total + stop.vinyl, 0)}
          </div>
        </Card>
      </div>

      {/* Load visualization */}
      <Card className="flex-grow p-4">
        <div className="h-full flex flex-col">
          <h3 className="text-sm font-medium mb-2">Load Distribution</h3>
          <div className="flex-grow border rounded-lg p-4 bg-gray-50">
            {stops.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <p>No stops assigned to this truckload yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stops.map((stop) => (
                  <div 
                    key={stop.id}
                    className={`p-3 rounded-lg ${
                      stop.assignment_type === 'pickup' ? 'bg-red-50 border border-red-200' : 'bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          stop.assignment_type === 'pickup' ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {stop.assignment_type === 'pickup' ? stop.pickup_customer.name : stop.delivery_customer.name}
                        </span>
                        {stop.is_rush && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            Rush
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {stop.footage.toLocaleString()} ft²
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Skids: {stop.skids} · Vinyl: {stop.vinyl}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
} 