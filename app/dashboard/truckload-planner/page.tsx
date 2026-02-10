'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval, parseISO, isSameDay } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
} from 'lucide-react'
import { CreateDraftDialog } from '@/components/planner/create-draft-dialog'
import { EditPlannerTruckloadDialog } from '@/components/planner/edit-planner-truckload-dialog'
import { DriverScheduleDialog } from '@/components/planner/driver-schedule-dialog'
import { WeeklyNoteEditor } from '@/components/planner/weekly-note-editor'
import type { PlannerTruckload, PlannerDriver, DriverScheduleEvent, PlannerNote } from '@/types/truckloads'

type ViewMode = 'week' | '2week' | 'month'

export default function TruckloadPlanner() {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('2week')

  // Dialog state
  const [isCreateDraftOpen, setIsCreateDraftOpen] = useState(false)
  const [createDefaultDriverId, setCreateDefaultDriverId] = useState<number | null>(null)
  const [createDefaultDate, setCreateDefaultDate] = useState<string | null>(null)
  const [editTruckload, setEditTruckload] = useState<PlannerTruckload | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [scheduleDefaultDriverId, setScheduleDefaultDriverId] = useState<number | null>(null)

  // Calculate date range based on view mode
  const { weekStart, weekEnd, dateRange } = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }) // Start on Monday
    let end: Date
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

    end = addDays(start, numDays)

    const range: Date[] = []
    for (let i = 0; i <= numDays; i++) {
      range.push(addDays(start, i))
    }

    return {
      weekStart: start,
      weekEnd: end,
      dateRange: range,
    }
  }, [currentDate, viewMode])

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

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['planner-data'] })
  }

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

  // Get truckloads for a specific driver and date
  function getTruckloadsForCell(driverId: number, date: Date): PlannerTruckload[] {
    const dateStr = format(date, 'yyyy-MM-dd')
    return truckloads.filter((t) => {
      if (t.driverId !== driverId) return false
      return t.startDate <= dateStr && t.endDate >= dateStr
    })
  }

  // Get schedule events for a driver on a date
  function getEventsForCell(driverId: number, date: Date): DriverScheduleEvent[] {
    const dateStr = format(date, 'yyyy-MM-dd')
    return driverEvents.filter((e) => {
      if (e.driverId !== driverId) return false
      return e.startDate <= dateStr && e.endDate >= dateStr
    })
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
      if (dayOfWeek === 1 || index === 0) {
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
      <div className="flex items-center justify-between bg-white rounded-lg border px-4 py-2">
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

        <h2 className="text-sm font-semibold text-gray-900">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h2>

        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(['week', '2week', 'month'] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="sm"
              className={`h-7 px-3 text-xs ${
                viewMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'week' ? '1 Week' : mode === '2week' ? '2 Weeks' : '4 Weeks'}
            </Button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border overflow-auto">
        <table className="w-full border-collapse min-w-[900px]">
          {/* Date headers */}
          <thead>
            <tr className="bg-gray-50">
              <th className="border-b border-r p-2 text-left text-xs font-semibold text-gray-600 w-[140px] sticky left-0 bg-gray-50 z-10">
                Driver
              </th>
              {dateRange.map((date) => {
                const dayIsToday = isToday(date)
                const isSunday = date.getDay() === 0
                const isSaturday = date.getDay() === 6

                return (
                  <th
                    key={date.toISOString()}
                    className={`border-b border-r p-1.5 text-center min-w-[100px] ${
                      dayIsToday ? 'bg-indigo-50' : isSunday || isSaturday ? 'bg-gray-100' : ''
                    }`}
                  >
                    <div className="text-xs text-gray-500 font-medium">{format(date, 'EEE')}</div>
                    <div className={`text-sm font-bold ${dayIsToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                      {format(date, 'MMM d')}
                    </div>
                  </th>
                )
              })}
            </tr>

            {/* Daily Notes row */}
            <tr className="bg-amber-50/30">
              <td className="border-b border-r p-1.5 text-xs font-medium text-amber-700 sticky left-0 bg-amber-50/30 z-10">
                <div className="flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  Notes
                </div>
              </td>
              {dateRange.map((date) => (
                <td key={`note-${date.toISOString()}`} className="border-b border-r p-0.5 align-top">
                  <WeeklyNoteEditor
                    noteType="daily"
                    noteDate={format(date, 'yyyy-MM-dd')}
                    existingNote={getDailyNote(date)}
                    onSaved={handleRefresh}
                    label="Add note..."
                  />
                </td>
              ))}
            </tr>
          </thead>

          {/* Driver rows */}
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id} className="group">
                {/* Driver name cell */}
                <td
                  className="border-b border-r p-2 sticky left-0 bg-white z-10 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleDriverScheduleClick(driver.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: driver.color }} />
                    <span className="text-sm font-medium text-gray-900 truncate">{driver.full_name}</span>
                  </div>
                </td>

                {/* Date cells */}
                {dateRange.map((date) => {
                  const cellTruckloads = getTruckloadsForCell(driver.id, date)
                  const cellEvents = getEventsForCell(driver.id, date)
                  const dayIsToday = isToday(date)
                  const isSunday = date.getDay() === 0
                  const isSaturday = date.getDay() === 6
                  const hasEvent = cellEvents.length > 0

                  return (
                    <td
                      key={`${driver.id}-${date.toISOString()}`}
                      className={`border-b border-r p-1 align-top min-h-[60px] cursor-pointer transition-colors ${
                        hasEvent
                          ? 'bg-purple-50/50'
                          : dayIsToday
                          ? 'bg-indigo-50/30 hover:bg-indigo-50/60'
                          : isSunday || isSaturday
                          ? 'bg-gray-50/50 hover:bg-gray-100/50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleCellClick(driver.id, date)}
                    >
                      <div className="space-y-1 min-h-[48px]">
                        {/* Schedule events */}
                        {cellEvents.map((event) => (
                          <div
                            key={event.id}
                            className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 truncate"
                            title={`${event.eventType}: ${event.description || ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDriverScheduleClick(driver.id)
                            }}
                          >
                            {event.eventType === 'vacation' ? 'Vacation' :
                             event.eventType === 'sick' ? 'Sick' :
                             event.eventType === 'unavailable' ? 'Unavailable' : event.description || 'Event'}
                          </div>
                        ))}

                        {/* Truckload cards */}
                        {cellTruckloads.map((truckload) => {
                          const isDraft = truckload.status === 'draft'
                          const isCompleted = truckload.isCompleted || truckload.status === 'completed'

                          return (
                            <div
                              key={truckload.id}
                              className={`text-xs p-1.5 rounded cursor-pointer transition-all hover:shadow-sm ${
                                isDraft
                                  ? 'bg-amber-50 border border-dashed border-amber-300 text-amber-800 hover:bg-amber-100'
                                  : isCompleted
                                  ? 'bg-green-50 border border-green-200 text-green-800 hover:bg-green-100'
                                  : 'bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100'
                              }`}
                              style={{ borderLeftWidth: '3px', borderLeftColor: driver.color }}
                              onClick={(e) => handleTruckloadClick(truckload, e)}
                              title={truckload.description || `Truckload #${truckload.id}`}
                            >
                              <div className="flex items-center gap-1 justify-between">
                                <div className="flex items-center gap-1 min-w-0">
                                  {isDraft ? (
                                    <Badge variant="outline" className="h-3.5 px-1 text-[9px] bg-amber-100 text-amber-700 border-amber-300">
                                      Draft
                                    </Badge>
                                  ) : isCompleted ? (
                                    <Badge variant="outline" className="h-3.5 px-1 text-[9px] bg-green-100 text-green-700 border-green-300">
                                      Done
                                    </Badge>
                                  ) : (
                                    <Truck className="h-3 w-3 flex-shrink-0" />
                                  )}
                                </div>
                                {truckload.billOfLadingNumber && (
                                  <span className="text-[9px] opacity-60 flex-shrink-0">{truckload.billOfLadingNumber}</span>
                                )}
                              </div>
                              {truckload.description && (
                                <p className="mt-0.5 truncate leading-tight opacity-80">{truckload.description}</p>
                              )}
                            </div>
                          )
                        })}

                        {/* Add button on hover for empty cells */}
                        {cellTruckloads.length === 0 && cellEvents.length === 0 && (
                          <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-40 transition-opacity pt-3">
                            <Plus className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>

          {/* Weekly notes footer */}
          <tfoot>
            <tr className="bg-amber-50/20">
              <td className="border-r p-1.5 text-xs font-medium text-amber-700 sticky left-0 bg-amber-50/20 z-10">
                <div className="flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  Weekly Notes
                </div>
              </td>
              {weekGroups.map((group, groupIndex) => (
                <td
                  key={`weekly-${groupIndex}`}
                  colSpan={group.dates.length}
                  className="border-r p-1 align-top"
                >
                  <WeeklyNoteEditor
                    noteType="weekly"
                    noteDate={format(group.weekStart, 'yyyy-MM-dd')}
                    existingNote={getWeeklyNote(group.weekStart)}
                    onSaved={handleRefresh}
                    label={`Week of ${format(group.weekStart, 'MMM d')} notes...`}
                  />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border border-dashed border-amber-300 bg-amber-50" />
          <span>Draft</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border border-blue-200 bg-blue-50" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border border-green-200 bg-green-50" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border border-purple-200 bg-purple-100" />
          <span>Schedule Event</span>
        </div>
        <div className="ml-auto text-gray-400">
          Click any cell to create a draft. Click a truckload card to edit. Click a driver name for schedule.
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
    </div>
  )
}
