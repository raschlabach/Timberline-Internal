'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Check,
  AlertTriangle,
  Package,
  Truck,
  Calendar,
  Edit,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns'

interface TruckloadGroupsProps {
  groups: any[]
  unmatchedOrders: any[]
  allPolygons: any[]
  isLoading: boolean
  onCreateGroup: () => void
  onEditGroup: (group: any) => void
  onRefresh: () => void
}

function OrderRow({ order }: { order: any }) {
  const pickupDate = order.pickupDate ? parseISO(order.pickupDate) : null
  const isDateToday = pickupDate && isToday(pickupDate)
  const isDateFuture = pickupDate && isFuture(pickupDate)

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted/30">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Pickup" />
            <span className="truncate font-medium">{order.pickupCustomer}</span>
            <span className="text-muted-foreground text-xs flex-shrink-0">
              {order.pickupCity}, {order.pickupState}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-800 flex-shrink-0" title="Delivery" />
            <span className="truncate font-medium">{order.deliveryCustomer}</span>
            <span className="text-muted-foreground text-xs flex-shrink-0">
              {order.deliveryCity}, {order.deliveryState}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {parseInt(order.totalFootage) > 0 && (
          <Badge variant="outline" className="text-xs">
            {parseInt(order.totalFootage).toLocaleString()} ft²
          </Badge>
        )}
        {pickupDate && (
          <Badge
            variant={isDateToday ? 'default' : isDateFuture ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {format(pickupDate, 'M/d')}
          </Badge>
        )}
        {order.isRush && (
          <Badge variant="destructive" className="text-xs">
            Rush
          </Badge>
        )}
      </div>
    </div>
  )
}

function GroupCard({
  group,
  onEdit,
  onConfirm,
  isConfirming,
}: {
  group: any
  onEdit: () => void
  onConfirm: (orderIds: number[], startDate: string) => void
  isConfirming: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showFuture, setShowFuture] = useState(false)
  const [confirmDate, setConfirmDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { todayOrders, futureOrders } = useMemo(() => {
    const today: any[] = []
    const future: any[] = []
    for (const order of group.orders || []) {
      const d = order.pickupDate ? parseISO(order.pickupDate) : null
      if (d && isFuture(d) && !isToday(d)) {
        future.push(order)
      } else {
        today.push(order)
      }
    }
    return { todayOrders: today, futureOrders: future }
  }, [group.orders])

  const displayOrders = showFuture ? futureOrders : todayOrders

  return (
    <Card className={group.isOverFootage || group.isOverStops ? 'border-amber-400' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-muted rounded p-0.5">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <CardTitle className="text-base">{group.name}</CardTitle>
            {group.preferredDriverName && (
              <Badge variant="outline" className="text-xs">
                <Truck className="h-3 w-3 mr-1" />
                {group.preferredDriverName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            {group.totalStops} stops
          </Badge>
          <Badge
            variant={group.isOverFootage ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {group.totalFootage.toLocaleString()} ft²
            {group.maxFootage ? ` / ${group.maxFootage.toLocaleString()}` : ''}
          </Badge>
          {group.isOverFootage && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
          {group.isOverStops && (
            <Badge variant="destructive" className="text-xs">
              Over {group.maxStops} stop limit
            </Badge>
          )}
          {futureOrders.length > 0 && (
            <button
              onClick={() => setShowFuture(!showFuture)}
              className="text-xs text-blue-600 hover:underline ml-auto"
            >
              {showFuture
                ? `Show today (${todayOrders.length})`
                : `Show future (${futureOrders.length})`}
            </button>
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          {displayOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {showFuture ? 'No future orders' : 'No orders for today'}
            </p>
          ) : (
            <div className="border rounded-md divide-y">
              {displayOrders.map((order: any) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
          {todayOrders.length > 0 && !showFuture && (
            <div className="flex items-center gap-2 mt-3">
              <Input
                type="date"
                value={confirmDate}
                onChange={(e) => setConfirmDate(e.target.value)}
                className="w-40"
              />
              <Button
                size="sm"
                onClick={() =>
                  onConfirm(
                    todayOrders.map((o: any) => o.id),
                    confirmDate
                  )
                }
                disabled={isConfirming || todayOrders.length === 0}
                className="ml-auto"
              >
                <Check className="h-4 w-4 mr-1" />
                Confirm as Draft Truckload
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function TruckloadGroups({
  groups,
  unmatchedOrders,
  allPolygons,
  isLoading,
  onCreateGroup,
  onEditGroup,
  onRefresh,
}: TruckloadGroupsProps) {
  const queryClient = useQueryClient()
  const [showUnmatched, setShowUnmatched] = useState(true)

  const confirmMutation = useMutation({
    mutationFn: async ({
      groupId,
      orderIds,
      startDate,
    }: {
      groupId: number
      orderIds: number[]
      startDate: string
    }) => {
      const res = await fetch(`/api/suggested-loads/groups/${groupId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, startDate, endDate: startDate }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        onRefresh()
      }
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  const hasData = groups.length > 0 || unmatchedOrders.length > 0

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Truckload Groups</h2>
        <Button size="sm" onClick={onCreateGroup}>
          <Plus className="h-4 w-4 mr-1" />
          New Group
        </Button>
      </div>

      {!hasData && (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No match results yet. Set your date range and click &quot;Run Match&quot; to see suggested loads.
            </p>
          </CardContent>
        </Card>
      )}

      {groups.map((group: any) => (
        <GroupCard
          key={group.id}
          group={group}
          onEdit={() => onEditGroup(group)}
          onConfirm={(orderIds, startDate) =>
            confirmMutation.mutate({ groupId: group.id, orderIds, startDate })
          }
          isConfirming={confirmMutation.isPending}
        />
      ))}

      {unmatchedOrders.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUnmatched(!showUnmatched)}
                  className="hover:bg-muted rounded p-0.5"
                >
                  {showUnmatched ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <CardTitle className="text-base text-muted-foreground">Unmatched Orders</CardTitle>
                <Badge variant="destructive" className="text-xs">
                  {unmatchedOrders.length}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              These orders didn&apos;t fall into any polygon zone
            </p>
          </CardHeader>
          {showUnmatched && (
            <CardContent className="pt-0">
              <div className="border rounded-md divide-y">
                {unmatchedOrders.map((order: any) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
