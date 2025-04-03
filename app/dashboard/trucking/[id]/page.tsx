"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TruckloadSidebarList } from "@/components/truckloads/truckload-sidebar-list"
import { TruckloadStopsList } from "@/components/truckloads/truckload-stops-list"
import { TruckloadRouteMap } from "@/components/truckloads/truckload-route-map"
import { TruckloadLoadPlanner } from "@/components/truckloads/truckload-load-planner"
import { TruckloadLoadBuilder } from "@/components/truckloads/truckload-load-builder"
import { TruckloadLoadPapers } from "@/components/truckloads/truckload-load-papers"
import { useTruckloads } from "@/providers/truckload-provider"
import { format } from "date-fns"
import { Truck, Calendar, User, Tag, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface TruckloadBuilderPageProps {
    params: {
        id: string;
    };
}

export default function TruckloadBuilderPage({ params }: TruckloadBuilderPageProps) {
    const { id } = params;
    const { data: session, status } = useSession()
    const router = useRouter()
    const truckloadId = parseInt(id)
    const { truckloads, isLoading } = useTruckloads()

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login?callbackUrl=/dashboard/trucking")
        }
    }, [status, router])

    // Find the current truckload
    const currentTruckload = truckloads.find(t => t.id === truckloadId)

    if (status === "loading" || isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
        )
    }

    if (status === "authenticated") {
        return (
            <div className="flex h-[calc(100vh-4rem)]">
                {/* Sidebar with condensed truckload list */}
                <div className="w-80 border-r bg-gray-50/50 h-full flex-shrink-0">
                    <TruckloadSidebarList 
                        truckloads={truckloads} 
                        currentTruckloadId={truckloadId} 
                    />
                </div>
                
                {/* Main content */}
                <div className="flex-1 overflow-auto">
                    <div className="container mx-auto py-4 space-y-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold flex items-center gap-2">
                                    {currentTruckload?.driverColor && (
                                        <div 
                                            className="w-5 h-5 rounded-full" 
                                            style={{ backgroundColor: currentTruckload.driverColor }}
                                        />
                                    )}
                                    Truckload #{id}
                                </h1>
                            </div>
                            
                            <div className="flex flex-wrap gap-4 mt-3">
                                {currentTruckload?.driverName && (
                                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 text-sm">
                                        <User className="h-3.5 w-3.5" />
                                        {currentTruckload.driverName}
                                    </Badge>
                                )}
                                
                                {currentTruckload?.startDate && (
                                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 text-sm">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {format(new Date(currentTruckload.startDate), 'MMM d')} - {format(new Date(currentTruckload.endDate), 'MMM d, yyyy')}
                                    </Badge>
                                )}
                                
                                {currentTruckload?.trailerNumber && (
                                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 text-sm">
                                        <Truck className="h-3.5 w-3.5" />
                                        Trailer: {currentTruckload.trailerNumber}
                                    </Badge>
                                )}
                                
                                {currentTruckload?.billOfLadingNumber && (
                                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 text-sm">
                                        <Tag className="h-3.5 w-3.5" />
                                        BOL: {currentTruckload.billOfLadingNumber}
                                    </Badge>
                                )}
                                
                                {currentTruckload?.description && (
                                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 text-sm">
                                        <FileText className="h-3.5 w-3.5" />
                                        {currentTruckload.description}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="flex gap-4 h-[calc(100vh-14rem)]">
                            {/* Left column - Orders/Stops - fixed width */}
                            <Card className="p-3 h-full overflow-hidden w-[350px] flex-shrink-0">
                                <h2 className="text-lg font-semibold mb-2">Stops</h2>
                                <div className="h-[calc(100%-2rem)] overflow-hidden">
                                    <TruckloadStopsList truckloadId={truckloadId} />
                                </div>
                            </Card>

                            {/* Right column - Map View/Load Planner - fill remaining space */}
                            <Card className="p-3 h-full flex-grow overflow-hidden">
                                <Tabs defaultValue="route-map" className="h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-2">
                                        <TabsList>
                                            <TabsTrigger value="route-map">Route Map</TabsTrigger>
                                            <TabsTrigger value="load-planner">Load Planner</TabsTrigger>
                                            <TabsTrigger value="load-builder">Load Builder</TabsTrigger>
                                            <TabsTrigger value="load-papers">Load Papers</TabsTrigger>
                                        </TabsList>
                                    </div>
                                    <TabsContent value="route-map" className="flex-grow">
                                        <div className="h-full">
                                            <TruckloadRouteMap truckloadId={truckloadId} />
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="load-planner" className="flex-grow">
                                        <div className="h-full">
                                            <TruckloadLoadPlanner truckloadId={truckloadId} />
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="load-builder" className="flex-grow">
                                        <div className="h-full">
                                            <TruckloadLoadBuilder truckloadId={truckloadId} />
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="load-papers" className="flex-grow">
                                        <div className="h-full">
                                            <TruckloadLoadPapers truckloadId={truckloadId} />
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
} 