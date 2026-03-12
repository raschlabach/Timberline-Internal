'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CalendarRange, ChevronLeft, ChevronRight, AlertTriangle,
  Zap, Plus, ArrowLeft, Box, CheckCircle2, Users
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Order {
  id: number
  order_number: string
  po_number: string | null
  order_date: string
  due_date: string | null
  status: string
  is_rush: boolean
  total_price: number | null
  customer_id: number | null
  customer_name: string | null
  item_count: number
}

interface Customer {
  id: number
  customer_name: string
}

interface CabinetOrder {
  id: number
  file_name: string
  po_numbers: string[]
  due_date: string | null
  is_done: boolean
  sheet_count: number
  special_count: number
  created_at: string
  updated_at: string
}

interface CustomerColor {
  customer_id: number
  customer_name: string
  calendar_color: string | null
}

const CABINET_COLOR = '#059669'

const DEFAULT_PALETTE = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
]

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  ordered: { label: 'Ordered', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  in_production: { label: 'In Production', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  complete: { label: 'Complete', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  shipped: { label: 'Shipped', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  invoiced: { label: 'Invoiced', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MONTH_ABBR: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function parseCabinetDueDate(dueDate: string | null, createdAt: string): string | null {
  if (!dueDate) return null
  const match = dueDate.match(/^(\d{1,2})-([A-Za-z]{3})$/)
  if (match) {
    const day = parseInt(match[1])
    const monthIdx = MONTH_ABBR[match[2].toLowerCase()]
    if (monthIdx !== undefined && day >= 1 && day <= 31) {
      const year = new Date(createdAt).getFullYear()
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const d = new Date(dueDate)
  if (!isNaN(d.getTime())) {
    return formatDate(d)
  }
  return null
}

export default function OrderCalendarPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerColors, setCustomerColors] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [filterCustomer, setFilterCustomer] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [cabinetOrders, setCabinetOrders] = useState<CabinetOrder[]>([])

  const now = new Date()
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())

  const fetchOrders = useCallback(async () => {
    if (!session) return
    setIsLoading(true)
    try {
      const startDate = formatDate(new Date(currentYear, currentMonth, 1))
      const endDate = formatDate(new Date(currentYear, currentMonth + 1, 0))

      const params = new URLSearchParams({ limit: '200', date_from: startDate, date_to: endDate })
      if (filterCustomer !== 'all') params.set('customer_id', filterCustomer)
      if (filterStatus !== 'all') params.set('status', filterStatus)

      const res = await fetch(`/api/rnr/orders?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setIsLoading(false)
    }
  }, [session, currentYear, currentMonth, filterCustomer, filterStatus])

  const fetchCustomers = useCallback(async () => {
    try {
      const [partsRes, settingsRes] = await Promise.all([
        fetch('/api/rnr/parts?limit=1'),
        fetch('/api/rnr/customer-settings'),
      ])
      if (partsRes.ok) {
        const data = await partsRes.json()
        if (data.filters?.customers) setCustomers(data.filters.customers)
      }
      if (settingsRes.ok) {
        const settings: CustomerColor[] = await settingsRes.json()
        const colorMap: Record<number, string> = {}
        for (const s of settings) {
          colorMap[s.customer_id] = s.calendar_color || DEFAULT_PALETTE[s.customer_id % DEFAULT_PALETTE.length]
        }
        setCustomerColors(colorMap)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchCabinetOrders = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetch('/api/lumber/cabinet/orders')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: CabinetOrder[] = await res.json()
      setCabinetOrders(data)
    } catch { /* cabinet orders are supplementary */ }
  }, [session])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { fetchCabinetOrders() }, [fetchCabinetOrders])

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  function goToToday() {
    setCurrentYear(now.getFullYear())
    setCurrentMonth(now.getMonth())
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const todayStr = formatDate(now)

  const ordersByDueDate: Record<string, Order[]> = {}
  const ordersByOrderDate: Record<string, Order[]> = {}
  for (const o of orders) {
    if (o.due_date) {
      const key = o.due_date.substring(0, 10)
      if (!ordersByDueDate[key]) ordersByDueDate[key] = []
      ordersByDueDate[key].push(o)
    }
    if (o.order_date) {
      const key = o.order_date.substring(0, 10)
      if (!ordersByOrderDate[key]) ordersByOrderDate[key] = []
      ordersByOrderDate[key].push(o)
    }
  }

  const showRnr = filterSource !== 'cabinet'
  const showCabinet = filterSource !== 'rnr'

  const cabinetByDueDate: Record<string, CabinetOrder[]> = {}
  if (showCabinet) {
    for (const co of cabinetOrders) {
      const parsed = parseCabinetDueDate(co.due_date, co.created_at)
      if (parsed) {
        if (!cabinetByDueDate[parsed]) cabinetByDueDate[parsed] = []
        cabinetByDueDate[parsed].push(co)
      }
    }
  }

  const cabinetThisMonth = cabinetOrders.filter(co => {
    const parsed = parseCabinetDueDate(co.due_date, co.created_at)
    if (!parsed) return false
    const [y, m] = parsed.split('-').map(Number)
    return y === currentYear && m === currentMonth + 1
  })

  const calendarDays: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d)
  while (calendarDays.length % 7 !== 0) calendarDays.push(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <CalendarRange className="h-7 w-7 text-amber-600" />
            Order Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Orders shown by due date (colored) and order date (gray dot)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/rnr-office/orders/by-customer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Users size={14} />By Customer
            </Button>
          </Link>
          <Link href="/dashboard/rnr-office/orders">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft size={14} />List View
            </Button>
          </Link>
          <Link href="/dashboard/rnr-office/orders/new">
            <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700">
              <Plus size={14} />New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[180px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs text-amber-600 ml-1">
            Today
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="rnr">R&R Only</SelectItem>
              <SelectItem value="cabinet">Nature&apos;s Blend Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCustomer} onValueChange={setFilterCustomer}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.customer_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1 flex-wrap">
        <span className="font-medium text-gray-600">Status dots:</span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ))}
        <span className="ml-2 flex items-center gap-1.5">
          <Zap size={11} className="text-red-500" />Rush
        </span>
        <span className="text-gray-400 ml-1">| Pill color = customer</span>
        <span className="ml-2 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CABINET_COLOR }} />
          Nature&apos;s Blend
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 bg-gray-50">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="min-h-[130px] bg-gray-50/50 border-b border-r border-gray-100" />
            }

            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const dueOrders = showRnr ? (ordersByDueDate[dateStr] || []) : []
            const orderedOrders = showRnr ? (ordersByOrderDate[dateStr] || []) : []
            const cabDue = cabinetByDueDate[dateStr] || []
            const isPast = dateStr < todayStr
            const hasOverdue = dueOrders.some(o => isPast && o.status !== 'complete' && o.status !== 'shipped' && o.status !== 'invoiced')

            const maxShow = 10
            const rnrToShow = dueOrders.slice(0, maxShow)
            const cabSlotsLeft = maxShow - rnrToShow.length
            const cabToShow = cabDue.slice(0, Math.max(0, cabSlotsLeft))
            const totalCount = dueOrders.length + cabDue.length
            const shownCount = rnrToShow.length + cabToShow.length
            const overflow = totalCount - shownCount

            return (
              <div
                key={dateStr}
                className={`min-h-[130px] border-b border-r border-gray-100 p-1 transition-colors ${
                  isToday ? 'bg-amber-50/60 ring-1 ring-inset ring-amber-300' : ''
                } ${hasOverdue ? 'bg-red-50/40' : ''}`}
              >
                <div className="flex items-center justify-between px-1">
                  <span className={`text-xs font-medium ${
                    isToday ? 'bg-amber-600 text-white w-5 h-5 rounded-full flex items-center justify-center' :
                    isPast ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    {day}
                  </span>
                  {orderedOrders.length > 0 && (
                    <span className="text-[10px] text-gray-400" title={`${orderedOrders.length} ordered on this date`}>
                      {orderedOrders.length} placed
                    </span>
                  )}
                </div>

                <div className="mt-1 space-y-0.5">
                  {rnrToShow.map(order => {
                    const cfg = STATUS_CONFIG[order.status] || { label: 'Unknown', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
                    const custColor = order.customer_id ? customerColors[order.customer_id] : null
                    const useCustomerColor = !!custColor

                    return (
                      <Link
                        key={`rnr-${order.id}`}
                        href={`/dashboard/rnr-office/orders/${order.id}`}
                        className={`block px-1.5 py-0.5 rounded text-[10px] leading-tight truncate hover:opacity-80 transition-opacity ${
                          useCustomerColor ? 'text-white' : `${cfg.bg} ${cfg.text}`
                        }`}
                        style={useCustomerColor ? { backgroundColor: custColor } : undefined}
                        title={`${order.order_number} — ${order.customer_name || 'Unknown'} — ${cfg.label} — ${order.item_count} items — $${order.total_price?.toLocaleString() || '0'}`}
                      >
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} title={cfg.label} />
                          {order.is_rush && <Zap size={9} className="text-red-300 shrink-0" />}
                          {hasOverdue && isPast && order.status !== 'complete' && order.status !== 'shipped' && order.status !== 'invoiced' && (
                            <AlertTriangle size={9} className="text-red-300 shrink-0" />
                          )}
                          <span className="truncate font-medium">{order.customer_name || order.order_number}</span>
                          <span className="text-[9px] opacity-70 shrink-0">{order.item_count}pcs</span>
                        </span>
                      </Link>
                    )
                  })}
                  {cabToShow.map(co => (
                    <Link
                      key={`cab-${co.id}`}
                      href={`/dashboard/lumber/cabinet/${co.id}`}
                      className="block px-1.5 py-0.5 rounded text-[10px] leading-tight truncate hover:opacity-80 transition-opacity text-white"
                      style={{ backgroundColor: CABINET_COLOR }}
                      title={`Nature's Blend — ${co.po_numbers.join(', ') || co.file_name} — ${co.is_done ? 'Done' : 'In Progress'} — ${co.sheet_count} tabs`}
                    >
                      <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${co.is_done ? 'bg-green-300' : 'bg-white/60'}`} />
                        <Box size={8} className="shrink-0 text-emerald-200" />
                        <span className="truncate font-medium">
                          {co.po_numbers.length > 0 ? co.po_numbers[0] : 'NB'}
                        </span>
                        <span className="text-[9px] opacity-70 shrink-0">{co.sheet_count}tabs</span>
                      </span>
                    </Link>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[10px] text-gray-400 pl-1.5">+{overflow} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-6 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = orders.filter(o => o.status === key).length
          return (
            <div key={key} className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                <span className="text-xs font-medium text-gray-600">{cfg.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{count}</div>
            </div>
          )
        })}
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CABINET_COLOR }} />
            <span className="text-xs font-medium text-gray-600">Nature&apos;s Blend</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-2xl font-bold text-gray-900">{cabinetThisMonth.length}</div>
            {cabinetThisMonth.filter(co => co.is_done).length > 0 && (
              <span className="text-xs text-green-600 flex items-center gap-0.5">
                <CheckCircle2 size={11} />
                {cabinetThisMonth.filter(co => co.is_done).length} done
              </span>
            )}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-sm text-gray-400 py-4">Loading orders...</div>
      )}
    </div>
  )
}
