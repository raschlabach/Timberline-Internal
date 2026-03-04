'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Plus, ChevronLeft, ChevronRight, X, ClipboardList, AlertTriangle } from 'lucide-react'
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
  notes: string | null
  total_price: number | null
  customer_id: number | null
  customer_name: string | null
  item_count: number
}

interface Customer {
  id: number
  customer_name: string
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ordered: { label: 'Ordered', bg: 'bg-blue-100', text: 'text-blue-700' },
  in_production: { label: 'In Production', bg: 'bg-amber-100', text: 'text-amber-700' },
  complete: { label: 'Complete', bg: 'bg-green-100', text: 'text-green-700' },
  shipped: { label: 'Shipped', bg: 'bg-purple-100', text: 'text-purple-700' },
  invoiced: { label: 'Invoiced', bg: 'bg-gray-100', text: 'text-gray-600' },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export default function OrdersListPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [filterCustomer, setFilterCustomer] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, filterCustomer, filterStatus, dateFrom, dateTo])

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterCustomer !== 'all') params.set('customer_id', filterCustomer)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res = await fetch(`/api/rnr/orders?${params}`)
      const data = await res.json()
      if (res.ok) {
        setOrders(data.orders)
        setTotalPages(data.totalPages)
        setTotalOrders(data.total)
      }
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }, [page, debouncedSearch, filterCustomer, filterStatus, dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch('/api/customers')
        if (res.ok) {
          const data = await res.json()
          setCustomers(Array.isArray(data) ? data : data.customers || [])
        }
      } catch { /* ignore */ }
    }
    fetchCustomers()
  }, [])

  const hasActiveFilters = filterCustomer !== 'all' || filterStatus !== 'all' || dateFrom !== '' || dateTo !== '' || debouncedSearch !== ''

  function clearFilters() {
    setSearch(''); setFilterCustomer('all'); setFilterStatus('all'); setDateFrom(''); setDateTo('')
  }

  function formatDate(d: string | null): string {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function isDueSoon(dueDate: string | null): boolean {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const now = new Date()
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 3 && diff >= 0
  }

  function isOverdue(dueDate: string | null): boolean {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-amber-600" />
            Orders
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalOrders.toLocaleString()} order{totalOrders !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/dashboard/rnr-office/orders/new">
          <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus size={16} />New Order
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search order #, PO #, customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterCustomer} onValueChange={setFilterCustomer}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Customer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.customer_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="in_production">In Production</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[150px]" placeholder="From" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[150px]" placeholder="To" />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-gray-500"><X size={14} />Clear</Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Order #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">PO #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Order Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Due Date</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Items</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Loading orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  {hasActiveFilters ? 'No orders match your filters' : 'No orders yet. Create your first order to get started.'}
                </td></tr>
              ) : orders.map(order => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/dashboard/rnr-office/orders/${order.id}`)}
                  className="border-b border-gray-100 hover:bg-amber-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-900">
                    <span className="flex items-center gap-1.5">
                      {order.order_number}
                      {order.is_rush && <AlertTriangle size={13} className="text-red-500" />}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate">{order.customer_name || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{order.po_number || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{formatDate(order.order_date)}</td>
                  <td className="px-4 py-2.5">
                    <span className={
                      isOverdue(order.due_date) && !['complete', 'shipped', 'invoiced'].includes(order.status)
                        ? 'text-red-600 font-medium'
                        : isDueSoon(order.due_date) && !['complete', 'shipped', 'invoiced'].includes(order.status)
                        ? 'text-amber-600 font-medium'
                        : 'text-gray-600'
                    }>
                      {formatDate(order.due_date)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{order.item_count}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-700 font-medium">
                    {order.total_price ? `$${Number(order.total_price).toFixed(2)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} ({totalOrders.toLocaleString()} orders)</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={16} /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={16} /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
