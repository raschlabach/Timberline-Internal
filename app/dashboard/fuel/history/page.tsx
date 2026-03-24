"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Fuel, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

interface FillupRow {
  id: number
  fillup_date: string
  truck_name: string
  driver_name: string | null
  mileage: number
  gallons: string | number
  notes: string | null
}

interface RefillRow {
  id: number
  refill_date: string
  gallons: string | number
  notes: string | null
  created_by_name: string | null
}

interface HistoryItem {
  id: string
  date: string
  type: 'refill' | 'fillup'
  gallons: number
  description: string
  detail: string
  notes: string | null
}

const PAGE_SIZE = 25

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function FuelHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [fillupsRes, refillsRes] = await Promise.all([
        fetch(`/api/fuel/fillups?limit=1000&offset=0`),
        fetch('/api/fuel/refills'),
      ])

      const fillupsData = await fillupsRes.json()
      const refillsData = await refillsRes.json()

      const fillupItems: HistoryItem[] = (fillupsData.fillups || []).map((f: FillupRow) => ({
        id: `fillup-${f.id}`,
        date: f.fillup_date,
        type: 'fillup' as const,
        gallons: parseFloat(String(f.gallons)) || 0,
        description: `${f.driver_name || 'Unknown'} filled ${f.truck_name}`,
        detail: `Mileage: ${Number(f.mileage).toLocaleString()}`,
        notes: f.notes,
      }))

      const refillItems: HistoryItem[] = (refillsData.refills || []).map((r: RefillRow) => ({
        id: `refill-${r.id}`,
        date: r.refill_date,
        type: 'refill' as const,
        gallons: parseFloat(String(r.gallons)) || 0,
        description: `Tank refill${r.created_by_name ? ` by ${r.created_by_name}` : ''}`,
        detail: 'Gas company delivery',
        notes: r.notes,
      }))

      const merged = [...fillupItems, ...refillItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setItems(merged)
      setTotalItems(merged.length)
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPages = Math.ceil(totalItems / PAGE_SIZE)
  const paginatedItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  let runningLevel = 0
  const allItemsWithLevel = items.map((item) => {
    if (item.type === 'refill') {
      runningLevel += item.gallons
    } else {
      runningLevel -= item.gallons
    }
    return { ...item, runningLevel }
  })

  const reverseLevels = [...allItemsWithLevel].reverse()
  const levelMap = new Map<string, number>()
  let cumulative = 0
  for (const item of reverseLevels) {
    if (item.type === 'refill') {
      cumulative += item.gallons
    } else {
      cumulative -= item.gallons
    }
    levelMap.set(item.id, cumulative)
  }

  const pageItemsWithLevel = paginatedItems.map((item) => ({
    ...item,
    tankLevelAfter: levelMap.get(item.id) ?? 0,
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/fuel">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <Fuel className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fuel History</h1>
          <p className="text-sm text-gray-500">{totalItems} total events</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">All Activity</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              Page {page + 1} of {Math.max(1, totalPages)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : pageItemsWithLevel.length === 0 ? (
            <div className="p-8 text-center">
              <Fuel className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No fuel history yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {pageItemsWithLevel.map((item) => {
                const isRefill = item.type === 'refill'
                return (
                  <div key={item.id} className="px-4 md:px-6 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isRefill ? 'bg-green-500' : 'bg-blue-500'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold uppercase tracking-wide ${isRefill ? 'text-green-700' : 'text-blue-700'}`}>
                              {isRefill ? 'Tank Refill' : 'Truck Fill-up'}
                            </span>
                            <span className="text-xs text-gray-400">{formatDateTime(item.date)}</span>
                          </div>
                          <p className="text-sm text-gray-600">{item.description}</p>
                          <p className="text-xs text-gray-400">{item.detail}</p>
                          {item.notes && (
                            <p className="text-xs text-gray-400 italic mt-0.5">{item.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-bold ${isRefill ? 'text-green-700' : 'text-blue-700'}`}>
                          {isRefill ? '+' : '-'}{item.gallons.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-400">
                          Tank: {Math.max(0, item.tankLevelAfter).toFixed(1)} gal
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalItems)} of {totalItems}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
