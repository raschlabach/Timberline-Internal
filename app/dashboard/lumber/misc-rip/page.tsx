'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Plus, ArrowLeft, Save, Trash2, CheckCircle, Package } from 'lucide-react'
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

  async function handleSavePack(packId: number) {
    const edit = packEdits[packId]
    if (!edit) return

    try {
      const response = await fetch(`/api/lumber/misc-packs/${packId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_id: edit.pack_id || null,
          actual_board_feet: edit.actual_board_feet !== '' ? parseInt(edit.actual_board_feet) : null,
          rip_yield: edit.rip_yield !== '' ? parseFloat(edit.rip_yield) : null,
          rip_comments: edit.rip_comments || null,
          operator_id: edit.operator_id !== '' ? parseInt(edit.operator_id) : null,
          stacker_1_id: edit.stacker_1_id !== '' ? parseInt(edit.stacker_1_id) : null,
          stacker_2_id: edit.stacker_2_id !== '' ? parseInt(edit.stacker_2_id) : null,
          stacker_3_id: edit.stacker_3_id !== '' ? parseInt(edit.stacker_3_id) : null,
          stacker_4_id: edit.stacker_4_id !== '' ? parseInt(edit.stacker_4_id) : null,
          is_finished: edit.is_finished,
          finished_at: edit.finished_at || null
        })
      })

      if (response.ok) {
        toast.success('Pack saved')
      } else {
        toast.error('Failed to save pack')
      }
    } catch (error) {
      console.error('Error saving pack:', error)
      toast.error('Failed to save pack')
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

  // Apply operator/stacker to all unfinished packs
  function applyOperatorToAll() {
    const updatedEdits = { ...packEdits }
    packs.forEach(pack => {
      if (!pack.is_finished && updatedEdits[pack.id]) {
        updatedEdits[pack.id] = {
          ...updatedEdits[pack.id],
          operator_id: operatorId,
          stacker_1_id: stacker1Id,
          stacker_2_id: stacker2Id,
          stacker_3_id: stacker3Id,
          stacker_4_id: stacker4Id
        }
      }
    })
    setPackEdits(updatedEdits)
    toast.success('Applied to all unfinished packs')
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Operator & Stackers</h3>
              <Button size="sm" variant="outline" onClick={applyOperatorToAll}>
                Apply to All Unfinished
              </Button>
            </div>
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
                      <th className="px-2 py-2 text-left" style={{width: '80px'}}>Pack ID</th>
                      <th className="px-2 py-2 text-left" style={{width: '90px'}}>Actual BF</th>
                      <th className="px-2 py-2 text-left" style={{width: '70px'}}>Yield %</th>
                      <th className="px-2 py-2 text-left" style={{width: '110px'}}>Operator</th>
                      <th className="px-2 py-2 text-left" style={{width: '100px'}}>Stacker 1</th>
                      <th className="px-2 py-2 text-left" style={{width: '100px'}}>Stacker 2</th>
                      <th className="px-2 py-2 text-left" style={{width: '100px'}}>Stacker 3</th>
                      <th className="px-2 py-2 text-left" style={{width: '100px'}}>Stacker 4</th>
                      <th className="px-2 py-2 text-center" style={{width: '50px'}}>Done</th>
                      <th className="px-2 py-2 text-left" style={{width: '115px'}}>Finish Date</th>
                      <th className="px-2 py-2 text-left" style={{width: '120px'}}>Comments</th>
                      <th className="px-2 py-2 text-center" style={{width: '70px'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packs.map((pack, idx) => (
                      <tr 
                        key={pack.id}
                        className={`border-t ${packEdits[pack.id]?.is_finished ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-2 py-1">
                          <Input
                            className="h-7 text-xs"
                            value={packEdits[pack.id]?.pack_id ?? ''}
                            onChange={(e) => updatePackEdit(pack.id, 'pack_id', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            value={packEdits[pack.id]?.actual_board_feet ?? ''}
                            onChange={(e) => updatePackEdit(pack.id, 'actual_board_feet', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-7 text-xs"
                            value={packEdits[pack.id]?.rip_yield ?? ''}
                            onChange={(e) => updatePackEdit(pack.id, 'rip_yield', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={packEdits[pack.id]?.operator_id || 'none'}
                            onValueChange={(val) => updatePackEdit(pack.id, 'operator_id', val === 'none' ? '' : val)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={packEdits[pack.id]?.stacker_1_id || 'none'}
                            onValueChange={(val) => updatePackEdit(pack.id, 'stacker_1_id', val === 'none' ? '' : val)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={packEdits[pack.id]?.stacker_2_id || 'none'}
                            onValueChange={(val) => updatePackEdit(pack.id, 'stacker_2_id', val === 'none' ? '' : val)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={packEdits[pack.id]?.stacker_3_id || 'none'}
                            onValueChange={(val) => updatePackEdit(pack.id, 'stacker_3_id', val === 'none' ? '' : val)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={packEdits[pack.id]?.stacker_4_id || 'none'}
                            onValueChange={(val) => updatePackEdit(pack.id, 'stacker_4_id', val === 'none' ? '' : val)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1 text-center">
                          <Checkbox
                            checked={packEdits[pack.id]?.is_finished || false}
                            onCheckedChange={(checked) => updatePackEdit(pack.id, 'is_finished', checked)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="date"
                            className="h-7 text-xs"
                            value={packEdits[pack.id]?.finished_at ?? ''}
                            onChange={(e) => updatePackEdit(pack.id, 'finished_at', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-7 text-xs"
                            value={packEdits[pack.id]?.rip_comments ?? ''}
                            onChange={(e) => updatePackEdit(pack.id, 'rip_comments', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0"
                              onClick={() => handleSavePack(pack.id)}
                              title="Save"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeletePack(pack.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
