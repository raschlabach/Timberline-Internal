"use client"

import { createContext, useContext, ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { TruckloadSummary } from "@/types/truckloads"

interface TruckloadContextType {
  truckloads: TruckloadSummary[]
  isLoading: boolean
  error: Error | null
}

const TruckloadContext = createContext<TruckloadContextType>({
  truckloads: [],
  isLoading: false,
  error: null
})

export function useTruckloads() {
  return useContext(TruckloadContext)
}

interface TruckloadProviderProps {
  children: ReactNode
}

export function TruckloadProvider({ children }: TruckloadProviderProps) {
  const { data: truckloads = [], isLoading, error } = useQuery({
    queryKey: ["truckloads"],
    queryFn: async () => {
      const response = await fetch("/api/truckloads")
      if (!response.ok) throw new Error("Failed to fetch truckloads")
      const data = await response.json()
      if (!data.success) throw new Error("Failed to fetch truckloads")
      return data.truckloads.map((t: any) => ({
        id: t.id,
        driverId: t.driver_id,
        startDate: t.start_date,
        endDate: t.end_date,
        trailerNumber: t.trailer_number || '',
        billOfLadingNumber: t.bill_of_lading_number || '',
        description: t.description || '',
        isCompleted: t.is_completed || false,
        totalMileage: t.total_mileage || 0,
        estimatedDuration: t.estimated_duration || 0,
        driverName: t.driver_name || '',
        driverColor: t.driver_color || '#808080',
        pickupFootage: t.pickup_footage || 0,
        deliveryFootage: t.delivery_footage || 0,
        transferFootage: t.transfer_footage || 0
      }))
    }
  })

  return (
    <TruckloadContext.Provider value={{ truckloads, isLoading, error: error as Error | null }}>
      {children}
    </TruckloadContext.Provider>
  )
} 