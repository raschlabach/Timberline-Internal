'use client'

import { useState, useMemo } from 'react'
import { useCharcoalHistory } from '@/components/charcoal/use-charcoal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  getYear,
  getMonth,
} from 'date-fns'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function heatmapClass(count: number): string {
  if (count === 0) return ''
  if (count <= 2) return 'bg-green-50'
  if (count <= 5) return 'bg-green-100'
  if (count <= 10) return 'bg-green-150'
  return 'bg-green-200'
}

export default function CharcoalHistoryPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)

  const from = format(monthStart, 'yyyy-MM-dd')
  const to = format(monthEnd, 'yyyy-MM-dd')

  const { data, isLoading } = useCharcoalHistory(from, to)

  const dayMap = useMemo(() => {
    const map = new Map<string, { bagged_std: number; bagged_wc: number; ordered_std: number; ordered_wc: number }>()
    if (data?.byDay) {
      for (const d of data.byDay) {
        map.set(d.date, d)
      }
    }
    return map
  }, [data])

  const calendarWeeks = useMemo(() => {
    const start = startOfWeek(monthStart)
    const end = endOfWeek(monthEnd)
    const weeks: Date[][] = []
    let current = start
    while (current <= end) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(current)
        current = addDays(current, 1)
      }
      weeks.push(week)
    }
    return weeks
  }, [monthStart, monthEnd])

  const monthTotals = data?.monthTotals
  const ytdTotals = data?.ytdTotals
  const totalBagged = (monthTotals?.baggedStd ?? 0) + (monthTotals?.baggedWc ?? 0)
  const totalOrdered = (monthTotals?.orderedStd ?? 0) + (monthTotals?.orderedWc ?? 0)

  const jumpMonths: { label: string; value: string }[] = []
  const now = new Date()
  for (let i = -12; i <= 0; i++) {
    const d = addMonths(now, i)
    jumpMonths.push({
      label: format(d, 'MMMM yyyy'),
      value: `${getYear(d)}-${String(getMonth(d)).padStart(2, '0')}`,
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <CalendarDays size={24} />
        Charcoal History
      </h1>

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <span className="text-lg font-semibold min-w-[180px] text-center">
          {format(currentDate, 'MMMM yyyy')}
        </span>
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
          <ChevronRight size={16} />
        </Button>
        <Select
          value={`${getYear(currentDate)}-${String(getMonth(currentDate)).padStart(2, '0')}`}
          onValueChange={(v) => {
            const [y, m] = v.split('-')
            setCurrentDate(new Date(parseInt(y), parseInt(m), 1))
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {jumpMonths.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-[500px]" />
      ) : (
        <>
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span className="font-semibold">{format(currentDate, 'MMMM yyyy')}</span>
            {' — '}
            <span className="text-green-700 font-medium">{totalBagged} bagged</span>
            {' ('}
            {monthTotals?.baggedStd ?? 0} std + {monthTotals?.baggedWc ?? 0} WC
            {') | '}
            <span className="text-amber-700 font-medium">{totalOrdered} ordered</span>
            {' ('}
            {monthTotals?.orderedStd ?? 0} std + {monthTotals?.orderedWc ?? 0} WC
            {')'}
          </div>

          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {DAY_LABELS.map(d => (
                      <th key={d} className="text-xs font-medium text-muted-foreground p-1 text-center w-[14.28%]">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarWeeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((day, di) => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const isInMonth = isSameMonth(day, currentDate)
                        const dayData = dayMap.get(dateStr)
                        const bagged = (dayData?.bagged_std ?? 0) + (dayData?.bagged_wc ?? 0)
                        const ordered = (dayData?.ordered_std ?? 0) + (dayData?.ordered_wc ?? 0)

                        return (
                          <td key={di} className={`border p-1 align-top h-20 ${isInMonth ? heatmapClass(bagged) : 'bg-gray-50/50'}`}>
                            {isInMonth && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="h-full cursor-default">
                                      <div className="text-xs font-medium text-muted-foreground">{format(day, 'd')}</div>
                                      <div className="mt-1 space-y-0.5">
                                        {bagged > 0 && (
                                          <div className="text-[10px] text-green-700 font-medium leading-tight">
                                            {bagged} bagged
                                          </div>
                                        )}
                                        {ordered > 0 && (
                                          <div className="text-[10px] text-amber-700 font-medium leading-tight">
                                            {ordered} ordered
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">
                                    <div className="space-y-1">
                                      <div className="font-medium">{format(day, 'EEEE, MMM d')}</div>
                                      <div>Bagged: {dayData?.bagged_std ?? 0} std + {dayData?.bagged_wc ?? 0} WC = {bagged}</div>
                                      <div>Ordered: {dayData?.ordered_std ?? 0} std + {dayData?.ordered_wc ?? 0} WC = {ordered}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {ytdTotals && (
            <Card>
              <CardContent className="py-4">
                <p className="text-sm font-medium text-center">
                  {getYear(currentDate)} YTD — <span className="text-green-700">{ytdTotals.bagged.toLocaleString()} bagged</span> | <span className="text-amber-700">{ytdTotals.ordered.toLocaleString()} ordered</span>
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
