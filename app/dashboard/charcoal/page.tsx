'use client'

import { useSession } from 'next-auth/react'
import { useCharcoalDashboard } from '@/components/charcoal/use-charcoal'
import { OrdersList } from '@/components/charcoal/orders-list'
import { InventoryPanel } from '@/components/charcoal/inventory-panel'
import { ProjectionsPanel } from '@/components/charcoal/projections-panel'
import { Skeleton } from '@/components/ui/skeleton'

export default function CharcoalDashboardPage() {
  const { data: session } = useSession()
  const { data, isLoading, error } = useCharcoalDashboard()

  const role = session?.user?.role
  const isOffice = role === 'admin' || role === 'user'
  const canEditSkids = isOffice || role === 'shipping_station'

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Charcoal Operations</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <div className="space-y-4">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[200px]" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Charcoal Operations</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <OrdersList
          orders={data.orders}
          allocation={data.allocation}
          isOffice={isOffice}
        />
        <div className="space-y-6">
          <InventoryPanel
            skids={data.skids}
            stdCount={data.counters.stdInv}
            wcCount={data.counters.wcInv}
            lastSkid={data.lastSkid}
            isOffice={isOffice}
            canEditSkids={canEditSkids}
          />
          <ProjectionsPanel
            projections={data.projections}
            totalProj={data.counters.totalProj}
            isOffice={isOffice}
          />
        </div>
      </div>
    </div>
  )
}
