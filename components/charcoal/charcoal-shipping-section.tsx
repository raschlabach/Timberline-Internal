'use client'

import Link from 'next/link'
import { useCharcoalDashboard } from './use-charcoal'
import { InventoryPanel } from './inventory-panel'
import { ProjectionsPanel } from './projections-panel'
import { OrderCard } from './order-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ClipboardList, ArrowRight } from 'lucide-react'

export function CharcoalShippingSection() {
  const { data, isLoading, error } = useCharcoalDashboard()

  if (isLoading) {
    return (
      <div className="space-y-4 border-t pt-6 mt-6">
        <h2 className="text-xl font-bold">Charcoal Operations</h2>
        <Skeleton className="h-[300px]" />
      </div>
    )
  }

  if (error || !data) return null

  return (
    <div className="space-y-6 border-t border-gray-200 pt-6 mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Charcoal Operations</h2>
        <Link
          href="/dashboard/charcoal/history"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          View History <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <InventoryPanel
            skids={data.skids}
            stdCount={data.counters.stdInv}
            wcCount={data.counters.wcInv}
            lastSkid={data.lastSkid}
            isOffice={false}
            canEditSkids={true}
          />
          <ProjectionsPanel
            projections={data.projections}
            stdProj={data.counters.stdProj}
            wcProj={data.counters.wcProj}
            isOffice={false}
          />
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList size={18} />
              Open Orders — Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No open orders</p>
            ) : (
              <div className="space-y-2">
                {data.orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    allocation={data.allocation[order.id]}
                    isOffice={false}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
