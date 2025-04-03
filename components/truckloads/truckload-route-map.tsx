"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"
import { RouteMap } from "@/components/maps/route-map"

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

interface TruckloadRouteMapProps {
  truckloadId: number
}

export function TruckloadRouteMap({ truckloadId }: TruckloadRouteMapProps) {
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

        console.log("Received stops data:", data.orders)

        // Transform the data to match our expected structure
        const transformedStops = data.orders.map((stop: any) => ({
          ...stop,
          pickup_customer: {
            id: stop.pickup_customer?.id || 0,
            name: stop.pickup_customer?.name || '',
            address: stop.pickup_customer?.address || '',
            phone: stop.pickup_customer?.phone,
            phone2: stop.pickup_customer?.phone2
          },
          delivery_customer: {
            id: stop.delivery_customer?.id || 0,
            name: stop.delivery_customer?.name || '',
            address: stop.delivery_customer?.address || '',
            phone: stop.delivery_customer?.phone,
            phone2: stop.delivery_customer?.phone2
          }
        }))

        // Validate the stops data
        const validStops = transformedStops.filter((stop: TruckloadStop) => {
          const hasValidPickup = stop.pickup_customer?.address && stop.pickup_customer.address.trim() !== ''
          const hasValidDelivery = stop.delivery_customer?.address && stop.delivery_customer.address.trim() !== ''
          
          if (!hasValidPickup) {
            console.warn(`Stop ${stop.id} missing pickup address:`, stop.pickup_customer)
          }
          if (!hasValidDelivery) {
            console.warn(`Stop ${stop.id} missing delivery address:`, stop.delivery_customer)
          }
          
          return hasValidPickup && hasValidDelivery
        })

        console.log("Valid stops:", validStops)

        if (validStops.length === 0) {
          throw new Error("No valid stops found with addresses")
        }

        setStops(validStops)
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
        <p className="text-base">Error loading route map: {error}</p>
      </div>
    )
  }

  if (stops.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500">
        <p className="text-base">No stops assigned to this truckload yet.</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <RouteMap stops={stops} />
    </div>
  )
} 