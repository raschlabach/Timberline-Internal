'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Loader2, Package, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface FreightOrder {
  id: number
  customer: string
  po_number: string | null
  is_done: boolean
  skid_count: number
  created_at: string
  updated_at: string
}

export default function FreightPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<FreightOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState('')
  const [newPo, setNewPo] = useState('')

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/freight-orders')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setOrders(data)
    } catch {
      toast.error('Failed to load freight orders')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  async function handleCreate() {
    if (!newCustomer.trim()) {
      toast.error('Customer name is required')
      return
    }
    setIsCreating(true)
    try {
      const res = await fetch('/api/freight-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: newCustomer.trim(), po_number: newPo.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const order = await res.json()
      router.push(`/dashboard/lumber/freight/${order.id}`)
    } catch {
      toast.error('Failed to create order')
      setIsCreating(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this freight order? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/freight-orders/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Order deleted')
      setOrders(prev => prev.filter(o => o.id !== id))
    } catch {
      toast.error('Failed to delete order')
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Freight</h1>
          <p className="text-sm text-gray-500 mt-1">Manage freight shipping orders and print shipping reports</p>
        </div>
        <Button onClick={() => setShowNewForm(true)} disabled={showNewForm} className="gap-2">
          <Plus className="h-4 w-4" />
          New Order
        </Button>
      </div>

      {showNewForm && (
        <Card className="mb-6 border-blue-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">New Freight Order</CardTitle>
              <button onClick={() => { setShowNewForm(false); setNewCustomer(''); setNewPo('') }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label className="text-sm font-medium">Customer *</Label>
                <Input
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  placeholder="Enter customer name"
                  className="mt-1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">PO #</Label>
                <Input
                  value={newPo}
                  onChange={(e) => setNewPo(e.target.value)}
                  placeholder="Enter PO number (optional)"
                  className="mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <Button onClick={handleCreate} disabled={isCreating} className="gap-2">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No freight orders yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first freight shipping order</p>
              <Button onClick={() => setShowNewForm(true)} variant="outline" className="mt-4 gap-1.5">
                <Plus className="h-4 w-4" /> New Order
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y">
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500 w-16">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Customer</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">PO #</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500">Skids</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Created</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Updated</th>
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr
                      key={order.id}
                      className={`border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors ${
                        order.is_done ? 'opacity-60' : ''
                      }`}
                      onClick={() => router.push(`/dashboard/lumber/freight/${order.id}`)}
                    >
                      <td className="px-4 py-3">
                        {order.is_done ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{order.customer}</td>
                      <td className="px-4 py-3">
                        {order.po_number || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{order.skid_count}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {format(new Date(order.updated_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(order.id)
                          }}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete order"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
