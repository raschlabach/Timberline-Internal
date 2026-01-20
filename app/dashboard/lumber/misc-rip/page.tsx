'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, ArrowLeft, Trash2, CheckCircle, Package, Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'

interface Operator {
  id: number
  name: string
  is_active: boolean
}

interface Species {
  id: number
  name: string
  color: string
}

interface Grade {
  id: number
  name: string
}

interface MiscOrder {
  id: number
  customer_name: string
  species: string
  grade: string
  thickness: string
  estimated_footage: number | null
  notes: string | null
  is_complete: boolean
  created_at: string
  pack_count: number
  finished_pack_count: number
  total_finished_bf: number
}

interface MiscPack {
  id: number
  misc_order_id: number
  pack_id: string | null
  actual_board_feet: number | null
  rip_yield: number | null
  operator_id: number | null
  stacker_1_id: number | null
  stacker_2_id: number | null
  stacker_3_id: number | null
  stacker_4_id: number | null
  rip_comments: string | null
  is_finished: boolean
  finished_at: string | null
  operator_name: string | null
  stacker_1_name: string | null
  stacker_2_name: string | null
  stacker_3_name: string | null
  stacker_4_name: string | null
}

export default function MiscRipPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // Data states
  const [orders, setOrders] = useState<MiscOrder[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [speciesList, setSpeciesList] = useState<Species[]>([])
  const [gradesList, setGradesList] = useState<Grade[]>([])
  const [customers, setCustomers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Selected order states
  const [selectedOrder, setSelectedOrder] = useState<MiscOrder | null>(null)
  const [packs, setPacks] = useState<MiscPack[]>([])
  
  // New order dialog
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false)
  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    species: '',
    grade: '',
    thickness: '4/4',
    estimated_footage: '',
    notes: ''
  })
  
  // Pack editing state
  const [packEdits, setPackEdits] = useState<Record<number, any>>({})
  
  // Load-level operator/stacker assignment
  const [operatorId, setOperatorId] = useState<string>('')
  const [stacker1Id, setStacker1Id] = useState<string>('')
  const [stacker2Id, setStacker2Id] = useState<string>('')
  const [stacker3Id, setStacker3Id] = useState<string>('')
  const [stacker4Id, setStacker4Id] = useState<string>('')
  
  const [showCompleted, setShowCompleted] = useState(false)
  
  // Edit pack dialog state
  const [editPackDialogOpen, setEditPackDialogOpen] = useState(false)
  const [editingPack, setEditingPack] = useState<MiscPack | null>(null)
  const [editPackData, setEditPackData] = useState({
    pack_id: '',
    actual_board_feet: '',
    rip_yield: '',
    rip_comments: '',
    operator_id: '',
    stacker_1_id: '',
    stacker_2_id: '',
    stacker_3_id: '',
    stacker_4_id: '',
    is_finished: false,
    finished_at: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/misc-rip')
    }
  }, [status, router])

  async function fetchData() {
    try {
      const [ordersRes, operatorsRes, speciesRes, gradesRes, customersRes] = await Promise.all([
        fetch(`/api/lumber/misc-orders?include_complete=${showCompleted}`),
        fetch('/api/lumber/operators'),
        fetch('/api/lumber/species'),
        fetch('/api/lumber/grades'),
        fetch('/api/lumber/misc-customers')
      ])
      
      if (ordersRes.ok) setOrders(await ordersRes.json())
      if (operatorsRes.ok) {
        const allOperators = await operatorsRes.json()
        setOperators(allOperators.filter((op: Operator) => op.is_active))
      }
      if (speciesRes.ok) setSpeciesList(await speciesRes.json())
      if (gradesRes.ok) setGradesList(await gradesRes.json())
      if (customersRes.ok) setCustomers(await customersRes.json())
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, showCompleted])

  async function handleSelectOrder(order: MiscOrder) {
    setSelectedOrder(order)
    
    try {
      const response = await fetch(`/api/lumber/misc-orders/${order.id}/packs`)
      if (response.ok) {
        const data = await response.json()
        setPacks(data)
        
        // Initialize pack edits
        const edits: Record<number, any> = {}
        data.forEach((pack: MiscPack) => {
          edits[pack.id] = {
            pack_id: pack.pack_id || '',
            actual_board_feet: pack.actual_board_feet != null ? String(pack.actual_board_feet) : '',
            rip_yield: pack.rip_yield != null ? String(pack.rip_yield) : '',
            rip_comments: pack.rip_comments || '',
            operator_id: pack.operator_id != null ? String(pack.operator_id) : '',
            stacker_1_id: pack.stacker_1_id != null ? String(pack.stacker_1_id) : '',
            stacker_2_id: pack.stacker_2_id != null ? String(pack.stacker_2_id) : '',
            stacker_3_id: pack.stacker_3_id != null ? String(pack.stacker_3_id) : '',
            stacker_4_id: pack.stacker_4_id != null ? String(pack.stacker_4_id) : '',
            is_finished: pack.is_finished || false,
            finished_at: pack.finished_at ? pack.finished_at.split('T')[0] : ''
          }
        })
        setPackEdits(edits)
        
        // Pre-populate operator/stacker from last assigned pack
        if (data.length > 0) {
          const lastAssignedPack = [...data].reverse().find((pack: MiscPack) => pack.operator_id)
          if (lastAssignedPack) {
            setOperatorId(lastAssignedPack.operator_id?.toString() || '')
            setStacker1Id(lastAssignedPack.stacker_1_id?.toString() || '')
            setStacker2Id(lastAssignedPack.stacker_2_id?.toString() || '')
            setStacker3Id(lastAssignedPack.stacker_3_id?.toString() || '')
            setStacker4Id(lastAssignedPack.stacker_4_id?.toString() || '')
          } else {
            setOperatorId('')
            setStacker1Id('')
            setStacker2Id('')
            setStacker3Id('')
            setStacker4Id('')
          }
        }
      }
    } catch (error) {
      console.error('Error fetching packs:', error)
      toast.error('Failed to load packs')
    }
  }

  async function handleCreateOrder() {
    if (!newOrder.customer_name || !newOrder.species || !newOrder.grade) {
      toast.error('Customer, species, and grade are required')
      return
    }

    try {
      const response = await fetch('/api/lumber/misc-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newOrder,
          estimated_footage: newOrder.estimated_footage ? parseInt(newOrder.estimated_footage) : null
        })
      })

      if (response.ok) {
        toast.success('Order created')
        setNewOrderDialogOpen(false)
        setNewOrder({
          customer_name: '',
          species: '',
          grade: '',
          thickness: '4/4',
          estimated_footage: '',
          notes: ''
        })
        fetchData()
        // Refresh customers list
        const customersRes = await fetch('/api/lumber/misc-customers')
        if (customersRes.ok) setCustomers(await customersRes.json())
      } else {
        toast.error('Failed to create order')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('Failed to create order')
    }
  }

  async function handleAddPack() {
    if (!selectedOrder) return

    try {
      const response = await fetch('/api/lumber/misc-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          misc_order_id: selectedOrder.id
        })
      })

      if (response.ok) {
        toast.success('Pack added')
        handleSelectOrder(selectedOrder)
      } else {
        toast.error('Failed to add pack')
      }
    } catch (error) {
      console.error('Error adding pack:', error)
      toast.error('Failed to add pack')
    }
  }

  function updatePackEdit(packId: number, field: string, value: any) {
    setPackEdits(prev => ({
      ...prev,
      [packId]: {
        ...prev[packId],
        [field]: value
      }
    }))
  }

  async function handleFinishPack(packId: number) {
    const edit = packEdits[packId]
    if (!edit) return

    // Validate required fields
    if (!edit.actual_board_feet || edit.actual_board_feet === '') {
      toast.error('Actual BF is required to finish pack')
      return
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    try {
      const response = await fetch(`/api/lumber/misc-packs/${packId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_id: edit.pack_id || null,
          actual_board_feet: parseInt(edit.actual_board_feet),
          rip_yield: edit.rip_yield !== '' ? parseFloat(edit.rip_yield) : null,
          rip_comments: edit.rip_comments || null,
          operator_id: operatorId !== '' ? parseInt(operatorId) : null,
          stacker_1_id: stacker1Id !== '' ? parseInt(stacker1Id) : null,
          stacker_2_id: stacker2Id !== '' ? parseInt(stacker2Id) : null,
          stacker_3_id: stacker3Id !== '' ? parseInt(stacker3Id) : null,
          stacker_4_id: stacker4Id !== '' ? parseInt(stacker4Id) : null,
          is_finished: true,
          finished_at: today
        })
      })

      if (response.ok) {
        toast.success('Pack finished!')
        // Refresh the packs to show updated status
        if (selectedOrder) {
          handleSelectOrder(selectedOrder)
        }
      } else {
        toast.error('Failed to finish pack')
      }
    } catch (error) {
      console.error('Error finishing pack:', error)
      toast.error('Failed to finish pack')
    }
  }

  async function handleDeletePack(packId: number) {
    if (!confirm('Are you sure you want to delete this pack?')) return

    try {
      const response = await fetch(`/api/lumber/misc-packs/${packId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Pack deleted')
        setPacks(prev => prev.filter(p => p.id !== packId))
        const newEdits = { ...packEdits }
        delete newEdits[packId]
        setPackEdits(newEdits)
      } else {
        toast.error('Failed to delete pack')
      }
    } catch (error) {
      console.error('Error deleting pack:', error)
      toast.error('Failed to delete pack')
    }
  }

  function handleOpenEditPack(pack: MiscPack) {
    setEditingPack(pack)
    setEditPackData({
      pack_id: pack.pack_id || '',
      actual_board_feet: pack.actual_board_feet != null ? String(pack.actual_board_feet) : '',
      rip_yield: pack.rip_yield != null ? String(pack.rip_yield) : '',
      rip_comments: pack.rip_comments || '',
      operator_id: pack.operator_id != null ? String(pack.operator_id) : '',
      stacker_1_id: pack.stacker_1_id != null ? String(pack.stacker_1_id) : '',
      stacker_2_id: pack.stacker_2_id != null ? String(pack.stacker_2_id) : '',
      stacker_3_id: pack.stacker_3_id != null ? String(pack.stacker_3_id) : '',
      stacker_4_id: pack.stacker_4_id != null ? String(pack.stacker_4_id) : '',
      is_finished: pack.is_finished,
      finished_at: pack.finished_at ? pack.finished_at.split('T')[0] : ''
    })
    setEditPackDialogOpen(true)
  }

  async function handleSaveEditPack() {
    if (!editingPack) return

    try {
      const response = await fetch(`/api/lumber/misc-packs/${editingPack.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_id: editPackData.pack_id || null,
          actual_board_feet: editPackData.actual_board_feet !== '' ? parseInt(editPackData.actual_board_feet) : null,
          rip_yield: editPackData.rip_yield !== '' ? parseFloat(editPackData.rip_yield) : null,
          rip_comments: editPackData.rip_comments || null,
          operator_id: editPackData.operator_id !== '' ? parseInt(editPackData.operator_id) : null,
          stacker_1_id: editPackData.stacker_1_id !== '' ? parseInt(editPackData.stacker_1_id) : null,
          stacker_2_id: editPackData.stacker_2_id !== '' ? parseInt(editPackData.stacker_2_id) : null,
          stacker_3_id: editPackData.stacker_3_id !== '' ? parseInt(editPackData.stacker_3_id) : null,
          stacker_4_id: editPackData.stacker_4_id !== '' ? parseInt(editPackData.stacker_4_id) : null,
          is_finished: editPackData.is_finished,
          finished_at: editPackData.finished_at || null
        })
      })

      if (response.ok) {
        toast.success('Pack updated')
        setEditPackDialogOpen(false)
        setEditingPack(null)
        // Refresh packs
        if (selectedOrder) {
          handleSelectOrder(selectedOrder)
        }
      } else {
        toast.error('Failed to update pack')
      }
    } catch (error) {
      console.error('Error updating pack:', error)
      toast.error('Failed to update pack')
    }
  }

  async function handleMarkOrderComplete() {
    if (!selectedOrder) return
    if (!confirm('Mark this order as complete? This will hide it from the active orders list.')) return

    try {
      const response = await fetch(`/api/lumber/misc-orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_complete: true })
      })

      if (response.ok) {
        toast.success('Order marked as complete')
        setSelectedOrder(null)
        fetchData()
      } else {
        toast.error('Failed to update order')
      }
    } catch (error) {
      console.error('Error updating order:', error)
      toast.error('Failed to update order')
    }
  }

  async function handleDeleteOrder() {
    if (!selectedOrder) return
    if (!confirm('Are you sure you want to delete this order? This will delete all packs associated with it.')) return

    try {
      const response = await fetch(`/api/lumber/misc-orders/${selectedOrder.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Order deleted')
        setSelectedOrder(null)
        fetchData()
      } else {
        toast.error('Failed to delete order')
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      toast.error('Failed to delete order')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Calculate totals for selected order
  const totalFinishedBF = packs
    .filter(p => packEdits[p.id]?.is_finished)
    .reduce((sum, p) => sum + (parseInt(packEdits[p.id]?.actual_board_feet) || 0), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Misc Rip</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track miscellaneous ripping jobs for outside customers
          </p>
        </div>
        {!selectedOrder && (
          <Button onClick={() => setNewOrderDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        )}
      </div>

      {!selectedOrder ? (
        /* Orders List */
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={showCompleted}
                onCheckedChange={(checked) => setShowCompleted(checked as boolean)}
              />
              Show completed orders
            </label>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Species</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Thickness</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Est. Footage</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Packs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Finished BF</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No misc orders found. Click "New Order" to create one.
                    </td>
                  </tr>
                ) : (
                  orders.map((order, idx) => (
                    <tr 
                      key={order.id}
                      className={`hover:bg-blue-50 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      onClick={() => handleSelectOrder(order)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {order.customer_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.species}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.grade}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.thickness}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {order.estimated_footage?.toLocaleString() || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="text-green-600 font-medium">{order.finished_pack_count}</span>
                        <span className="text-gray-400">/{order.pack_count}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {Number(order.total_finished_bf).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {order.is_complete ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Order Detail / Rip Entry View */
        <div className="space-y-4">
          {/* Back button and order header */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleMarkOrderComplete}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
              <Button variant="destructive" onClick={handleDeleteOrder}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Order
              </Button>
            </div>
          </div>

          {/* Order Info Card */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-6 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Customer</Label>
                <div className="font-semibold">{selectedOrder.customer_name}</div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Species</Label>
                <div className="font-semibold">{selectedOrder.species}</div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Grade</Label>
                <div className="font-semibold">{selectedOrder.grade}</div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Thickness</Label>
                <div className="font-semibold">{selectedOrder.thickness}</div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Est. Footage</Label>
                <div className="font-semibold">{selectedOrder.estimated_footage?.toLocaleString() || '-'}</div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Finished BF</Label>
                <div className="font-semibold text-green-600">{totalFinishedBF.toLocaleString()}</div>
              </div>
            </div>
            {selectedOrder.notes && (
              <div className="mt-3 pt-3 border-t">
                <Label className="text-xs text-gray-500">Notes</Label>
                <div className="text-sm text-gray-700">{selectedOrder.notes}</div>
              </div>
            )}
          </div>

          {/* Operator/Stacker Assignment */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-sm mb-3">Operator & Stackers (used when finishing packs)</h3>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Operator</Label>
                <Select value={operatorId || 'none'} onValueChange={(val) => setOperatorId(val === 'none' ? '' : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Stacker 1</Label>
                <Select value={stacker1Id || 'none'} onValueChange={(val) => setStacker1Id(val === 'none' ? '' : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Stacker 2</Label>
                <Select value={stacker2Id || 'none'} onValueChange={(val) => setStacker2Id(val === 'none' ? '' : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Stacker 3</Label>
                <Select value={stacker3Id || 'none'} onValueChange={(val) => setStacker3Id(val === 'none' ? '' : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Stacker 4</Label>
                <Select value={stacker4Id || 'none'} onValueChange={(val) => setStacker4Id(val === 'none' ? '' : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Packs Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-100 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">Packs ({packs.length})</h3>
              <Button size="sm" onClick={handleAddPack}>
                <Plus className="h-4 w-4 mr-1" />
                Add Pack
              </Button>
            </div>
            
            {packs.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No packs yet. Click "Add Pack" to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="px-3 py-2 text-left">Pack ID</th>
                      <th className="px-3 py-2 text-left">Actual BF</th>
                      <th className="px-3 py-2 text-left">Yield %</th>
                      <th className="px-3 py-2 text-left">Comments</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packs.map((pack, idx) => {
                      const isFinished = packEdits[pack.id]?.is_finished || pack.is_finished
                      return (
                        <tr 
                          key={pack.id}
                          className={`border-t ${isFinished ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        >
                          <td className="px-3 py-2">
                            {isFinished ? (
                              <span className="font-medium">{pack.pack_id || '-'}</span>
                            ) : (
                              <Input
                                className="h-7 text-xs w-24"
                                value={packEdits[pack.id]?.pack_id ?? ''}
                                onChange={(e) => updatePackEdit(pack.id, 'pack_id', e.target.value)}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isFinished ? (
                              <span className="font-medium text-blue-600">{Number(pack.actual_board_feet || 0).toLocaleString()}</span>
                            ) : (
                              <Input
                                type="number"
                                className="h-7 text-xs w-24"
                                value={packEdits[pack.id]?.actual_board_feet ?? ''}
                                onChange={(e) => updatePackEdit(pack.id, 'actual_board_feet', e.target.value)}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isFinished ? (
                              <span>{pack.rip_yield ? `${Number(pack.rip_yield).toFixed(1)}%` : '-'}</span>
                            ) : (
                              <Input
                                type="number"
                                step="0.1"
                                className="h-7 text-xs w-20"
                                value={packEdits[pack.id]?.rip_yield ?? ''}
                                onChange={(e) => updatePackEdit(pack.id, 'rip_yield', e.target.value)}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isFinished ? (
                              <span className="text-gray-600">{pack.rip_comments || '-'}</span>
                            ) : (
                              <Input
                                className="h-7 text-xs w-40"
                                placeholder="Optional..."
                                value={packEdits[pack.id]?.rip_comments ?? ''}
                                onChange={(e) => updatePackEdit(pack.id, 'rip_comments', e.target.value)}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isFinished ? (
                              <div className="text-xs">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Finished
                                </span>
                                <div className="text-gray-500 mt-1">
                                  {pack.finished_at ? new Date(pack.finished_at).toLocaleDateString('en-US', { timeZone: 'UTC' }) : ''}
                                </div>
                                <div className="text-gray-500">
                                  {pack.operator_name || ''}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              {!isFinished && (
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                                  onClick={() => handleFinishPack(pack.id)}
                                  title="Finish Pack"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Finish
                                </Button>
                              )}
                              {isFinished && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleOpenEditPack(pack)}
                                  title="Edit Pack"
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeletePack(pack.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Order Dialog */}
      <Dialog open={newOrderDialogOpen} onOpenChange={setNewOrderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Misc Order</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div>
              <Label>Customer Name *</Label>
              <Input
                list="customers-list"
                placeholder="Enter or select customer..."
                value={newOrder.customer_name}
                onChange={(e) => setNewOrder(prev => ({ ...prev, customer_name: e.target.value }))}
              />
              <datalist id="customers-list">
                {customers.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Species *</Label>
                <Select 
                  value={newOrder.species} 
                  onValueChange={(val) => setNewOrder(prev => ({ ...prev, species: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {speciesList.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grade *</Label>
                <Select 
                  value={newOrder.grade} 
                  onValueChange={(val) => setNewOrder(prev => ({ ...prev, grade: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {gradesList.map(g => (
                      <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Thickness</Label>
                <Select 
                  value={newOrder.thickness} 
                  onValueChange={(val) => setNewOrder(prev => ({ ...prev, thickness: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4/4">4/4</SelectItem>
                    <SelectItem value="5/4">5/4</SelectItem>
                    <SelectItem value="6/4">6/4</SelectItem>
                    <SelectItem value="8/4">8/4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Estimated Footage</Label>
              <Input
                type="number"
                placeholder="Optional..."
                value={newOrder.estimated_footage}
                onChange={(e) => setNewOrder(prev => ({ ...prev, estimated_footage: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes about this order..."
                value={newOrder.notes}
                onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setNewOrderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateOrder}>
                Create Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
