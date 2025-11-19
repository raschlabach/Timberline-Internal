"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TruckloadSidebarList } from "@/components/truckloads/truckload-sidebar-list"
import { TruckloadStopsList } from "@/components/truckloads/truckload-stops-list"
import { TruckloadLoadBuilder } from "@/components/truckloads/truckload-load-builder"
import { TruckloadLoadPapers } from "@/components/truckloads/truckload-load-papers"
import { TruckloadMap } from "@/components/truckloads/truckload-map"
import { useTruckloads } from "@/providers/truckload-provider"
import { format } from "date-fns"
import { Truck, Calendar, User, Tag, FileText, ChevronDown, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import { TruckloadSummary } from "@/types/truckloads"

interface TruckloadBuilderPageProps {
    params: {
        id: string;
    };
}

interface ApiTruckload {
    id: number;
    driver_id: number;
    start_date: string;
    end_date: string;
    trailer_number: string | null;
    bill_of_lading_number: string | null;
    description: string | null;
    is_completed: boolean;
    total_mileage: number | null;
    estimated_duration: number | null;
    driver_name: string | null;
    driver_color: string | null;
    pickup_footage: number | null;
    delivery_footage: number | null;
    transfer_footage: number | null;
}

export default function TruckloadBuilderPage({ params }: TruckloadBuilderPageProps) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const truckloadId = parseInt(params.id)
    const { truckloads } = useTruckloads()
    const [activeTab, setActiveTab] = useState("stops")

    const { data: truckload, isLoading, error } = useQuery({
        queryKey: ["truckload", truckloadId],
        queryFn: async () => {
            const response = await fetch(`/api/truckloads/${truckloadId}`)
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Truckload not found")
                }
                throw new Error("Failed to fetch truckload")
            }
            const data = await response.json()
            if (!data.success) {
                throw new Error(data.error || "Failed to fetch truckload")
            }
            return data.truckload
        }
    })

    if (status === "loading" || isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    if (status === "unauthenticated") {
        router.push("/login")
        return null
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
                    <p className="text-gray-600">{error instanceof Error ? error.message : "An error occurred"}</p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push("/dashboard/truckload-manager")}
                    >
                        Return to Truckload Manager
                    </Button>
                </div>
            </div>
        )
    }

    if (truckload) {
        return (
            <div className="h-screen flex flex-col">
                <div className="flex-none border-b">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push('/dashboard/truckload-manager')}
                                className="h-8 w-8"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <h1 className="text-2xl font-bold">Truckload Editor</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={truckload.is_completed ? "default" : "secondary"}>
                                {truckload.is_completed ? "Completed" : "In Progress"}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <div className="flex-1 flex min-h-0 overflow-hidden">
                        <div className="w-80 flex-none border-r overflow-hidden">
                            <TruckloadSidebarList truckloadId={truckloadId} />
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <Tabs defaultValue="stops" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                    <div className="border-b px-4 flex-shrink-0">
                                        <TabsList>
                                            <TabsTrigger value="stops">Stops</TabsTrigger>
                                            <TabsTrigger value="map">Map</TabsTrigger>
                                            <TabsTrigger value="load-builder">Load Builder</TabsTrigger>
                                            <TabsTrigger value="load-papers">Papers</TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <TabsContent value="stops" className="flex-1 min-h-0 overflow-hidden mt-0">
                                        <TruckloadStopsList truckloadId={truckloadId} />
                                    </TabsContent>

                                    <TabsContent value="map" className="flex-1 min-h-0 overflow-hidden mt-0">
                                        <div className="h-full min-h-0">
                                            <TruckloadMap truckloadId={truckloadId} />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="load-builder" className="flex-1 min-h-0 overflow-hidden mt-0">
                                        <div className="h-full min-h-0">
                                            <TruckloadLoadBuilder truckloadId={truckloadId} />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="load-papers" className="flex-1 min-h-0 overflow-hidden mt-0">
                                        <div className="h-full min-h-0">
                                            <TruckloadLoadPapers truckloadId={truckloadId} />
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return null
} 