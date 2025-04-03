"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { TruckloadKanban } from "@/components/truckloads/truckload-kanban"
import { format, differenceInDays, addDays } from "date-fns"
import { ManageDriversDialog } from "@/components/drivers/manage-drivers-dialog"
import { CreateTruckloadDialog } from "@/components/truckloads/create-truckload-dialog"

export default function TruckingCenter() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showDays, setShowDays] = useState(14)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/dashboard/trucking")
    }
  }, [status, router])

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const response = await fetch("/api/drivers")
      if (!response.ok) throw new Error("Failed to fetch drivers")
      const data = await response.json()
      if (!data.success) throw new Error("Failed to fetch drivers")
      return data.drivers
    }
  })

  const { data: truckloads = [] } = useQuery({
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

  const moveTruckloadMutation = useMutation({
    mutationFn: async ({ truckloadId, driverId, date }: { truckloadId: number, driverId: string, date: string }) => {
      // Find the current truckload to get its duration
      const currentTruckload = truckloads.find((t: { id: number, startDate: string, endDate: string }) => t.id === truckloadId)
      if (!currentTruckload) throw new Error("Truckload not found")
      
      // Calculate the duration in days
      const currentStartDate = new Date(currentTruckload.startDate)
      const currentEndDate = new Date(currentTruckload.endDate)
      const durationInDays = differenceInDays(currentEndDate, currentStartDate)
      
      // Calculate the new end date based on the same duration
      const newStartDate = new Date(date)
      const newEndDate = addDays(newStartDate, durationInDays)
      
      const response = await fetch(`/api/truckloads/${truckloadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          driverId, 
          startDate: format(newStartDate, 'yyyy-MM-dd'),
          endDate: format(newEndDate, 'yyyy-MM-dd')
        })
      })
      if (!response.ok) throw new Error("Failed to update truckload")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["truckloads"] })
    }
  })

  function handleMoveTruckload(truckloadId: number, driverId: string, date: string) {
    moveTruckloadMutation.mutate({ truckloadId, driverId, date })
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (status === "authenticated") {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Trucking Center</h1>
          <div className="flex gap-2">
            <ManageDriversDialog />
            <CreateTruckloadDialog onTruckloadCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["truckloads"] })
            }} />
          </div>
        </div>

        <TruckloadKanban
          drivers={drivers}
          truckloads={truckloads}
          showDays={showDays}
          onChangeShowDays={setShowDays}
          onMoveTruckload={handleMoveTruckload}
        />
      </div>
    )
  }

  return null
} 