'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, Plus, Pencil, Loader2, GripVertical, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ============================================================
// Types
// ============================================================

interface Machine {
  id: string
  name: string
  rate_per_hour: number
  setup_cost: number
  throughput_unit: 'LF_HR' | 'BF_HR' | 'PIECES_HR'
  throughput_rate: number
  notes: string | null
  active: boolean
}

interface MachineStep {
  id: string
  machine_id: string
  machine_name?: string
  step_order: number
  throughput_override: number | null
}

interface ProductTemplate {
  id: string
  name: string
  active: boolean
  steps: MachineStep[]
}

interface YieldDefault {
  id?: string
  species: string
  grade: string
  yield_percent: number
  _isNew?: boolean
}

interface QuoteDefaults {
  id: string
  margin_1: number
  margin_2: number
  margin_3: number
}

const THROUGHPUT_LABELS: Record<string, string> = {
  LF_HR: 'Lineal Feet/Hr',
  BF_HR: 'Board Feet/Hr',
  PIECES_HR: 'Pieces/Hr',
}

// ============================================================
// Sortable Step Row for Products tab
// ============================================================

function SortableStepRow({
  step,
  index,
  machines,
  onUpdate,
  onRemove,
}: {
  step: { localId: string; machine_id: string; throughput_override: number | null }
  index: number
  machines: Machine[]
  onUpdate: (index: number, field: string, value: string | number | null) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: step.localId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
      <button type="button" className="cursor-grab text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
      <Select value={step.machine_id} onValueChange={(v) => onUpdate(index, 'machine_id', v)}>
        <SelectTrigger className="flex-1 h-9">
          <SelectValue placeholder="Select machine" />
        </SelectTrigger>
        <SelectContent>
          {machines.filter((m) => m.active).map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        placeholder="Override"
        className="w-28 h-9"
        value={step.throughput_override ?? ''}
        onChange={(e) => onUpdate(index, 'throughput_override', e.target.value ? parseFloat(e.target.value) : null)}
      />
      <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="h-9 w-9 p-0 text-red-500 hover:text-red-700">
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function QuoteConfigPage() {
  return (
    <Suspense>
      <QuoteConfigContent />
    </Suspense>
  )
}

function QuoteConfigContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get('tab')
  const [activeTab, setActiveTab] = useState(tabParam || 'machines')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="h-7 w-7 text-amber-600" />
          Quote Configuration
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage machines, product templates, yield defaults, and margin settings for quoting.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="machines">Machines</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="yields">Yield Defaults</TabsTrigger>
          <TabsTrigger value="margins">Quote Defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="machines" className="mt-4">
          {session && <MachinesTab />}
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          {session && <ProductsTab />}
        </TabsContent>
        <TabsContent value="yields" className="mt-4">
          {session && <YieldDefaultsTab />}
        </TabsContent>
        <TabsContent value="margins" className="mt-4">
          {session && <QuoteDefaultsTab />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Tab 1: Machines
// ============================================================

function MachinesTab() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    rate_per_hour: '',
    setup_cost: '0',
    throughput_unit: 'LF_HR' as string,
    throughput_rate: '',
    notes: '',
  })

  const fetchMachines = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/rnr/quote-machines')
      if (!res.ok) throw new Error('Failed')
      setMachines(await res.json())
    } catch { toast.error('Failed to load machines') }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchMachines() }, [fetchMachines])

  function openAdd() {
    setEditingMachine(null)
    setForm({ name: '', rate_per_hour: '', setup_cost: '0', throughput_unit: 'LF_HR', throughput_rate: '', notes: '' })
    setIsDialogOpen(true)
  }

  function openEdit(m: Machine) {
    setEditingMachine(m)
    setForm({
      name: m.name,
      rate_per_hour: String(m.rate_per_hour),
      setup_cost: String(m.setup_cost),
      throughput_unit: m.throughput_unit,
      throughput_rate: String(m.throughput_rate),
      notes: m.notes || '',
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        rate_per_hour: parseFloat(form.rate_per_hour),
        setup_cost: parseFloat(form.setup_cost) || 0,
        throughput_unit: form.throughput_unit,
        throughput_rate: parseFloat(form.throughput_rate),
        notes: form.notes || null,
      }

      if (editingMachine) {
        const res = await fetch(`/api/rnr/quote-machines/${editingMachine.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed')
        toast.success('Machine updated')
      } else {
        const res = await fetch('/api/rnr/quote-machines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed')
        toast.success('Machine added')
      }
      setIsDialogOpen(false)
      fetchMachines()
    } catch { toast.error('Failed to save machine') }
    finally { setIsSaving(false) }
  }

  async function toggleActive(m: Machine) {
    try {
      const res = await fetch(`/api/rnr/quote-machines/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !m.active }),
      })
      if (!res.ok) throw new Error('Failed')
      setMachines((prev) => prev.map((x) => (x.id === m.id ? { ...x, active: !x.active } : x)))
    } catch { toast.error('Failed to update') }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Machines</h2>
        <Button onClick={openAdd} className="gap-2 bg-amber-600 hover:bg-amber-700">
          <Plus size={16} /> Add Machine
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-right px-4 py-3">Rate/Hr</th>
              <th className="text-right px-4 py-3">Setup Cost</th>
              <th className="text-left px-4 py-3">Throughput Unit</th>
              <th className="text-right px-4 py-3">Throughput Rate</th>
              <th className="text-left px-4 py-3">Notes</th>
              <th className="text-center px-4 py-3">Active</th>
              <th className="text-center px-4 py-3">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {machines.map((m) => (
              <tr key={m.id} className={!m.active ? 'opacity-50' : ''}>
                <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                <td className="px-4 py-3 text-right">${Number(m.rate_per_hour).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">${Number(m.setup_cost).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-600">{THROUGHPUT_LABELS[m.throughput_unit]}</td>
                <td className="px-4 py-3 text-right">{Number(m.throughput_rate).toFixed(1)}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{m.notes || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <Switch checked={m.active} onCheckedChange={() => toggleActive(m)} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                    <Pencil size={14} />
                  </Button>
                </td>
              </tr>
            ))}
            {machines.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No machines configured yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMachine ? 'Edit Machine' : 'Add Machine'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Machine Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rate per Hour ($)</Label>
                <Input type="number" step="0.01" value={form.rate_per_hour} onChange={(e) => setForm({ ...form, rate_per_hour: e.target.value })} />
              </div>
              <div>
                <Label>Setup Cost ($)</Label>
                <Input type="number" step="0.01" value={form.setup_cost} onChange={(e) => setForm({ ...form, setup_cost: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Throughput Unit</Label>
                <Select value={form.throughput_unit} onValueChange={(v) => setForm({ ...form, throughput_unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LF_HR">Lineal Feet/Hr</SelectItem>
                    <SelectItem value="BF_HR">Board Feet/Hr</SelectItem>
                    <SelectItem value="PIECES_HR">Pieces/Hr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Throughput Rate</Label>
                <Input type="number" step="0.1" value={form.throughput_rate} onChange={(e) => setForm({ ...form, throughput_rate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.name || !form.rate_per_hour || !form.throughput_rate}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              {editingMachine ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================
// Tab 2: Products
// ============================================================

function ProductsTab() {
  const [templates, setTemplates] = useState<ProductTemplate[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ProductTemplate | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [productName, setProductName] = useState('')
  const [steps, setSteps] = useState<{ localId: string; machine_id: string; throughput_override: number | null }[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [tRes, mRes] = await Promise.all([
        fetch('/api/rnr/quote-product-templates'),
        fetch('/api/rnr/quote-machines'),
      ])
      setTemplates(await tRes.json())
      setMachines(await mRes.json())
    } catch { toast.error('Failed to load data') }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function openAdd() {
    setEditingTemplate(null)
    setProductName('')
    setSteps([])
    setIsDialogOpen(true)
  }

  function openEdit(t: ProductTemplate) {
    setEditingTemplate(t)
    setProductName(t.name)
    setSteps(
      t.steps.map((s, i) => ({
        localId: `step-${i}-${Date.now()}`,
        machine_id: s.machine_id,
        throughput_override: s.throughput_override,
      }))
    )
    setIsDialogOpen(true)
  }

  function addStep() {
    setSteps((prev) => [...prev, { localId: `step-${Date.now()}`, machine_id: '', throughput_override: null }])
  }

  function updateStep(index: number, field: string, value: string | number | null) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSteps((prev) => {
        const oldIndex = prev.findIndex((s) => s.localId === active.id)
        const newIndex = prev.findIndex((s) => s.localId === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const payload = {
        name: productName,
        steps: steps.filter((s) => s.machine_id).map((s, i) => ({
          machine_id: s.machine_id,
          step_order: i + 1,
          throughput_override: s.throughput_override,
        })),
      }

      if (editingTemplate) {
        const res = await fetch(`/api/rnr/quote-product-templates/${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed')
        toast.success('Product updated')
      } else {
        const res = await fetch('/api/rnr/quote-product-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed')
        toast.success('Product added')
      }
      setIsDialogOpen(false)
      fetchData()
    } catch { toast.error('Failed to save product') }
    finally { setIsSaving(false) }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Product Templates</h2>
        <Button onClick={openAdd} className="gap-2 bg-amber-600 hover:bg-amber-700">
          <Plus size={16} /> Add Product
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Product Name</th>
              <th className="text-center px-4 py-3">Steps</th>
              <th className="text-center px-4 py-3">Active</th>
              <th className="text-center px-4 py-3">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {templates.map((t) => (
              <tr key={t.id} className={!t.active ? 'opacity-50' : ''}>
                <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-3 text-center text-gray-600">{t.steps.length}</td>
                <td className="px-4 py-3 text-center text-gray-600">{t.active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                    <Pencil size={14} />
                  </Button>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No product templates yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product Name</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-2 block">Machine Steps (drag to reorder)</Label>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={steps.map((s) => s.localId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {steps.map((step, i) => (
                      <SortableStepRow
                        key={step.localId}
                        step={step}
                        index={i}
                        machines={machines}
                        onUpdate={updateStep}
                        onRemove={removeStep}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={addStep}>
                <Plus size={14} /> Add Step
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !productName}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              {editingTemplate ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================
// Tab 3: Yield Defaults
// ============================================================

function YieldDefaultsTab() {
  const [rows, setRows] = useState<YieldDefault[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchYields = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/rnr/quote-yield-defaults')
      if (!res.ok) throw new Error('Failed')
      setRows(await res.json())
    } catch { toast.error('Failed to load yield defaults') }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchYields() }, [fetchYields])

  function addRow() {
    setRows((prev) => [...prev, { species: '', grade: '', yield_percent: 0, _isNew: true }])
  }

  function updateRow(index: number, field: string, value: string | number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  async function saveAll() {
    setIsSaving(true)
    try {
      const validRows = rows.filter((r) => r.species && r.grade && r.yield_percent > 0)
      const res = await fetch('/api/rnr/quote-yield-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      })
      if (!res.ok) throw new Error('Failed')
      setRows(await res.json())
      toast.success('Yield defaults saved')
    } catch { toast.error('Failed to save') }
    finally { setIsSaving(false) }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
  }

  const grouped = rows.reduce<Record<string, YieldDefault[]>>((acc, r) => {
    const key = r.species || '(new)'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Yield Defaults</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRow} className="gap-1">
            <Plus size={14} /> Add Row
          </Button>
          <Button onClick={saveAll} disabled={isSaving} className="gap-2 bg-amber-600 hover:bg-amber-700">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save All
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Species</th>
              <th className="text-left px-4 py-3">Grade</th>
              <th className="text-right px-4 py-3">Yield %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={r.id || `new-${i}`}>
                <td className="px-4 py-2">
                  <Input
                    value={r.species}
                    onChange={(e) => updateRow(i, 'species', e.target.value)}
                    className="h-8"
                    placeholder="Species"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={r.grade}
                    onChange={(e) => updateRow(i, 'grade', e.target.value)}
                    className="h-8"
                    placeholder="Grade"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    step="0.1"
                    value={r.yield_percent}
                    onChange={(e) => updateRow(i, 'yield_percent', parseFloat(e.target.value) || 0)}
                    className="h-8 text-right w-24 ml-auto"
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No yield defaults configured. Add a row to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ============================================================
// Tab 4: Quote Defaults
// ============================================================

function QuoteDefaultsTab() {
  const [defaults, setDefaults] = useState<QuoteDefaults | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ margin_1: '20', margin_2: '25', margin_3: '30' })

  const fetchDefaults = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/rnr/quote-defaults')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setDefaults(data)
      setForm({
        margin_1: String(data.margin_1),
        margin_2: String(data.margin_2),
        margin_3: String(data.margin_3),
      })
    } catch { toast.error('Failed to load quote defaults') }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchDefaults() }, [fetchDefaults])

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/rnr/quote-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          margin_1: parseFloat(form.margin_1),
          margin_2: parseFloat(form.margin_2),
          margin_3: parseFloat(form.margin_3),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setDefaults(data)
      toast.success('Quote defaults saved')
    } catch { toast.error('Failed to save') }
    finally { setIsSaving(false) }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-md">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Default Margin Percentages</h2>
      <p className="text-sm text-gray-500 mb-6">These margins are pre-filled on new quotes for the margin comparison table.</p>
      <div className="space-y-4">
        <div>
          <Label>Margin 1 (%)</Label>
          <Input type="number" step="0.1" value={form.margin_1} onChange={(e) => setForm({ ...form, margin_1: e.target.value })} />
        </div>
        <div>
          <Label>Margin 2 (%)</Label>
          <Input type="number" step="0.1" value={form.margin_2} onChange={(e) => setForm({ ...form, margin_2: e.target.value })} />
        </div>
        <div>
          <Label>Margin 3 (%)</Label>
          <Input type="number" step="0.1" value={form.margin_3} onChange={(e) => setForm({ ...form, margin_3: e.target.value })} />
        </div>
      </div>
      <Button onClick={handleSave} disabled={isSaving} className="mt-6 gap-2 bg-amber-600 hover:bg-amber-700">
        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save
      </Button>
    </div>
  )
}
