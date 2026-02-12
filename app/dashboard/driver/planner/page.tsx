'use client'

import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/modal'
import {
  ChevronLeft,
  ChevronRight,
  Truck,
  CalendarDays,
  StickyNote,
  Palmtree,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Hash,
  FileText,
  Calendar,
  Loader2,
  Layers,
} from 'lucide-react'
import type { PlannerTruckload, PlannerDriver, DriverScheduleEvent, PlannerNote } from '@/types/truckloads'

// Trailer layout types
interface LayoutItem {
  x: number
  y: number
  width: number
  length: number
  item_id: number
  type: 'skid' | 'vinyl'
  customerId: number
  customerName: string
  rotation: number
  stackId?: number | null
  stackPosition?: number | null
}

interface LayoutStack {
  stackId: number
  x: number
  y: number
  items: LayoutItem[]
}

const GRID_WIDTH = 8
const GRID_LENGTH = 53
const CELL_SIZE = 16 // smaller for mobile (original is 24)

const CUSTOMER_COLORS = [
  'bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-orange-100', 'bg-pink-100',
  'bg-yellow-100', 'bg-indigo-100', 'bg-red-100', 'bg-teal-100', 'bg-cyan-100',
]

function getCustomerColorClass(customerId: number): string {
  return CUSTOMER_COLORS[customerId % CUSTOMER_COLORS.length]
}

function buildStacks(items: LayoutItem[]): LayoutStack[] {
  const stackMap = new Map<number, LayoutItem[]>()
  for (const item of items) {
    if (item.stackId) {
      const existing = stackMap.get(item.stackId) || []
      existing.push(item)
      stackMap.set(item.stackId, existing)
    }
  }
  const stacks: LayoutStack[] = []
  stackMap.forEach((stackItems, stackId) => {
    if (stackItems.length > 1) {
      stackItems.sort((a, b) => (a.stackPosition || 0) - (b.stackPosition || 0))
      stacks.push({
        stackId,
        x: stackItems[stackItems.length - 1].x,
        y: stackItems[stackItems.length - 1].y,
        items: stackItems,
      })
    }
  })
  return stacks.sort((a, b) => a.stackId - b.stackId)
}

type ViewMode = 'week' | '2week' | 'month'

export default function DriverPlannerPage() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id ? Number(session.user.id) : null

  const [currentDate, setCurrentDate] = useState(new Date())
  // Default to 1-week view on initial render (mobile-friendly), users can expand
  const [viewMode, setViewMode] = useState<ViewMode>('week')

  // Truckload detail dialog state
  const [selectedTruckload, setSelectedTruckload] = useState<PlannerTruckload | null>(null)
  const [isTruckloadDialogOpen, setIsTruckloadDialogOpen] = useState(false)
  const [isLoadingStops, setIsLoadingStops] = useState(false)
  const [stopCounts, setStopCounts] = useState<{ pickups: number; deliveries: number; transfers: number; total: number }>({ pickups: 0, deliveries: 0, transfers: 0, total: 0 })

  // Trailer layout state
  const [isLoadingLayout, setIsLoadingLayout] = useState(false)
  const [deliveryLayout, setDeliveryLayout] = useState<LayoutItem[]>([])
  const [pickupLayout, setPickupLayout] = useState<LayoutItem[]>([])
  const [activeLayoutTab, setActiveLayoutTab] = useState<'delivery' | 'pickup'>('delivery')

  async function handleTruckloadClick(truckload: PlannerTruckload) {
    setSelectedTruckload(truckload)
    setIsTruckloadDialogOpen(true)
    setIsLoadingStops(true)
    setIsLoadingLayout(true)
    setStopCounts({ pickups: 0, deliveries: 0, transfers: 0, total: 0 })
    setDeliveryLayout([])
    setPickupLayout([])
    setActiveLayoutTab('delivery')

    // Fetch stops and layouts in parallel
    const [stopsResult, deliveryLayoutResult, pickupLayoutResult] = await Promise.allSettled([
      fetch(`/api/truckloads/${truckload.id}/orders`).then(r => r.ok ? r.json() : null),
      fetch(`/api/truckloads/${truckload.id}/layout?type=delivery`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/truckloads/${truckload.id}/layout?type=pickup`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])

    // Process stops
    if (stopsResult.status === 'fulfilled' && stopsResult.value) {
      const orders = stopsResult.value.orders || []
      let pickups = 0
      let deliveries = 0
      let transfers = 0
      for (const order of orders) {
        if (order.is_transfer_order) {
          transfers++
        } else if (order.assignment_type === 'pickup') {
          pickups++
        } else {
          deliveries++
        }
      }
      setStopCounts({ pickups, deliveries, transfers, total: orders.length })
    }
    setIsLoadingStops(false)

    // Process layouts
    if (deliveryLayoutResult.status === 'fulfilled' && deliveryLayoutResult.value?.layout) {
      setDeliveryLayout(deliveryLayoutResult.value.layout)
    }
    if (pickupLayoutResult.status === 'fulfilled' && pickupLayoutResult.value?.layout) {
      setPickupLayout(pickupLayoutResult.value.layout)
    }
    setIsLoadingLayout(false)
  }

  // Calculate date range based on view mode
  const { weekStart, weekEnd, dateRange } = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 })
    let numDays: number

    switch (viewMode) {
      case 'week':
        numDays = 6
        break
      case '2week':
        numDays = 13
        break
      case 'month':
        numDays = 27
        break
      default:
        numDays = 6
    }

    const end = addDays(start, numDays)

    const range: Date[] = []
    for (let i = 0; i <= numDays; i++) {
      range.push(addDays(start, i))
    }

    return { weekStart: start, weekEnd: end, dateRange: range }
  }, [currentDate, viewMode])

  // Fetch planner data
  const { data, isLoading, isError, refetch } = useQuery<{
    drivers: PlannerDriver[]
    truckloads: PlannerTruckload[]
    driverEvents: DriverScheduleEvent[]
    plannerNotes: PlannerNote[]
  }>({
    queryKey: ['driver-planner-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await fetch(
        `/api/planner/data?startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}`
      )
      if (!response.ok) throw new Error('Failed to fetch planner data')
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      return {
        drivers: result.drivers || [],
        truckloads: result.truckloads || [],
        driverEvents: result.driverEvents || [],
        plannerNotes: result.plannerNotes || [],
      }
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  })

  const drivers = data?.drivers || []
  const truckloads = data?.truckloads || []
  const driverEvents = data?.driverEvents || []
  const plannerNotes = data?.plannerNotes || []

  // Sort drivers so the current driver is always first
  const sortedDrivers = useMemo(() => {
    if (!drivers.length || !currentUserId) return drivers
    const me = drivers.filter((d) => d.id === currentUserId)
    const others = drivers.filter((d) => d.id !== currentUserId)
    return [...me, ...others]
  }, [drivers, currentUserId])

  // Navigate weeks
  function navigatePrev() {
    setCurrentDate(prev => subWeeks(prev, viewMode === 'month' ? 4 : viewMode === '2week' ? 2 : 1))
  }

  function navigateNext() {
    setCurrentDate(prev => addWeeks(prev, viewMode === 'month' ? 4 : viewMode === '2week' ? 2 : 1))
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  // Get truckloads for a driver
  function getDriverTruckloads(driverId: number): PlannerTruckload[] {
    return truckloads.filter((t) => t.driverId === driverId)
  }

  // Get schedule events for a driver
  function getDriverEvents(driverId: number): DriverScheduleEvent[] {
    return driverEvents.filter((e) => e.driverId === driverId)
  }

  // Get events for a specific cell
  function getEventsForCell(driverId: number, date: Date): DriverScheduleEvent[] {
    const dateStr = format(date, 'yyyy-MM-dd')
    return driverEvents.filter((e) => {
      if (e.driverId !== driverId) return false
      return e.startDate <= dateStr && e.endDate >= dateStr
    })
  }

  // Convert time to fraction of day
  function timeToFraction(time: string | null): number {
    if (!time) return 0
    const parts = time.split(':')
    const hours = parseInt(parts[0]) || 0
    const minutes = parseInt(parts[1]) || 0
    return (hours + minutes / 60) / 24
  }

  // Calculate block position for truckloads
  function getBlockPosition(truckload: PlannerTruckload): { left: number; width: number } | null {
    const totalDays = dateRange.length
    const rangeStartStr = format(dateRange[0], 'yyyy-MM-dd')
    const rangeEndStr = format(dateRange[totalDays - 1], 'yyyy-MM-dd')

    if (truckload.endDate < rangeStartStr || truckload.startDate > rangeEndStr) return null

    let startDay = 0
    for (let i = 0; i < totalDays; i++) {
      if (format(dateRange[i], 'yyyy-MM-dd') === truckload.startDate) {
        startDay = i
        break
      } else if (format(dateRange[i], 'yyyy-MM-dd') > truckload.startDate) {
        startDay = 0
        break
      }
      startDay = i + 1
    }
    if (truckload.startDate < rangeStartStr) startDay = 0

    let endDay = totalDays - 1
    for (let i = totalDays - 1; i >= 0; i--) {
      if (format(dateRange[i], 'yyyy-MM-dd') === truckload.endDate) {
        endDay = i
        break
      } else if (format(dateRange[i], 'yyyy-MM-dd') < truckload.endDate) {
        endDay = totalDays - 1
        break
      }
    }

    const startTimeFraction = truckload.startDate >= rangeStartStr ? timeToFraction(truckload.startTime) : 0
    const endTimeFraction = truckload.endDate <= rangeEndStr ? (truckload.endTime ? timeToFraction(truckload.endTime) : 1) : 1

    const leftPos = (startDay + startTimeFraction) / totalDays * 100
    const rightPos = (endDay + endTimeFraction) / totalDays * 100
    const widthPercent = rightPos - leftPos

    return { left: leftPos, width: Math.max(widthPercent, 100 / totalDays * 0.3) }
  }

  // Calculate block position for schedule events
  function getEventBlockPosition(event: DriverScheduleEvent): { left: number; width: number } | null {
    const totalDays = dateRange.length
    const rangeStartStr = format(dateRange[0], 'yyyy-MM-dd')
    const rangeEndStr = format(dateRange[totalDays - 1], 'yyyy-MM-dd')

    if (event.endDate < rangeStartStr || event.startDate > rangeEndStr) return null

    let startDay = 0
    for (let i = 0; i < totalDays; i++) {
      if (format(dateRange[i], 'yyyy-MM-dd') >= event.startDate) { startDay = i; break }
      startDay = i
    }
    if (event.startDate < rangeStartStr) startDay = 0

    let endDay = totalDays - 1
    for (let i = totalDays - 1; i >= 0; i--) {
      if (format(dateRange[i], 'yyyy-MM-dd') <= event.endDate) { endDay = i; break }
    }

    const leftPos = startDay / totalDays * 100
    const rightPos = (endDay + 1) / totalDays * 100
    const widthPercent = rightPos - leftPos

    return { left: leftPos, width: widthPercent }
  }

  // Get daily note for a date
  function getDailyNote(date: Date): PlannerNote | null {
    const dateStr = format(date, 'yyyy-MM-dd')
    return plannerNotes.find((n) => n.noteType === 'daily' && n.noteDate === dateStr) || null
  }

  function isToday(date: Date): boolean {
    return isSameDay(date, new Date())
  }

  // Assign vertical lanes for overlapping items
  function assignLanes(items: { startDate: string; endDate: string }[]): number[] {
    const lanes: number[] = new Array(items.length).fill(0)
    for (let i = 0; i < items.length; i++) {
      const usedLanes = new Set<number>()
      for (let j = 0; j < i; j++) {
        if (items[j].startDate <= items[i].endDate && items[j].endDate >= items[i].startDate) {
          usedLanes.add(lanes[j])
        }
      }
      let lane = 0
      while (usedLanes.has(lane)) lane++
      lanes[i] = lane
    }
    return lanes
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-red-500">Failed to load schedule data</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <CalendarDays className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-xs text-gray-500">View upcoming truckloads and schedule</p>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between bg-white rounded-lg border px-3 py-2 flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs">
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-xs md:text-sm font-semibold text-gray-900">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h2>

        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(['week', '2week', 'month'] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="sm"
              className={`h-7 px-2 md:px-3 text-[11px] md:text-xs ${
                viewMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'week' ? '1W' : mode === '2week' ? '2W' : '4W'}
            </Button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border overflow-auto">
        <div style={viewMode !== 'week' ? { width: `${120 + dateRange.length * 100}px` } : undefined}>
          {/* Date headers */}
          <div className="flex bg-gray-50 border-b">
            <div className="w-[100px] md:w-[140px] min-w-[100px] md:min-w-[140px] p-1.5 md:p-2 text-left text-[10px] md:text-xs font-semibold text-gray-600 border-r sticky left-0 bg-gray-50 z-10">
              Driver
            </div>
            <div className={viewMode === 'week' ? 'flex flex-1' : 'flex'}>
              {dateRange.map((date) => {
                const dayIsToday = isToday(date)
                const isSunday = date.getDay() === 0
                const isSaturday = date.getDay() === 6
                return (
                  <div
                    key={date.toISOString()}
                    className={`${viewMode === 'week' ? 'flex-1' : 'w-[100px] min-w-[100px]'} p-1 md:p-1.5 text-center border-r ${
                      dayIsToday ? 'bg-indigo-50' : isSunday || isSaturday ? 'bg-gray-100' : ''
                    }`}
                  >
                    <div className="text-[10px] md:text-xs text-gray-500 font-medium">{format(date, 'EEE')}</div>
                    <div className={`text-xs md:text-sm font-bold ${dayIsToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                      {format(date, 'MMM d')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Daily Notes row */}
          <div className="flex bg-amber-50/30 border-b">
            <div className="w-[100px] md:w-[140px] min-w-[100px] md:min-w-[140px] p-1.5 text-[10px] md:text-xs font-medium text-amber-700 border-r sticky left-0 bg-amber-50/30 z-10">
              <div className="flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Notes
              </div>
            </div>
            <div className={viewMode === 'week' ? 'flex flex-1' : 'flex'}>
              {dateRange.map((date) => {
                const note = getDailyNote(date)
                return (
                  <div
                    key={`note-${date.toISOString()}`}
                    className={`${viewMode === 'week' ? 'flex-1' : 'w-[100px] min-w-[100px]'} border-r p-1`}
                  >
                    {note ? (
                      <div className="text-[10px] md:text-xs text-amber-800 bg-amber-100/50 rounded px-1.5 py-1 truncate">
                        {note.content}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Driver rows */}
          {sortedDrivers.map((driver) => {
            const isMe = driver.id === currentUserId
            const driverLoads = getDriverTruckloads(driver.id)
            const driverScheduleEvents = getDriverEvents(driver.id)

            const eventLanes = assignLanes(driverScheduleEvents.map((e) => ({ startDate: e.startDate, endDate: e.endDate })))
            const maxEventLane = eventLanes.length > 0 ? Math.max(...eventLanes) + 1 : 0

            const loadLanes = assignLanes(driverLoads.map((l) => ({ startDate: l.startDate, endDate: l.endDate })))
            const maxLoadLane = loadLanes.length > 0 ? Math.max(...loadLanes) + 1 : 0

            const blockHeight = 28
            const blockGap = 3
            const topPad = 4
            const eventRowsHeight = maxEventLane > 0 ? maxEventLane * (blockHeight + blockGap) : 0
            const loadRowsHeight = maxLoadLane > 0 ? maxLoadLane * (blockHeight + blockGap) : 0
            const rowHeight = Math.max(44, topPad + eventRowsHeight + loadRowsHeight + topPad)

            return (
              <div
                key={driver.id}
                className={`flex border-b transition-all ${
                  isMe
                    ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200'
                    : ''
                }`}
              >
                {/* Driver name cell */}
                <div
                  className={`w-[100px] md:w-[140px] min-w-[100px] md:min-w-[140px] p-1.5 md:p-2 border-r sticky left-0 z-10 flex items-start gap-1.5 ${
                    isMe ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: driver.color }} />
                    <div className="min-w-0">
                      <span className={`text-xs md:text-sm font-medium truncate block ${isMe ? 'text-blue-900' : 'text-gray-900'}`}>
                        {driver.full_name}
                      </span>
                      {isMe && (
                        <span className="text-[9px] md:text-[10px] text-blue-600 font-semibold uppercase">You</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Day columns with overlaid blocks */}
                <div
                  className={`relative ${viewMode === 'week' ? 'flex-1' : ''}`}
                  style={{ minHeight: `${rowHeight}px`, ...(viewMode !== 'week' ? { width: `${dateRange.length * 100}px` } : {}) }}
                >
                  {/* Background day grid */}
                  <div className="absolute inset-0 flex">
                    {dateRange.map((date) => {
                      const dayIsToday = isToday(date)
                      const isSunday = date.getDay() === 0
                      const isSaturday = date.getDay() === 6
                      const cellEvents = getEventsForCell(driver.id, date)
                      const hasEvent = cellEvents.length > 0

                      return (
                        <div
                          key={`bg-${driver.id}-${date.toISOString()}`}
                          className={`${viewMode === 'week' ? 'flex-1' : 'w-[100px] min-w-[100px]'} border-r ${
                            hasEvent
                              ? 'bg-purple-50/30'
                              : dayIsToday
                              ? 'bg-indigo-50/20'
                              : isSunday || isSaturday
                              ? 'bg-gray-50/30'
                              : ''
                          }`}
                        />
                      )
                    })}
                  </div>

                  {/* Schedule event blocks */}
                  {driverScheduleEvents.map((event, eventIdx) => {
                    const pos = getEventBlockPosition(event)
                    if (!pos) return null
                    const lane = eventLanes[eventIdx]

                    return (
                      <div
                        key={`event-${event.id}`}
                        className="absolute z-[2] px-0.5"
                        style={{
                          left: `${pos.left}%`,
                          width: `${pos.width}%`,
                          top: `${topPad + lane * (blockHeight + blockGap)}px`,
                          height: `${blockHeight}px`,
                        }}
                      >
                        <div
                          className="h-full rounded px-1.5 flex items-center gap-1 bg-purple-100 border border-purple-200 text-purple-700 text-[10px] md:text-xs font-medium truncate"
                          title={`${event.eventType}: ${event.description || ''}`}
                        >
                          <Palmtree className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {event.eventType === 'vacation' ? 'Vacation' :
                             event.eventType === 'sick' ? 'Sick' :
                             event.eventType === 'unavailable' ? 'Unavailable' : event.description || 'Event'}
                            {event.description ? ` - ${event.description}` : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Truckload blocks */}
                  {driverLoads.map((truckload, loadIdx) => {
                    const pos = getBlockPosition(truckload)
                    if (!pos) return null

                    const isDraft = truckload.status === 'draft'
                    const isCompleted = truckload.isCompleted || truckload.status === 'completed'
                    const lane = loadLanes[loadIdx]

                    return (
                      <div
                        key={`load-${truckload.id}`}
                        className="absolute z-[3] px-0.5"
                        style={{
                          left: `${pos.left}%`,
                          width: `${pos.width}%`,
                          top: `${topPad + eventRowsHeight + lane * (blockHeight + blockGap)}px`,
                          height: `${blockHeight}px`,
                        }}
                      >
                        <button
                          onClick={() => handleTruckloadClick(truckload)}
                          className={`h-full w-full rounded-md px-1.5 flex items-center gap-1 text-[10px] md:text-xs font-medium truncate border-2 cursor-pointer hover:shadow-md transition-shadow ${
                            isDraft
                              ? 'bg-gray-100 border-dashed'
                              : isCompleted
                              ? 'bg-green-50'
                              : isMe
                              ? 'bg-blue-100'
                              : 'bg-blue-50'
                          }`}
                          style={{
                            borderColor: driver.color || '#9ca3af',
                            color: '#1f2937',
                          }}
                        >
                          {isDraft ? (
                            <Badge variant="outline" className="h-4 px-1 text-[8px] md:text-[9px] bg-amber-100 text-amber-700 border-amber-300 flex-shrink-0">
                              Draft
                            </Badge>
                          ) : isCompleted ? (
                            <Badge variant="outline" className="h-4 px-1 text-[8px] md:text-[9px] bg-green-100 text-green-700 border-green-300 flex-shrink-0">
                              Done
                            </Badge>
                          ) : (
                            <Truck className="h-3 w-3 flex-shrink-0" />
                          )}
                          {truckload.description && (
                            <span className="truncate">{truckload.description}</span>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-xs text-gray-500 px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded border-2 border-dashed border-gray-400 bg-gray-100" />
          <span>Draft</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded border-2 border-gray-400 bg-blue-50" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded border-2 border-gray-400 bg-green-50" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded border border-purple-200 bg-purple-100" />
          <span>Schedule Event</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded border-2 border-blue-400 bg-blue-100" />
          <span>Your Row</span>
        </div>
      </div>

      {/* Truckload Detail Dialog */}
      {selectedTruckload && (() => {
        const currentLayout = activeLayoutTab === 'delivery' ? deliveryLayout : pickupLayout
        const stacks = buildStacks(currentLayout)
        const hasDeliveryLayout = deliveryLayout.length > 0
        const hasPickupLayout = pickupLayout.length > 0
        const hasAnyLayout = hasDeliveryLayout || hasPickupLayout

        return (
          <Dialog open={isTruckloadDialogOpen} onOpenChange={setIsTruckloadDialogOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {selectedTruckload.description || `Truckload #${selectedTruckload.id}`}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {/* Status badge */}
                <div>
                  {selectedTruckload.status === 'draft' ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Draft</Badge>
                  ) : selectedTruckload.isCompleted || selectedTruckload.status === 'completed' ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Completed</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Active</Badge>
                  )}
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>
                    {selectedTruckload.startDate}
                    {selectedTruckload.startDate !== selectedTruckload.endDate && ` → ${selectedTruckload.endDate}`}
                  </span>
                </div>

                {/* Trailer number */}
                {selectedTruckload.trailerNumber && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Hash className="h-4 w-4 text-gray-400" />
                    <span>Trailer {selectedTruckload.trailerNumber}</span>
                  </div>
                )}

                {/* BOL number */}
                {selectedTruckload.billOfLadingNumber && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span>BOL {selectedTruckload.billOfLadingNumber}</span>
                  </div>
                )}

                {/* Stop counts */}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Stops</p>
                  {isLoadingStops ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading stops...
                    </div>
                  ) : stopCounts.total === 0 ? (
                    <p className="text-sm text-gray-400">No stops assigned</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <ArrowUp className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-[10px] font-semibold text-red-500 uppercase">Pickups</span>
                        </div>
                        <p className="text-xl font-bold text-red-600">{stopCounts.pickups}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <ArrowDown className="h-3.5 w-3.5 text-gray-700" />
                          <span className="text-[10px] font-semibold text-gray-500 uppercase">Deliveries</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{stopCounts.deliveries}</p>
                      </div>
                      {stopCounts.transfers > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-[10px] font-semibold text-blue-500 uppercase">Transfers</span>
                          </div>
                          <p className="text-xl font-bold text-blue-600">{stopCounts.transfers}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Trailer Layout */}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trailer Layout</p>
                  </div>

                  {isLoadingLayout ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading layout...
                    </div>
                  ) : !hasAnyLayout ? (
                    <p className="text-sm text-gray-400">No layout has been created yet</p>
                  ) : (
                    <>
                      {/* Layout type tabs */}
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mb-3">
                        <Button
                          variant={activeLayoutTab === 'delivery' ? 'default' : 'ghost'}
                          size="sm"
                          className={`flex-1 h-7 text-xs ${
                            activeLayoutTab === 'delivery' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                          }`}
                          onClick={() => setActiveLayoutTab('delivery')}
                          disabled={!hasDeliveryLayout}
                        >
                          Outgoing {hasDeliveryLayout ? `(${deliveryLayout.length})` : ''}
                        </Button>
                        <Button
                          variant={activeLayoutTab === 'pickup' ? 'default' : 'ghost'}
                          size="sm"
                          className={`flex-1 h-7 text-xs ${
                            activeLayoutTab === 'pickup' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                          }`}
                          onClick={() => setActiveLayoutTab('pickup')}
                          disabled={!hasPickupLayout}
                        >
                          Incoming {hasPickupLayout ? `(${pickupLayout.length})` : ''}
                        </Button>
                      </div>

                      {currentLayout.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          No {activeLayoutTab} layout created
                        </p>
                      ) : (
                        <div className="flex gap-3">
                          {/* Trailer grid - read only */}
                          <div className="overflow-auto flex-shrink-0">
                            <div className="bg-gray-50 p-2 rounded-lg">
                              <div
                                className="relative border border-gray-200 bg-white"
                                style={{
                                  width: GRID_WIDTH * CELL_SIZE,
                                  height: GRID_LENGTH * CELL_SIZE,
                                }}
                              >
                                {/* Grid lines */}
                                {Array.from({ length: GRID_WIDTH }).map((_, i) => (
                                  <div
                                    key={`v-${i}`}
                                    className="absolute border-l border-gray-100"
                                    style={{ left: i * CELL_SIZE, height: '100%' }}
                                  />
                                ))}
                                {Array.from({ length: GRID_LENGTH }).map((_, i) => (
                                  <div
                                    key={`h-${i}`}
                                    className="absolute border-t border-gray-100"
                                    style={{ top: i * CELL_SIZE, width: '100%' }}
                                  />
                                ))}

                                {/* Placed items */}
                                {currentLayout.map((item, index) => {
                                  // Skip non-bottom stack items
                                  if (item.stackId) {
                                    const stack = stacks.find(s => s.stackId === item.stackId)
                                    if (stack) {
                                      const bottomItem = stack.items[stack.items.length - 1]
                                      if (item.item_id !== bottomItem.item_id || item.x !== bottomItem.x || item.y !== bottomItem.y) {
                                        return null
                                      }
                                    }
                                  }

                                  const currentStack = item.stackId ? stacks.find(s => s.stackId === item.stackId) : null
                                  const isStack = currentStack && currentStack.items.length > 1
                                  const bottomItem = isStack ? currentStack.items[currentStack.items.length - 1] : item

                                  return (
                                    <div
                                      key={`item-${item.item_id}-${index}`}
                                      className={`absolute ${
                                        isStack
                                          ? 'bg-gray-100/70 border-2 border-dotted border-gray-400'
                                          : `${item.type === 'vinyl' ? 'border-[2px] border-dashed' : 'border'} border-black ${getCustomerColorClass(item.customerId)}`
                                      }`}
                                      style={{
                                        left: bottomItem.x * CELL_SIZE,
                                        top: bottomItem.y * CELL_SIZE,
                                        width: bottomItem.width * CELL_SIZE,
                                        height: bottomItem.length * CELL_SIZE,
                                        zIndex: 10,
                                      }}
                                    >
                                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-0.5 overflow-hidden">
                                        {isStack ? (
                                          <>
                                            <div className="font-medium text-[8px] leading-tight">Stack #{currentStack.stackId}</div>
                                            <div className="text-[7px] text-gray-500">{bottomItem.width}&apos; x {bottomItem.length}&apos;</div>
                                            <div className="text-[7px] text-gray-500">{currentStack.items.length} items</div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="font-medium text-[8px] leading-tight truncate w-full">{item.customerName}</div>
                                            <div className="text-[7px] text-gray-600">{item.width}&apos; x {item.length}&apos;</div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Stacks panel - read only */}
                          {stacks.length > 0 && (
                            <div className="flex-1 min-w-0 space-y-2">
                              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Stacks</p>
                              {stacks.map((stack) => {
                                const hasSkids = stack.items.some(i => i.type === 'skid')
                                const hasVinyl = stack.items.some(i => i.type === 'vinyl')
                                const stackType = hasSkids && hasVinyl ? 'Skid & Vinyl' : hasSkids ? 'Skid' : 'Vinyl'

                                return (
                                  <div key={stack.stackId} className="bg-white border border-gray-200 rounded-lg p-2">
                                    <div className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                                      <span>Stack #{stack.stackId}</span>
                                      <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded">{stackType}</span>
                                    </div>
                                    <div className="space-y-1">
                                      {stack.items.map((item, index) => (
                                        <div
                                          key={item.item_id}
                                          className={`relative p-1.5 rounded ${
                                            item.type === 'vinyl' ? 'border-dashed border' : 'border'
                                          } ${getCustomerColorClass(item.customerId)}`}
                                        >
                                          {/* Trailer line for bottom item */}
                                          {index === stack.items.length - 1 && (
                                            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-[110%] h-0.5 bg-black rounded" />
                                          )}
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-medium bg-white/50 rounded-full w-4 h-4 flex items-center justify-center border border-black/10 flex-shrink-0">
                                              {stack.items.length - index}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <div className="font-medium text-[11px] truncate">{item.customerName}</div>
                                              <div className="text-[9px] text-gray-600">
                                                {item.width}&apos; x {item.length}&apos; &bull; {item.type === 'vinyl' ? 'Vinyl' : 'Skid'}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}
