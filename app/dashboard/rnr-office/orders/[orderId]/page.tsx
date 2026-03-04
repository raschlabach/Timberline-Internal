'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Pencil, Save, Loader2, AlertTriangle, Printer,
  Play, CheckCircle, Truck, FileText, Trash2, ClipboardList, X
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface OrderItem {
  id: number
  part_id: number | null
  rnr_part_number: string | null
  customer_part_number: string | null
  description: string | null
  quantity_ordered: number
  quantity_final: number | null
  price_per_unit: number | null
  price_unit: string | null
  line_total: number | null
  is_new_part: boolean
  notes: string | null
  species_name: string | null
  product_type_name: string | null
  profile_name: string | null
  thickness: number | null
  width: number | null
  length: number | null
  board_feet: number | null
  lineal_feet: number | null
}

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
  source: string | null
  customer_id: number | null
  customer_name: string | null
  created_at: string
  updated_at: string
  items: OrderItem[]
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ordered: { label: 'Ordered', bg: 'bg-blue-100', text: 'text-blue-700' },
  in_production: { label: 'In Production', bg: 'bg-amber-100', text: 'text-amber-700' },
  complete: { label: 'Complete', bg: 'bg-green-100', text: 'text-green-700' },
  shipped: { label: 'Shipped', bg: 'bg-purple-100', text: 'text-purple-700' },
  invoiced: { label: 'Invoiced', bg: 'bg-gray-100', text: 'text-gray-600' },
}

const STATUS_FLOW: Record<string, { next: string; action: string; icon: typeof Play }> = {
  ordered: { next: 'in_production', action: 'Start Production', icon: Play },
  in_production: { next: 'complete', action: 'Mark Complete', icon: CheckCircle },
  complete: { next: 'shipped', action: 'Mark Shipped', icon: Truck },
  shipped: { next: 'invoiced', action: 'Mark Invoiced', icon: FileText },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export default function OrderDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const routeParams = useParams()
  const orderId = routeParams?.orderId as string

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [isEditingQty, setIsEditingQty] = useState(false)
  const [finalQtys, setFinalQtys] = useState<Record<number, string>>({})

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

  async function fetchOrder() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data)
        const qtys: Record<number, string> = {}
        for (const item of data.items) {
          qtys[item.id] = item.quantity_final?.toString() || ''
        }
        setFinalQtys(qtys)
      } else {
        toast.error('Order not found')
        router.push('/dashboard/rnr-office/orders')
      }
    } catch { toast.error('Failed to load order') }
    finally { setIsLoading(false) }
  }

  useEffect(() => { fetchOrder() }, [orderId])

  async function updateStatus(newStatus: string) {
    if (!order) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
        fetchOrder()
      } else {
        toast.error('Failed to update status')
      }
    } catch { toast.error('Failed to update status') }
    finally { setIsSaving(false) }
  }

  async function saveFinalQtys() {
    if (!order) return
    setIsSaving(true)
    try {
      const updatedItems = order.items.map(item => ({
        part_id: item.part_id,
        customer_part_number: item.customer_part_number,
        description: item.description,
        quantity_ordered: item.quantity_ordered,
        quantity_final: finalQtys[item.id] ? parseInt(finalQtys[item.id]) : null,
        price_per_unit: item.price_per_unit,
        price_unit: item.price_unit,
        line_total: item.line_total,
        is_new_part: item.is_new_part,
        notes: item.notes,
      }))

      const res = await fetch(`/api/rnr/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems }),
      })
      if (res.ok) {
        toast.success('Final quantities saved')
        setIsEditingQty(false)
        fetchOrder()
      } else {
        toast.error('Failed to save quantities')
      }
    } catch { toast.error('Failed to save') }
    finally { setIsSaving(false) }
  }

  async function deleteOrder() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Order deleted')
        router.push('/dashboard/rnr-office/orders')
      } else {
        toast.error('Failed to delete order')
      }
    } catch { toast.error('Failed to delete') }
    finally { setIsDeleting(false) }
  }

  function handlePrint() {
    window.print()
  }

  function formatDate(d: string | null): string {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (!order) return null

  const flow = STATUS_FLOW[order.status]

  return (
    <>
      <div className="space-y-6 print:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/rnr-office/orders">
              <Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <ClipboardList className="h-7 w-7 text-amber-600" />
                {order.order_number}
                {order.is_rush && (
                  <span className="flex items-center gap-1 text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                    <AlertTriangle size={13} />RUSH
                  </span>
                )}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer size={14} />Print
            </Button>
            {order.status === 'ordered' && (
              <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 size={14} />Delete
              </Button>
            )}
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block">
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
            <h1 className="text-xl font-bold">RNR Manufacturing - Order</h1>
            <p className="text-lg font-semibold mt-1">{order.order_number}</p>
          </div>
        </div>

        {/* Status + Actions Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between print:border-0 print:shadow-none print:p-0">
          <div className="flex items-center gap-4">
            <StatusBadge status={order.status} />
            <div className="text-sm text-gray-500">
              Created {formatDate(order.created_at)}
              {order.updated_at !== order.created_at && ` · Updated ${formatDate(order.updated_at)}`}
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {flow && (
              <Button
                className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                size="sm"
                onClick={() => updateStatus(flow.next)}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <flow.icon size={14} />}
                {flow.action}
              </Button>
            )}
          </div>
        </div>

        {/* Order Info Grid */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm print:border-0 print:shadow-none print:p-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</label>
              <p className="text-sm font-medium">{order.customer_name || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">PO #</label>
              <p className="text-sm font-mono">{order.po_number || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Order Date</label>
              <p className="text-sm">{formatDate(order.order_date)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</label>
              <p className="text-sm font-medium">{formatDate(order.due_date)}</p>
            </div>
          </div>
          {order.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</label>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border print:border-gray-400">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between print:bg-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Line Items ({order.items.length})
            </h2>
            {!isEditingQty && ['in_production', 'complete'].includes(order.status) && (
              <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={() => setIsEditingQty(true)}>
                <Pencil size={14} />Edit Final Qty
              </Button>
            )}
            {isEditingQty && (
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={() => setIsEditingQty(false)} disabled={isSaving}><X size={14} /></Button>
                <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm" onClick={saveFinalQtys} disabled={isSaving}>
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save
                </Button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Part #</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Species</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Qty Ordered</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Qty Final</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Price</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Unit</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-900">
                      <span className="flex items-center gap-1">
                        {item.rnr_part_number || item.customer_part_number || '-'}
                        {item.is_new_part && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">NEW</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate">{item.description || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{item.species_name || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">{item.quantity_ordered}</td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditingQty ? (
                        <Input
                          type="number"
                          value={finalQtys[item.id] || ''}
                          onChange={e => setFinalQtys({ ...finalQtys, [item.id]: e.target.value })}
                          className="w-20 text-right text-xs font-mono ml-auto"
                          placeholder="-"
                        />
                      ) : (
                        <span className={`font-mono text-xs ${item.quantity_final !== null && item.quantity_final !== item.quantity_ordered ? 'text-amber-600 font-semibold' : ''}`}>
                          {item.quantity_final !== null ? item.quantity_final : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">{item.price_per_unit ? `$${Number(item.price_per_unit).toFixed(4)}` : '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{item.price_unit || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">{item.line_total ? `$${Number(item.line_total).toFixed(2)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={7} className="px-4 py-3 text-right font-semibold text-gray-700">Order Total</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                    {order.total_price ? `$${Number(order.total_price).toFixed(2)}` : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Order</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete order <span className="font-mono font-semibold">{order.order_number}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" className="gap-1.5" onClick={deleteOrder} disabled={isDeleting}>
              {isDeleting ? <><Loader2 size={14} className="animate-spin" />Deleting...</> : <><Trash2 size={14} />Delete Order</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
