'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Map, Layers, RefreshCw } from 'lucide-react'
import { PolygonMap } from '@/components/suggested-loads/polygon-map'
import { TruckloadGroups } from '@/components/suggested-loads/truckload-groups'
import { PolygonRulesDialog } from '@/components/suggested-loads/polygon-rules-dialog'
import { GroupDialog } from '@/components/suggested-loads/group-dialog'

interface PolygonData {
  id: number
  name: string
  coordinates: Array<{ lat: number; lng: number }>
  color: string
  matchOn: 'pickup' | 'delivery'
  maxFootage: number | null
  maxStops: number | null
  onlyUnassignedType: string | null
  loadTypeFilter: Record<string, boolean> | null
  isActive: boolean
}

export default function SuggestedLoadsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('map')
  const [selectedPolygonId, setSelectedPolygonId] = useState<number | null>(null)
  const [isCreatingPolygon, setIsCreatingPolygon] = useState(false)
  const [pendingCoordinates, setPendingCoordinates] = useState<Array<{ lat: number; lng: number }> | null>(null)
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<any>(null)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: polygonsData, isLoading: isLoadingPolygons } = useQuery({
    queryKey: ['suggested-load-polygons'],
    queryFn: async () => {
      const res = await fetch('/api/suggested-loads/polygons')
      const data = await res.json()
      return data.polygons || []
    },
  })

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['suggested-load-groups'],
    queryFn: async () => {
      const res = await fetch('/api/suggested-loads/groups')
      const data = await res.json()
      return data.groups || []
    },
  })

  const { data: matchData, isLoading: isMatching, refetch: runMatch } = useQuery({
    queryKey: ['suggested-load-match', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/suggested-loads/match?${params}`)
      return res.json()
    },
    enabled: false,
  })

  const polygons: PolygonData[] = polygonsData || []
  const groups = groupsData || []

  const createPolygonMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/suggested-loads/polygons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-load-polygons'] })
      setPendingCoordinates(null)
    },
  })

  const updatePolygonMutation = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const res = await fetch(`/api/suggested-loads/polygons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-load-polygons'] })
    },
  })

  const deletePolygonMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/suggested-loads/polygons/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-load-polygons'] })
      queryClient.invalidateQueries({ queryKey: ['suggested-load-groups'] })
      setSelectedPolygonId(null)
    },
  })

  const handlePolygonCreated = useCallback((coordinates: Array<{ lat: number; lng: number }>) => {
    setPendingCoordinates(coordinates)
    setIsCreatingPolygon(true)
  }, [])

  const handlePolygonUpdated = useCallback(
    (polygonId: number, coordinates: Array<{ lat: number; lng: number }>) => {
      updatePolygonMutation.mutate({ id: polygonId, coordinates })
    },
    [updatePolygonMutation]
  )

  const handleSaveNewPolygon = useCallback(
    (polygonConfig: any) => {
      if (!pendingCoordinates) return
      createPolygonMutation.mutate({
        ...polygonConfig,
        coordinates: pendingCoordinates,
      })
      setIsCreatingPolygon(false)
    },
    [pendingCoordinates, createPolygonMutation]
  )

  const handleUpdatePolygonRules = useCallback(
    (polygonConfig: any) => {
      if (!selectedPolygonId) return
      updatePolygonMutation.mutate({ id: selectedPolygonId, ...polygonConfig })
    },
    [selectedPolygonId, updatePolygonMutation]
  )

  const selectedPolygon = polygons.find((p) => p.id === selectedPolygonId) || null

  const orderDots = matchData?.success
    ? [
        ...(matchData.groups || []).flatMap((g: any) =>
          (g.orders || []).flatMap((o: any) => {
            const dots = []
            if (o.pickupLat && o.pickupLng) {
              dots.push({
                id: o.id,
                lat: parseFloat(o.pickupLat),
                lng: parseFloat(o.pickupLng),
                type: 'pickup' as const,
                customerName: o.pickupCustomer,
                matchedPolygonId: null,
              })
            }
            if (o.deliveryLat && o.deliveryLng) {
              dots.push({
                id: o.id,
                lat: parseFloat(o.deliveryLat),
                lng: parseFloat(o.deliveryLng),
                type: 'delivery' as const,
                customerName: o.deliveryCustomer,
                matchedPolygonId: null,
              })
            }
            return dots
          })
        ),
        ...(matchData.unmatchedOrders || []).flatMap((o: any) => {
          const dots = []
          if (o.pickupLat && o.pickupLng) {
            dots.push({
              id: o.id,
              lat: parseFloat(o.pickupLat),
              lng: parseFloat(o.pickupLng),
              type: 'pickup' as const,
              customerName: o.pickupCustomer,
              matchedPolygonId: null,
            })
          }
          if (o.deliveryLat && o.deliveryLng) {
            dots.push({
              id: o.id,
              lat: parseFloat(o.deliveryLat),
              lng: parseFloat(o.deliveryLng),
              type: 'delivery' as const,
              customerName: o.deliveryCustomer,
              matchedPolygonId: null,
            })
          }
          return dots
        }),
      ]
    : []

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Suggested Loads</h1>
          {matchData?.success && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{matchData.totalOrders} orders</Badge>
              <Badge variant="default">{matchData.matchedCount} matched</Badge>
              {matchData.unmatchedCount > 0 && (
                <Badge variant="destructive">{matchData.unmatchedCount} unmatched</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
            placeholder="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
            placeholder="To date"
          />
          <Button onClick={() => runMatch()} disabled={isMatching} size="sm">
            <RefreshCw className={`h-4 w-4 mr-1 ${isMatching ? 'animate-spin' : ''}`} />
            Run Match
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 pt-2 border-b bg-white">
          <TabsList>
            <TabsTrigger value="map" className="gap-1.5">
              <Map className="h-4 w-4" />
              Map &amp; Polygons
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-1.5">
              <Layers className="h-4 w-4" />
              Truckload Groups
              {groups.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {groups.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="map" className="flex-1 m-0 relative">
          <PolygonMap
            polygons={polygons}
            orders={orderDots}
            selectedPolygonId={selectedPolygonId}
            onPolygonCreated={handlePolygonCreated}
            onPolygonUpdated={handlePolygonUpdated}
            onPolygonSelected={setSelectedPolygonId}
            onPolygonDeleted={(id) => deletePolygonMutation.mutate(id)}
          />
          {selectedPolygon && !isCreatingPolygon && (
            <div className="absolute top-4 right-4 z-10">
              <PolygonRulesDialog
                polygon={selectedPolygon}
                onSave={handleUpdatePolygonRules}
                onDelete={() => {
                  deletePolygonMutation.mutate(selectedPolygon.id)
                }}
                mode="edit"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups" className="flex-1 m-0 overflow-auto">
          <TruckloadGroups
            groups={matchData?.success ? matchData.groups : []}
            unmatchedOrders={matchData?.success ? matchData.unmatchedOrders : []}
            allPolygons={polygons}
            isLoading={isMatching}
            onCreateGroup={() => {
              setEditingGroup(null)
              setIsGroupDialogOpen(true)
            }}
            onEditGroup={(group) => {
              setEditingGroup(group)
              setIsGroupDialogOpen(true)
            }}
            onRefresh={() => runMatch()}
          />
        </TabsContent>
      </Tabs>

      <PolygonRulesDialog
        isOpen={isCreatingPolygon}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreatingPolygon(false)
            setPendingCoordinates(null)
          }
        }}
        onSave={handleSaveNewPolygon}
        mode="create"
      />

      <GroupDialog
        isOpen={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        group={editingGroup}
        allPolygons={polygons}
      />
    </div>
  )
}
