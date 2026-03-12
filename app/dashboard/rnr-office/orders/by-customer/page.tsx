'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users, ArrowLeft, CalendarRange, Zap, AlertTriangle,
  Box, CheckCircle2, Clock, Package
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

interface CustomerGroup {
  customerId: number | null
  customerName: string
  color: string
  orders: Order[]
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

const ACTIVE_STATUSES = ['ordered', 'in_production', 'complete']

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
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  return null
}

function formatDisplayDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return due < today
}

export default function OrdersByCustomerPage() {
  const { data: session } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [cabinetOrders, setCabinetOrders] = useState<CabinetOrder[]>([])
  const [customerColors, setCustomerColors] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [sortBy, setSortBy] = useState<string>('due_date')

  const fetchData = useCallback(async () => {
    if (!session) return
    setIsLoading(true)
    try {
      const [ordersRes, cabinetRes, settingsRes] = await Promise.all([
        fetch('/api/rnr/orders?limit=500'),
        fetch('/api/lumber/cabinet/orders'),
        fetch('/api/rnr/customer-settings'),
      ])

      if (ordersRes.ok) {
        const data = await ordersRes.json()
        setOrders(data.orders || [])
      }
      if (cabinetRes.ok) {
        const data: CabinetOrder[] = await cabinetRes.json()
        setCabinetOrders(data)
      }
      if (settingsRes.ok) {
        const settings: CustomerColor[] = await settingsRes.json()
        const colorMap: Record<number, string> = {}
        for (const s of settings) {
          colorMap[s.customer_id] = s.calendar_color || DEFAULT_PALETTE[s.customer_id % DEFAULT_PALETTE.length]
        }
        setCustomerColors(colorMap)
      }
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setIsLoading(false)
    }
  }, [session])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredOrders = orders.filter(o => {
    if (filterStatus === 'active') return ACTIVE_STATUSES.includes(o.status)
    if (filterStatus === 'all') return true
    return o.status === filterStatus
  })

  const filteredCabinet = cabinetOrders.filter(co => {
    if (filterStatus === 'active') return !co.is_done
    if (filterStatus === 'all') return true
    if (filterStatus === 'complete') return co.is_done
    return !co.is_done
  })

  const groupMap = new Map<string, CustomerGroup>()
  for (const o of filteredOrders) {
    const key = o.customer_id ? String(o.customer_id) : `unknown-${o.order_number}`
    if (!groupMap.has(key)) {
      const color = o.customer_id
        ? customerColors[o.customer_id] || DEFAULT_PALETTE[o.customer_id % DEFAULT_PALETTE.length]
        : '#6B7280'
      groupMap.set(key, {
        customerId: o.customer_id,
        customerName: o.customer_name || 'Unknown Customer',
        color,
        orders: [],
      })
    }
    groupMap.get(key)!.orders.push(o)
  }

  const customerGroups = Array.from(groupMap.values())

  for (const group of customerGroups) {
    group.orders.sort((a, b) => {
      if (sortBy === 'due_date') {
        const aDue = a.due_date || '9999-12-31'
        const bDue = b.due_date || '9999-12-31'
        return aDue.localeCompare(bDue)
      }
      return a.order_number.localeCompare(b.order_number)
    })
  }

  customerGroups.sort((a, b) => {
    if (sortBy === 'due_date') {
      const aEarliest = a.orders[0]?.due_date || '9999-12-31'
      const bEarliest = b.orders[0]?.due_date || '9999-12-31'
      return aEarliest.localeCompare(bEarliest)
    }
    return a.customerName.localeCompare(b.customerName)
  })

  const hasActiveCabinet = filteredCabinet.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="h-7 w-7 text-amber-600" />
            Orders by Customer
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Current orders grouped by customer with due dates and PO numbers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/rnr-office/orders/calendar">
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarRange size={14} />Calendar
            </Button>
          </Link>
          <Link href="/dashboard/rnr-office/orders">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft size={14} />List View
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{customerGroups.length}</span> customers
          {hasActiveCabinet && <> + <span className="font-semibold text-gray-900">Nature&apos;s Blend</span></>}
          {' '}&middot;{' '}
          <span className="font-semibold text-gray-900">
            {filteredOrders.length + filteredCabinet.length}
          </span> orders
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active Orders</SelectItem>
              <SelectItem value="all">All Orders</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">Sort by Due Date</SelectItem>
              <SelectItem value="name">Sort by Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-gray-400 py-12">Loading orders...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customerGroups.map(group => (
            <div
              key={group.customerId ?? group.customerName}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: group.color + '18', borderBottom: `2px solid ${group.color}` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <h3 className="font-semibold text-gray-900 truncate">{group.customerName}</h3>
                </div>
                <span className="text-xs font-medium text-gray-500 shrink-0 ml-2">
                  {group.orders.length} order{group.orders.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {group.orders.map(order => {
                  const cfg = STATUS_CONFIG[order.status] || { label: order.status, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
                  const overdue = isOverdue(order.due_date) && ACTIVE_STATUSES.includes(order.status)

                  return (
                    <Link
                      key={order.id}
                      href={`/dashboard/rnr-office/orders/${order.id}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-sm font-medium text-gray-800 truncate group-hover:text-amber-700">
                          {order.po_number || order.order_number}
                        </span>
                        {order.is_rush && <Zap size={12} className="text-red-500 shrink-0" />}
                        {overdue && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        <span className={`text-xs whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          {formatDisplayDate(order.due_date?.substring(0, 10) ?? null)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {hasActiveCabinet && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: CABINET_COLOR + '18', borderBottom: `2px solid ${CABINET_COLOR}` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: CABINET_COLOR }}
                  />
                  <h3 className="font-semibold text-gray-900 truncate">Nature&apos;s Blend</h3>
                </div>
                <span className="text-xs font-medium text-gray-500 shrink-0 ml-2">
                  {filteredCabinet.length} order{filteredCabinet.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {filteredCabinet
                  .sort((a, b) => {
                    const aDate = parseCabinetDueDate(a.due_date, a.created_at) || '9999-12-31'
                    const bDate = parseCabinetDueDate(b.due_date, b.created_at) || '9999-12-31'
                    return aDate.localeCompare(bDate)
                  })
                  .map(co => {
                    const parsed = parseCabinetDueDate(co.due_date, co.created_at)
                    const overdue = parsed ? isOverdue(parsed) && !co.is_done : false

                    return (
                      <Link
                        key={co.id}
                        href={`/dashboard/lumber/cabinet/${co.id}`}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Box size={14} className="text-emerald-600 shrink-0" />
                          <span className="text-sm font-medium text-gray-800 truncate group-hover:text-emerald-700">
                            {co.po_numbers.length > 0
                              ? co.po_numbers.join(', ')
                              : co.file_name}
                          </span>
                          {overdue && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {co.is_done ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                              <CheckCircle2 size={10} />Done
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                              <Clock size={10} />In Progress
                            </span>
                          )}
                          <span className={`text-xs whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            {formatDisplayDate(parsed)}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
              </div>
            </div>
          )}

          {customerGroups.length === 0 && !hasActiveCabinet && (
            <div className="col-span-full text-center py-16">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No orders found</p>
              <p className="text-sm text-gray-400 mt-1">Try changing the filter to see more orders</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
