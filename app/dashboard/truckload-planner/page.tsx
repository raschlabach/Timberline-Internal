'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, differenceInDays } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Truck,
  CalendarClock,
  Rocket,
  StickyNote,
  Palmtree,
  Repeat,
  GripVertical,
  ExternalLink,
} from 'lucide-react'
import { CreateDraftDialog } from '@/components/planner/create-draft-dialog'
import { EditPlannerTruckloadDialog } from '@/components/planner/edit-planner-truckload-dialog'
import { DriverScheduleDialog } from '@/components/planner/driver-schedule-dialog'
import { WeeklyNoteEditor } from '@/components/planner/weekly-note-editor'
import { RecurringDraftDialog } from '@/components/planner/recurring-draft-dialog'
import { RecurringNoteDialog } from '@/components/planner/recurring-note-dialog'
import type { PlannerTruckload, PlannerDriver, DriverScheduleEvent, PlannerNote } from '@/types/truckloads'

type ViewMode = 'week' | '2week' | 'month' | 'custom'

export default function TruckloadPlanner() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customEndDate, setCustomEndDate] = useState(format(addWeeks(new Date(), 4), 'yyyy-MM-dd'))

  // Dialog state
  const [isCreateDraftOpen, setIsCreateDraftOpen] = useState(false)
  const [createDefaultDriverId, setCreateDefaultDriverId] = useState<number | null>(null)
  const [createDefaultDate, setCreateDefaultDate] = useState<string | null>(null)
  const [editTruckload, setEditTruckload] = useState<PlannerTruckload | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [scheduleDefaultDriverId, setScheduleDefaultDriverId] = useState<number | null>(null)
  const [isRecurringDraftOpen, setIsRecurringDraftOpen] = useState(false)
  const [isRecurringNoteOpen, setIsRecurringNoteOpen] = useState(false)

  // Driver row ordering state (persisted to localStorage)
  const [driverOrder, setDriverOrder] = useState<number[]>([])
  const [dragDriverId, setDragDriverId] = useState<number | null>(null)
  const [dragOverDriverId, setDragOverDriverId] = useState<number | null>(null)

  // Load saved driver order from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('planner-driver-order')
      if (saved) {
        setDriverOrder(JSON.parse(saved))
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  // Calculate date range based on view mode
  const { weekStart, weekEnd, dateRange } = useMemo(() => {
    if (viewMode === 'custom') {
      const start = new Date(customStartDate + 'T12:00:00')
      const end = new Date(customEndDate + 'T12:00:00')
      const numDays = Math.max(0, differenceInDays(end, start))

      const range: Date[] = []
      for (let i = 0; i <= numDays; i++) {
        range.push(addDays(start, i))
      }

      return { weekStart: start, weekEnd: end, dateRange: range }
    }

    const start = startOfWeek(currentDate, { weekStartsOn: 0 }) // Start on Sunday
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
        numDays = 13
    }

    const end = addDays(start, numDays)

    const range: Date[] = []
    for (let i = 0; i <= numDays; i++) {
      range.push(addDays(start, i))
    }

    return {
      weekStart: start,
      weekEnd: end,
      dateRange: range,
    }
  }, [currentDate, viewMode, customStartDate, customEndDate])

  // Fetch planner data
  const { data, isLoading, isError, refetch } = useQuery<{
    drivers: PlannerDriver[]
    truckloads: PlannerTruckload[]
    driverEvents: DriverScheduleEvent[]
    plannerNotes: PlannerNote[]
  }>({
    queryKey: ['planner-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
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
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  const drivers = data?.drivers || []
  const truckloads = data?.truckloads || []
  const driverEvents = data?.driverEvents || []
  const plannerNotes = data?.plannerNotes || []

  // Compute ordered drivers: respect saved order, append any new drivers at the end
  const orderedDrivers = useMemo(() => {
    if (!drivers.length) return []
    if (!driverOrder.length) return drivers

    const ordered: PlannerDriver[] = []
    const remaining = [...drivers]

    for (const id of driverOrder) {
      const idx = remaining.findIndex((d) => d.id === id)
      if (idx !== -1) {
        ordered.push(remaining.splice(idx, 1)[0])
      }
    }
    // Append any drivers not in the saved order
    return [...ordered, ...remaining]
  }, [drivers, driverOrder])

  const saveDriverOrder = useCallback((newOrder: number[]) => {
    setDriverOrder(newOrder)
    try {
      localStorage.setItem('planner-driver-order', JSON.stringify(newOrder))
    } catch {
      // ignore storage errors
    }
  }, [])

  // --- Driver row reorder drag handlers ---
  function handleDriverDragStart(e: React.DragEvent, driverId: number) {
    e.dataTransfer.setData('text/driver-reorder', String(driverId))
    setDragDriverId(driverId)
  }

  function handleDriverRowDragOver(e: React.DragEvent, driverId: number) {
    e.preventDefault()
    if (driverId !== dragOverDriverId) {
      setDragOverDriverId(driverId)
    }
  }

  function handleDriverRowDrop(e: React.DragEvent, targetDriverId: number) {
    // Check if this is a truckload being dropped onto a driver row
    const truckloadData = e.dataTransfer.getData('text/truckload-reassign')
    if (truckloadData) {
      e.preventDefault()
      const truckloadId = parseInt(truckloadData)
      if (!isNaN(truckloadId)) {
        handleTruckloadReassign(truckloadId, targetDriverId)
      }
      setDragDriverId(null)
      setDragOverDriverId(null)
      return
    }

    // Otherwise it's a driver row reorder
    if (dragDriverId === null || dragDriverId === targetDriverId) {
      setDragDriverId(null)
      setDragOverDriverId(null)
      return
    }

    const currentOrder = orderedDrivers.map((d) => d.id)
    const fromIdx = currentOrder.indexOf(dragDriverId)
    const toIdx = currentOrder.indexOf(targetDriverId)

    if (fromIdx === -1 || toIdx === -1) {
      setDragDriverId(null)
      setDragOverDriverId(null)
      return
    }

    const newOrder = [...currentOrder]
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, dragDriverId)
    saveDriverOrder(newOrder)
    setDragDriverId(null)
    setDragOverDriverId(null)
  }

  function handleDragEnd() {
    setDragDriverId(null)
    setDragOverDriverId(null)
  }

  // --- Draft truckload reassignment drag handlers ---
  function handleTruckloadDragStart(e: React.DragEvent, truckloadId: number) {
    e.stopPropagation() // Don't trigger the driver row drag
    e.dataTransfer.setData('text/truckload-reassign', String(truckloadId))
    e.dataTransfer.effectAllowed = 'move'
  }

  async function handleTruckloadReassign(truckloadId: number, newDriverId: number) {
    try {
      const response = await fetch(`/api/truckloads/${truckloadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: newDriverId }),
      })
      if (!response.ok) throw new Error('Failed to reassign truckload')
      handleRefresh()
    } catch (error) {
      console.error('Error reassigning truckload:', error)
    }
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['planner-data'] })
  }

  // Navigate weeks
  function navigatePrev() {
    if (viewMode === 'custom') {
      const rangeDays = differenceInDays(new Date(customEndDate + 'T12:00:00'), new Date(customStartDate + 'T12:00:00')) + 1
      const newStart = addDays(new Date(customStartDate + 'T12:00:00'), -rangeDays)
      const newEnd = addDays(new Date(customEndDate + 'T12:00:00'), -rangeDays)
      setCustomStartDate(format(newStart, 'yyyy-MM-dd'))
      setCustomEndDate(format(newEnd, 'yyyy-MM-dd'))
    } else {
      setCurrentDate(prev => subWeeks(prev, viewMode === 'month' ? 4 : viewMode === '2week' ? 2 : 1))
    }
  }

  function navigateNext() {
    if (viewMode === 'custom') {
      const rangeDays = differenceInDays(new Date(customEndDate + 'T12:00:00'), new Date(customStartDate + 'T12:00:00')) + 1
      const newStart = addDays(new Date(customStartDate + 'T12:00:00'), rangeDays)
      const newEnd = addDays(new Date(customEndDate + 'T12:00:00'), rangeDays)
      setCustomStartDate(format(newStart, 'yyyy-MM-dd'))
      setCustomEndDate(format(newEnd, 'yyyy-MM-dd'))
    } else {
      setCurrentDate(prev => addWeeks(prev, viewMode === 'month' ? 4 : viewMode === '2week' ? 2 : 1))
    }
  }

  function goToToday() {
    if (viewMode === 'custom') {
      const rangeDays = differenceInDays(new Date(customEndDate + 'T12:00:00'), new Date(customStartDate + 'T12:00:00'))
      setCustomStartDate(format(new Date(), 'yyyy-MM-dd'))
      setCustomEndDate(format(addDays(new Date(), rangeDays), 'yyyy-MM-dd'))
    } else {
      setCurrentDate(new Date())
    }
  }

  // Get truckloads that overlap the visible range for a driver
  function getDriverTruckloads(driverId: number): PlannerTruckload[] {
    return truckloads.filter((t) => t.driverId === driverId)
  }

  // Get schedule events for a driver that overlap the visible range
  function getDriverEvents(driverId: number): DriverScheduleEvent[] {
    return driverEvents.filter((e) => e.driverId === driverId)
  }

  // Get schedule events for a specific cell (for background coloring)
  function getEventsForCell(driverId: number, date: Date): DriverScheduleEvent[] {
    const dateStr = format(date, 'yyyy-MM-dd')
    return driverEvents.filter((e) => {
      if (e.driverId !== driverId) return false
      return e.startDate <= dateStr && e.endDate >= dateStr
    })
  }

  // Convert time string "HH:MM" to fraction of day (0-1)
  function timeToFraction(time: string | null): number {
    if (!time) return 0
    const parts = time.split(':')
    const hours = parseInt(parts[0]) || 0
    const minutes = parseInt(parts[1]) || 0
    return (hours + minutes / 60) / 24
  }

  // Calculate the left position and width (as percentages) for a truckload block
  function getBlockPosition(truckload: PlannerTruckload): { left: number; width: number } | null {
    const totalDays = dateRange.length
    const rangeStartStr = format(dateRange[0], 'yyyy-MM-dd')
    const rangeEndStr = format(dateRange[totalDays - 1], 'yyyy-MM-dd')

    // Check if truckload overlaps the visible range at all
    if (truckload.endDate < rangeStartStr || truckload.startDate > rangeEndStr) return null

    // Calculate start position (in day units)
    let startDay = 0
    for (let i = 0; i < totalDays; i++) {
      if (format(dateRange[i], 'yyyy-MM-dd') === truckload.startDate) {
        startDay = i
        break
      } else if (format(dateRange[i], 'yyyy-MM-dd') > truckload.startDate) {
        startDay = 0 // Started before visible range - clamp to start
        break
      }
      startDay = i + 1
    }
    // If started before the range
    if (truckload.startDate < rangeStartStr) startDay = 0

    // Calculate end position (in day units)
    let endDay = totalDays - 1
    for (let i = totalDays - 1; i >= 0; i--) {
      if (format(dateRange[i], 'yyyy-MM-dd') === truckload.endDate) {
        endDay = i
        break
      } else if (format(dateRange[i], 'yyyy-MM-dd') < truckload.endDate) {
        endDay = totalDays - 1 // Ends after visible range - clamp to end
        break
      }
    }

    // Add time-based offsets within the start/end day cells
    const startTimeFraction = truckload.startDate >= rangeStartStr ? timeToFraction(truckload.startTime) : 0
    const endTimeFraction = truckload.endDate <= rangeEndStr ? (truckload.endTime ? timeToFraction(truckload.endTime) : 1) : 1

    const leftPos = (startDay + startTimeFraction) / totalDays * 100
    const rightPos = (endDay + endTimeFraction) / totalDays * 100
    const widthPercent = rightPos - leftPos

    return { left: leftPos, width: Math.max(widthPercent, 100 / totalDays * 0.3) } // Min width so it's always visible
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

  // Get note for a specific date
  function getDailyNote(date: Date): PlannerNote | null {
    const dateStr = format(date, 'yyyy-MM-dd')
    return plannerNotes.find((n) => n.noteType === 'daily' && n.noteDate === dateStr) || null
  }

  // Get weekly note (for the Monday of each week)
  function getWeeklyNote(weekStartDate: Date): PlannerNote | null {
    const dateStr = format(weekStartDate, 'yyyy-MM-dd')
    return plannerNotes.find((n) => n.noteType === 'weekly' && n.noteDate === dateStr) || null
  }

  // Handle cell click to create a draft
  function handleCellClick(driverId: number, date: Date) {
    setCreateDefaultDriverId(driverId)
    setCreateDefaultDate(format(date, 'yyyy-MM-dd'))
    setIsCreateDraftOpen(true)
  }

  // Handle truckload card click to edit
  function handleTruckloadClick(truckload: PlannerTruckload, e: React.MouseEvent) {
    e.stopPropagation()
    setEditTruckload(truckload)
    setIsEditOpen(true)
  }

  // Handle driver name click for schedule
  function handleDriverScheduleClick(driverId: number) {
    setScheduleDefaultDriverId(driverId)
    setIsScheduleOpen(true)
  }

  // Check if a date is today
  function isToday(date: Date): boolean {
    return isSameDay(date, new Date())
  }

  // Group dates by week for rendering week notes
  const weekGroups = useMemo(() => {
    const groups: { weekStart: Date; dates: Date[] }[] = []
    let currentGroup: Date[] = []
    let currentWeekStart: Date | null = null

    dateRange.forEach((date, index) => {
      const dayOfWeek = date.getDay()
      if (dayOfWeek === 0 || index === 0) {
        if (currentGroup.length > 0 && currentWeekStart) {
          groups.push({ weekStart: currentWeekStart, dates: currentGroup })
        }
        currentGroup = [date]
        currentWeekStart = date
      } else {
        currentGroup.push(date)
      }
    })
    if (currentGroup.length > 0 && currentWeekStart) {
      groups.push({ weekStart: currentWeekStart, dates: currentGroup })
    }

    return groups
  }, [dateRange])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-red-500">Failed to load planner data</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <CalendarClock className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Truckload Planner</h1>
            <p className="text-sm text-gray-500">Plan and schedule upcoming truckloads</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Schedule button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setScheduleDefaultDriverId(null)
              setIsScheduleOpen(true)
            }}
            className="gap-1.5"
          >
            <Palmtree className="h-3.5 w-3.5" />
            Driver Schedule
          </Button>

          {/* Recurring buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRecurringNoteOpen(true)}
            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
          >
            <Repeat className="h-3.5 w-3.5" />
            Recurring Notes
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRecurringDraftOpen(true)}
            className="gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400"
          >
            <Repeat className="h-3.5 w-3.5" />
            Recurring Drafts
          </Button>

          {/* Create draft button */}
          <Button
            size="sm"
            onClick={() => {
              setCreateDefaultDriverId(null)
              setCreateDefaultDate(null)
              setIsCreateDraftOpen(true)
            }}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New Draft
          </Button>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between bg-white rounded-lg border px-4 py-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
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

        {viewMode === 'custom' ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
            <span className="text-xs text-gray-400">to</span>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
            <span className="text-xs text-gray-500">
              ({dateRange.length} day{dateRange.length !== 1 ? 's' : ''})
            </span>
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-gray-900">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h2>
        )}

        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(['week', '2week', 'month', 'custom'] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="sm"
              className={`h-7 px-3 text-xs ${
                viewMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'week' ? '1 Week' : mode === '2week' ? '2 Weeks' : mode === 'month' ? '4 Weeks' : 'Custom'}
            </Button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border overflow-auto">
        <div style={{ width: `${140 + dateRange.length * 120}px` }}>
          {/* Date headers */}
          <div className="flex bg-gray-50 border-b">
            <div className="w-[140px] min-w-[140px] p-2 text-left text-xs font-semibold text-gray-600 border-r sticky left-0 bg-gray-50 z-10">
              Driver
            </div>
            <div className="flex">
              {dateRange.map((date) => {
                const dayIsToday = isToday(date)
                const isSunday = date.getDay() === 0
                const isSaturday = date.getDay() === 6
                return (
                  <div
                    key={date.toISOString()}
                    className={`w-[120px] min-w-[120px] p-1.5 text-center border-r ${
                      dayIsToday ? 'bg-indigo-50' : isSunday || isSaturday ? 'bg-gray-100' : ''
                    }`}
                  >
                    <div className="text-xs text-gray-500 font-medium">{format(date, 'EEE')}</div>
                    <div className={`text-sm font-bold ${dayIsToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                      {format(date, 'MMM d')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Daily Notes row */}
          <div className="flex bg-amber-50/30 border-b">
            <div className="w-[140px] min-w-[140px] p-1.5 text-xs font-medium text-amber-700 border-r sticky left-0 bg-amber-50/30 z-10">
              <div className="flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Notes
              </div>
            </div>
            <div className="flex">
              {dateRange.map((date) => (
                <div key={`note-${date.toISOString()}`} className="w-[120px] min-w-[120px] border-r p-0.5">
                  <WeeklyNoteEditor
                    noteType="daily"
                    noteDate={format(date, 'yyyy-MM-dd')}
                    existingNote={getDailyNote(date)}
                    onSaved={handleRefresh}
                    label="Add note..."
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Driver rows */}
          {orderedDrivers.map((driver) => {
            const driverLoads = getDriverTruckloads(driver.id)
            const driverScheduleEvents = getDriverEvents(driver.id)

            // Assign vertical lanes: only stack when loads actually overlap in dates
            function assignLanes(items: { startDate: string; endDate: string }[]): number[] {
              const lanes: number[] = new Array(items.length).fill(0)
              // For each item, find the lowest lane that doesn't conflict with already-placed overlapping items
              for (let i = 0; i < items.length; i++) {
                const usedLanes = new Set<number>()
                for (let j = 0; j < i; j++) {
                  // Check if items overlap in date range
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

            const eventLanes = assignLanes(driverScheduleEvents.map((e) => ({ startDate: e.startDate, endDate: e.endDate })))
            const maxEventLane = eventLanes.length > 0 ? Math.max(...eventLanes) + 1 : 0

            const loadLanes = assignLanes(driverLoads.map((l) => ({ startDate: l.startDate, endDate: l.endDate })))
            const maxLoadLane = loadLanes.length > 0 ? Math.max(...loadLanes) + 1 : 0

            const blockHeight = 32
            const blockGap = 4
            const topPad = 6
            const eventRowsHeight = maxEventLane > 0 ? maxEventLane * (blockHeight + blockGap) : 0
            const loadRowsHeight = maxLoadLane > 0 ? maxLoadLane * (blockHeight + blockGap) : 0
            const rowHeight = Math.max(48, topPad + eventRowsHeight + loadRowsHeight + topPad)
            const isDragging = dragDriverId === driver.id
            const isDragOver = dragOverDriverId === driver.id && dragDriverId !== driver.id

            return (
              <div
                key={driver.id}
                className={`flex border-b group transition-all ${
                  isDragging ? 'opacity-40' : ''
                } ${isDragOver ? 'border-t-2 border-t-indigo-400' : ''}`}
                draggable
                onDragStart={(e) => handleDriverDragStart(e, driver.id)}
                onDragOver={(e) => handleDriverRowDragOver(e, driver.id)}
                onDrop={(e) => handleDriverRowDrop(e, driver.id)}
                onDragEnd={handleDragEnd}
              >
                {/* Driver name cell */}
                <div
                  className="w-[140px] min-w-[140px] p-2 border-r sticky left-0 bg-white z-10 cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-1"
                  onClick={() => handleDriverScheduleClick(driver.id)}
                >
                  <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing hover:text-gray-500 transition-colors" />
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: driver.color }} />
                    <span className="text-sm font-medium text-gray-900 truncate">{driver.full_name}</span>
                  </div>
                </div>

                {/* Day columns with overlaid truckload blocks */}
                <div className="relative" style={{ minHeight: `${rowHeight}px`, width: `${dateRange.length * 120}px` }}>
                  {/* Background day grid (click targets) */}
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
                          className={`w-[120px] min-w-[120px] border-r cursor-pointer transition-colors ${
                            hasEvent
                              ? 'bg-purple-50/30'
                              : dayIsToday
                              ? 'bg-indigo-50/20 hover:bg-indigo-50/40'
                              : isSunday || isSaturday
                              ? 'bg-gray-50/30 hover:bg-gray-100/30'
                              : 'hover:bg-gray-50/50'
                          }`}
                          onClick={() => handleCellClick(driver.id, date)}
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
                        className="absolute z-[2] px-1"
                        style={{
                          left: `${pos.left}%`,
                          width: `${pos.width}%`,
                          top: `${topPad + lane * (blockHeight + blockGap)}px`,
                          height: `${blockHeight}px`,
                        }}
                      >
                        <div
                          className="h-full rounded px-2 flex items-center gap-1 bg-purple-100 border border-purple-200 text-purple-700 text-xs font-medium cursor-pointer hover:bg-purple-200 transition-colors truncate"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDriverScheduleClick(driver.id)
                          }}
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

                  {/* Truckload spanning blocks */}
                  {driverLoads.map((truckload, loadIdx) => {
                    const pos = getBlockPosition(truckload)
                    if (!pos) return null

                    const isDraft = truckload.status === 'draft'
                    const isCompleted = truckload.isCompleted || truckload.status === 'completed'
                    const lane = loadLanes[loadIdx]

                    return (
                      <div
                        key={`load-${truckload.id}`}
                        className={`absolute z-[3] px-0.5 ${isDraft ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        style={{
                          left: `${pos.left}%`,
                          width: `${pos.width}%`,
                          top: `${topPad + eventRowsHeight + lane * (blockHeight + blockGap)}px`,
                          height: `${blockHeight}px`,
                        }}
                        draggable={isDraft}
                        onDragStart={isDraft ? (e) => handleTruckloadDragStart(e, truckload.id) : undefined}
                      >
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`h-full rounded-md px-2 flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-md text-xs font-medium truncate border-2 ${
                                  isDraft
                                    ? 'bg-gray-100 border-dashed'
                                    : isCompleted
                                    ? 'bg-green-50'
                                    : 'bg-blue-50'
                                }`}
                                style={{
                                  borderColor: driver.color || '#9ca3af',
                                  color: '#1f2937',
                                }}
                                onClick={(e) => handleTruckloadClick(truckload, e)}
                              >
                                {isDraft ? (
                                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 border-amber-300 flex-shrink-0">
                                    Draft
                                  </Badge>
                                ) : isCompleted ? (
                                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-green-100 text-green-700 border-green-300 flex-shrink-0">
                                    Done
                                  </Badge>
                                ) : (
                                  <Truck className="h-3 w-3 flex-shrink-0" />
                                )}
                                {truckload.description && (
                                  <span className="truncate">{truckload.description}</span>
                                )}
                                {!isDraft && (
                                  <button
                                    className="ml-auto flex-shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
                                    title="Open in Trucking page"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      router.push(`/dashboard/trucking/${truckload.id}`)
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold">{truckload.description || `Truckload #${truckload.id}`}</p>
                                <p className="text-xs text-muted-foreground">
                                  {truckload.startDate}{truckload.startDate !== truckload.endDate ? ` → ${truckload.endDate}` : ''}
                                  {' · '}{driver.full_name}
                                  {isDraft ? ' · Draft' : isCompleted ? ' · Completed' : ' · Active'}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )
                  })}

                  {/* Empty state - show + on hover */}
                  {driverLoads.length === 0 && driverScheduleEvents.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none">
                      <Plus className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Weekly notes footer */}
          <div className="flex bg-amber-50/20">
            <div className="w-[140px] min-w-[140px] p-1.5 text-xs font-medium text-amber-700 border-r sticky left-0 bg-amber-50/20 z-10">
              <div className="flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Weekly Notes
              </div>
            </div>
            <div className="flex">
              {weekGroups.map((group, groupIndex) => (
                <div
                  key={`weekly-${groupIndex}`}
                  className="border-r p-1"
                  style={{ width: `${group.dates.length * 120}px` }}
                >
                  <WeeklyNoteEditor
                    noteType="weekly"
                    noteDate={format(group.weekStart, 'yyyy-MM-dd')}
                    existingNote={getWeeklyNote(group.weekStart)}
                    onSaved={handleRefresh}
                    label={`Week of ${format(group.weekStart, 'MMM d')} notes...`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border-2 border-dashed border-gray-400 bg-gray-100" />
          <span>Draft</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border-2 border-gray-400 bg-blue-50" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border-2 border-gray-400 bg-green-50" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border border-purple-200 bg-purple-100" />
          <span>Schedule Event</span>
        </div>
        <div className="ml-auto text-gray-400">
          Click any cell to create a draft. Click a truckload to edit. Drag driver rows to reorder.
        </div>
      </div>

      {/* Dialogs */}
      <CreateDraftDialog
        isOpen={isCreateDraftOpen}
        onClose={() => setIsCreateDraftOpen(false)}
        onCreated={handleRefresh}
        drivers={drivers}
        defaultDriverId={createDefaultDriverId}
        defaultDate={createDefaultDate}
      />

      <EditPlannerTruckloadDialog
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false)
          setEditTruckload(null)
        }}
        onUpdated={handleRefresh}
        truckload={editTruckload}
        drivers={drivers}
      />

      <DriverScheduleDialog
        isOpen={isScheduleOpen}
        onClose={() => {
          setIsScheduleOpen(false)
          setScheduleDefaultDriverId(null)
        }}
        onUpdated={handleRefresh}
        drivers={drivers}
        events={driverEvents}
        defaultDriverId={scheduleDefaultDriverId}
      />

      <RecurringDraftDialog
        isOpen={isRecurringDraftOpen}
        onClose={() => setIsRecurringDraftOpen(false)}
        onCreated={handleRefresh}
        drivers={drivers}
      />

      <RecurringNoteDialog
        isOpen={isRecurringNoteOpen}
        onClose={() => setIsRecurringNoteOpen(false)}
        onCreated={handleRefresh}
      />
    </div>
  )
}
