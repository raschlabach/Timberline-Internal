'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Calculator, ChevronLeft, ChevronRight, Check, Loader2, Plus, Trash2,
  GripVertical, FileText, Send,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ============================================================
// Types
// ============================================================

interface ProductTemplate {
  id: string
  name: string
  active: boolean
  steps: {
    id: string
    machine_id: string
    machine_name: string
    step_order: number
    throughput_override: number | null
    throughput_unit: string
    throughput_rate: number
    rate_per_hour: number
    setup_cost: number
  }[]
}

interface Machine {
  id: string
  name: string
  rate_per_hour: number
  setup_cost: number
  throughput_unit: string
  throughput_rate: number
  active: boolean
}

interface MachineStepState {
  localId: string
  machine_name: string
  rate_per_hour: number
  setup_cost: number
  throughput_unit: string
  throughput_rate: number
  step_order: number
}

interface ToolingSurcharge {
  id: string
  description: string
  amount: number
}

interface LumberPricingEntry {
  cost_per_bf: number
  date: string
}

const STEP_LABELS = [
  'Job Info',
  'Product',
  'Species & Grade',
  'Qty & Dimensions',
  'Machine Steps',
  'Surcharges',
  'Cost Summary',
  'Finalize',
]

const THROUGHPUT_LABELS: Record<string, string> = {
  LF_HR: 'LF/Hr',
  BF_HR: 'BF/Hr',
  PIECES_HR: 'Pcs/Hr',
}

const UNIT_LABELS: Record<string, string> = {
  LF: 'Lineal Feet',
  BF: 'Board Feet',
  PIECES: 'Pieces',
}

// ============================================================
// Sortable Step Row for Add Product Dialog
// ============================================================

function SortableDialogStep({
  step,
  index,
  machines,
  onUpdate,
  onRemove,
}: {
  step: { localId: string; machine_id: string; throughput_override: number | null }
  index: number
  machines: Machine[]
  onUpdate: (idx: number, field: string, val: string | number | null) => void
  onRemove: (idx: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.localId })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
      <button type="button" className="cursor-grab text-gray-400" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
      <Select value={step.machine_id} onValueChange={(v) => onUpdate(index, 'machine_id', v)}>
        <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Select machine" /></SelectTrigger>
        <SelectContent>
          {machines.filter((m) => m.active).map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        placeholder="Override"
        className="w-24 h-9"
        value={step.throughput_override ?? ''}
        onChange={(e) => onUpdate(index, 'throughput_override', e.target.value ? parseFloat(e.target.value) : null)}
      />
      <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="h-9 w-9 p-0 text-red-500">
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function QuoteBuilderPage() {
  return (
    <Suspense>
      <QuoteBuilderContent />
    </Suspense>
  )
}

function QuoteBuilderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  const editId = searchParams?.get('edit') ?? null
  const duplicateId = searchParams?.get('duplicate') ?? null
  const isEditMode = !!editId
  const isDuplicateMode = !!duplicateId

  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Reference data
  const [productTemplates, setProductTemplates] = useState<ProductTemplate[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [speciesList, setSpeciesList] = useState<{ id: number; name: string }[]>([])
  const [gradesList, setGradesList] = useState<string[]>([])
  const [marginDefaults, setMarginDefaults] = useState({ margin_1: 20, margin_2: 25, margin_3: 30 })

  // Step 1: Job Info
  const [customerName, setCustomerName] = useState('')
  const [jobReference, setJobReference] = useState('')
  const quoteDate = new Date().toISOString().split('T')[0]

  // Step 2: Product
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [productNameSnapshot, setProductNameSnapshot] = useState('')
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductSteps, setNewProductSteps] = useState<{ localId: string; machine_id: string; throughput_override: number | null }[]>([])
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)

  // Step 3: Species & Grade
  const [species, setSpecies] = useState('')
  const [grade, setGrade] = useState('')
  const [yieldPercent, setYieldPercent] = useState('')
  const [lumberCostPerBf, setLumberCostPerBf] = useState('')
  const [lumberPricingEntries, setLumberPricingEntries] = useState<LumberPricingEntry[]>([])

  // Step 4: Quantity & Dimensions
  const [unitType, setUnitType] = useState('LF')
  const [quantity, setQuantity] = useState('')
  const [widthInches, setWidthInches] = useState('')
  const [thicknessInches, setThicknessInches] = useState('')
  const [lengthInches, setLengthInches] = useState('')

  // Step 5: Machine Steps
  const [machineSteps, setMachineSteps] = useState<MachineStepState[]>([])

  // Step 6: Tooling Surcharges
  const [surcharges, setSurcharges] = useState<ToolingSurcharge[]>([])

  // Step 7: Margins
  const [margin1, setMargin1] = useState('20')
  const [margin2, setMargin2] = useState('25')
  const [margin3, setMargin3] = useState('30')
  const [selectedMarginCol, setSelectedMarginCol] = useState(0)

  // Step 8: Finalize
  const [notes, setNotes] = useState('')
  const [existingQuoteId, setExistingQuoteId] = useState<string | null>(null)

  // Dnd sensors for add product dialog
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ============================================================
  // Fetch reference data
  // ============================================================

  const fetchReferenceData = useCallback(async () => {
    try {
      const [tRes, mRes, sRes, dRes] = await Promise.all([
        fetch('/api/rnr/quote-product-templates'),
        fetch('/api/rnr/quote-machines'),
        fetch('/api/rnr/species'),
        fetch('/api/rnr/quote-defaults'),
      ])
      if (tRes.ok) setProductTemplates(await tRes.json())
      if (mRes.ok) setMachines(await mRes.json())
      if (sRes.ok) setSpeciesList(await sRes.json())
      if (dRes.ok) {
        const d = await dRes.json()
        setMarginDefaults(d)
        setMargin1(String(d.margin_1))
        setMargin2(String(d.margin_2))
        setMargin3(String(d.margin_3))
      }
    } catch {
      toast.error('Failed to load reference data')
    }
  }, [])

  useEffect(() => { fetchReferenceData() }, [fetchReferenceData])

  // Load existing quote for edit/duplicate
  useEffect(() => {
    const loadId = editId || duplicateId
    if (!loadId) return

    async function loadQuote() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/rnr/quotes/${loadId}`)
        if (!res.ok) throw new Error('Failed')
        const q = await res.json()

        setCustomerName(q.customer_name)
        setJobReference(q.job_reference || '')
        setSelectedTemplateId(q.product_template_id || '')
        setProductNameSnapshot(q.product_name_snapshot)
        setSpecies(q.species)
        setGrade(q.grade)
        setYieldPercent(String(q.yield_percent_used))
        setLumberCostPerBf(String(q.lumber_cost_per_bf))
        setUnitType(q.unit_type)
        setQuantity(String(q.quantity))
        setWidthInches(q.width_inches ? String(q.width_inches) : '')
        setThicknessInches(q.thickness_inches ? String(q.thickness_inches) : '')
        setLengthInches(q.length_inches ? String(q.length_inches) : '')
        setNotes(q.notes || '')
        setSurcharges(
          (q.tooling_surcharges || []).map((s: { description: string; amount: number }, i: number) => ({
            id: `s-${i}`,
            description: s.description,
            amount: s.amount,
          }))
        )
        if (q.margin_1_snapshot) setMargin1(String(q.margin_1_snapshot))
        if (q.margin_2_snapshot) setMargin2(String(q.margin_2_snapshot))
        if (q.margin_3_snapshot) setMargin3(String(q.margin_3_snapshot))

        setMachineSteps(
          (q.machine_steps || []).map((ms: {
            machine_name_snapshot: string
            rate_per_hour_snapshot: number
            setup_cost_snapshot: number
            throughput_unit_snapshot: string
            throughput_rate_snapshot: number
            step_order: number
          }) => ({
            localId: `ms-${ms.step_order}-${Date.now()}`,
            machine_name: ms.machine_name_snapshot,
            rate_per_hour: Number(ms.rate_per_hour_snapshot),
            setup_cost: Number(ms.setup_cost_snapshot),
            throughput_unit: ms.throughput_unit_snapshot,
            throughput_rate: Number(ms.throughput_rate_snapshot),
            step_order: ms.step_order,
          }))
        )

        if (editId) setExistingQuoteId(editId)

        const marginApplied = parseFloat(q.margin_percent_applied)
        const m1 = parseFloat(q.margin_1_snapshot)
        const m2 = parseFloat(q.margin_2_snapshot)
        const m3 = parseFloat(q.margin_3_snapshot)
        if (marginApplied === m2) setSelectedMarginCol(1)
        else if (marginApplied === m3) setSelectedMarginCol(2)
        else setSelectedMarginCol(0)
      } catch {
        toast.error('Failed to load quote')
      } finally {
        setIsLoading(false)
      }
    }
    loadQuote()
  }, [editId, duplicateId])

  // Fetch grades when species changes
  useEffect(() => {
    if (!species) { setGradesList([]); return }
    async function fetchGrades() {
      try {
        const res = await fetch(`/api/rnr/lumber-grades?species=${encodeURIComponent(species)}`)
        if (res.ok) setGradesList(await res.json())
      } catch { /* ignore */ }
    }
    fetchGrades()
  }, [species])

  // Auto-populate yield & lumber cost when species+grade selected
  useEffect(() => {
    if (!species || !grade || editId || duplicateId) return

    async function fetchLookups() {
      try {
        const [yRes, pRes] = await Promise.all([
          fetch(`/api/rnr/quote-yield-defaults?species=${encodeURIComponent(species)}&grade=${encodeURIComponent(grade)}`),
          fetch(`/api/rnr/lumber-pricing-lookup?species=${encodeURIComponent(species)}&grade=${encodeURIComponent(grade)}`),
        ])

        if (yRes.ok) {
          const yd = await yRes.json()
          if (yd && yd.yield_percent) setYieldPercent(String(yd.yield_percent))
          else setYieldPercent('')
        }

        if (pRes.ok) {
          const pd = await pRes.json()
          if (pd.average_cost) setLumberCostPerBf(String(pd.average_cost))
          else setLumberCostPerBf('')
          setLumberPricingEntries(pd.entries || [])
        }
      } catch { /* ignore */ }
    }
    fetchLookups()
  }, [species, grade, editId, duplicateId])

  // Load machine steps when template selected
  useEffect(() => {
    if (!selectedTemplateId || editId || duplicateId) return
    const template = productTemplates.find((t) => t.id === selectedTemplateId)
    if (!template) return

    setProductNameSnapshot(template.name)
    setMachineSteps(
      template.steps.map((s) => ({
        localId: `ms-${s.step_order}-${Date.now()}`,
        machine_name: s.machine_name,
        rate_per_hour: Number(s.rate_per_hour),
        setup_cost: Number(s.setup_cost),
        throughput_unit: s.throughput_unit,
        throughput_rate: s.throughput_override ? Number(s.throughput_override) : Number(s.throughput_rate),
        step_order: s.step_order,
      }))
    )
  }, [selectedTemplateId, productTemplates, editId, duplicateId])

  // ============================================================
  // Calculations
  // ============================================================

  const qtyNum = parseFloat(quantity) || 0
  const widthNum = parseFloat(widthInches) || 0
  const thickNum = parseFloat(thicknessInches) || 0
  const lengthNum = parseFloat(lengthInches) || 0
  const yieldNum = parseFloat(yieldPercent) || 0
  const lumberCostNum = parseFloat(lumberCostPerBf) || 0

  const finishedBF = useMemo(() => {
    if (widthNum > 0 && thickNum > 0 && lengthNum > 0 && qtyNum > 0) {
      return (widthNum / 12) * (thickNum / 12) * (lengthNum / 12) * qtyNum
    }
    if (unitType === 'BF') return qtyNum
    return 0
  }, [widthNum, thickNum, lengthNum, qtyNum, unitType])

  const roughBFRequired = useMemo(() => {
    if (yieldNum <= 0) return 0
    return finishedBF / (yieldNum / 100)
  }, [finishedBF, yieldNum])

  const lumberCostTotal = useMemo(() => roughBFRequired * lumberCostNum, [roughBFRequired, lumberCostNum])

  function calcTimeRequired(step: MachineStepState): number {
    if (step.throughput_rate <= 0) return 0
    if (step.throughput_unit === 'LF_HR') return qtyNum / step.throughput_rate
    if (step.throughput_unit === 'BF_HR') return roughBFRequired / step.throughput_rate
    if (step.throughput_unit === 'PIECES_HR') return qtyNum / step.throughput_rate
    return 0
  }

  function calcMachineCost(step: MachineStepState): number {
    const time = calcTimeRequired(step)
    return time * step.rate_per_hour + step.setup_cost
  }

  const totalMachineCost = useMemo(
    () => machineSteps.reduce((acc, s) => acc + calcMachineCost(s), 0),
    [machineSteps, qtyNum, roughBFRequired]
  )

  const totalSurcharges = useMemo(
    () => surcharges.reduce((acc, s) => acc + (s.amount || 0), 0),
    [surcharges]
  )

  const totalCost = lumberCostTotal + totalMachineCost + totalSurcharges

  function calcMarginPrice(marginPct: number): { price: number; perUnit: number; profit: number } {
    if (marginPct <= 0 || marginPct >= 100) return { price: 0, perUnit: 0, profit: 0 }
    const price = totalCost / (1 - marginPct / 100)
    const perUnit = qtyNum > 0 ? price / qtyNum : 0
    const profit = price - totalCost
    return { price, perUnit, profit }
  }

  const margins = [parseFloat(margin1) || 0, parseFloat(margin2) || 0, parseFloat(margin3) || 0]
  const marginResults = margins.map(calcMarginPrice)
  const selectedMarginPct = margins[selectedMarginCol]
  const finalPrice = marginResults[selectedMarginCol].price

  // ============================================================
  // Product Dialog handlers
  // ============================================================

  function openProductDialog() {
    setNewProductName('')
    setNewProductSteps([])
    setIsProductDialogOpen(true)
  }

  function handleProductDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setNewProductSteps((prev) => {
        const oldIdx = prev.findIndex((s) => s.localId === active.id)
        const newIdx = prev.findIndex((s) => s.localId === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  async function createProduct() {
    setIsCreatingProduct(true)
    try {
      const res = await fetch('/api/rnr/quote-product-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProductName,
          steps: newProductSteps.filter((s) => s.machine_id).map((s, i) => ({
            machine_id: s.machine_id,
            step_order: i + 1,
            throughput_override: s.throughput_override,
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const newTemplate = await res.json()
      setProductTemplates((prev) => [...prev, newTemplate])
      setSelectedTemplateId(newTemplate.id)
      setIsProductDialogOpen(false)
      toast.success('Product created')
    } catch { toast.error('Failed to create product') }
    finally { setIsCreatingProduct(false) }
  }

  // ============================================================
  // Save quote
  // ============================================================

  async function saveQuote(status: 'DRAFT' | 'SENT') {
    setIsSaving(true)
    try {
      const payload = {
        status,
        customer_name: customerName,
        job_reference: jobReference || null,
        product_template_id: selectedTemplateId || null,
        product_name_snapshot: productNameSnapshot,
        species,
        grade,
        quantity: qtyNum,
        unit_type: unitType,
        width_inches: widthNum || null,
        thickness_inches: thickNum || null,
        length_inches: lengthNum || null,
        yield_percent_used: yieldNum,
        lumber_cost_per_bf: lumberCostNum,
        rough_bf_required: roughBFRequired,
        lumber_cost_total: lumberCostTotal,
        tooling_surcharges: surcharges.map((s) => ({ description: s.description, amount: s.amount })),
        total_cost: totalCost,
        margin_percent_applied: selectedMarginPct,
        final_price: finalPrice,
        margin_1_snapshot: margins[0],
        margin_2_snapshot: margins[1],
        margin_3_snapshot: margins[2],
        notes: notes || null,
        machine_steps: machineSteps.map((ms, i) => ({
          machine_name_snapshot: ms.machine_name,
          rate_per_hour_snapshot: ms.rate_per_hour,
          setup_cost_snapshot: ms.setup_cost,
          throughput_unit_snapshot: ms.throughput_unit,
          throughput_rate_snapshot: ms.throughput_rate,
          time_required_hours: calcTimeRequired(ms),
          machine_cost_total: calcMachineCost(ms),
          step_order: i + 1,
        })),
      }

      let res
      if (existingQuoteId) {
        res = await fetch(`/api/rnr/quotes/${existingQuoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/rnr/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) throw new Error('Failed')
      const saved = await res.json()
      toast.success(`Quote ${saved.quote_number} saved`)
      router.push(`/dashboard/rnr-office/quotes/${saved.id}`)
    } catch {
      toast.error('Failed to save quote')
    } finally {
      setIsSaving(false)
    }
  }

  // ============================================================
  // Render helpers
  // ============================================================

  function canGoNext(): boolean {
    switch (currentStep) {
      case 0: return !!customerName
      case 1: return !!selectedTemplateId && !!productNameSnapshot
      case 2: return !!species && !!grade && !!yieldPercent && !!lumberCostPerBf
      case 3: return !!quantity && parseFloat(quantity) > 0
      case 4: return machineSteps.length > 0
      case 5: return true
      case 6: return selectedMarginPct > 0 && finalPrice > 0
      default: return true
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-12rem)]">
      {/* Main form area */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Calculator className="h-7 w-7 text-amber-600" />
            {isEditMode ? 'Edit Quote' : isDuplicateMode ? 'Duplicate Quote' : 'New Quote'}
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => i <= currentStep ? setCurrentStep(i) : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === currentStep
                  ? 'bg-amber-100 text-amber-800'
                  : i < currentStep
                  ? 'bg-green-50 text-green-700 cursor-pointer hover:bg-green-100'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < currentStep ? <Check size={12} /> : <span>{i + 1}</span>}
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {/* STEP 1: Job Info */}
          {currentStep === 0 && (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-lg font-semibold">Job Information</h2>
              <div>
                <Label>Customer Name *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter customer name" />
              </div>
              <div>
                <Label>Job Reference</Label>
                <Input value={jobReference} onChange={(e) => setJobReference(e.target.value)} placeholder="Optional reference" />
              </div>
              <div>
                <Label>Date</Label>
                <Input value={quoteDate} disabled className="bg-gray-50" />
              </div>
            </div>
          )}

          {/* STEP 2: Product Selection */}
          {currentStep === 1 && (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-lg font-semibold">Product Selection</h2>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>Product Template</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                    <SelectContent>
                      {productTemplates.filter((t) => t.active).map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} ({t.steps.length} steps)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={openProductDialog} className="gap-1 shrink-0">
                  <Plus size={14} /> Add New Product
                </Button>
              </div>
              {selectedTemplateId && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Machine Steps Preview:</p>
                  {machineSteps.map((s, i) => (
                    <div key={s.localId} className="text-sm text-gray-600 flex items-center gap-2 py-0.5">
                      <span className="text-gray-400">{i + 1}.</span>
                      <span>{s.machine_name}</span>
                      <span className="text-gray-400">({THROUGHPUT_LABELS[s.throughput_unit]}: {s.throughput_rate})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Species & Grade */}
          {currentStep === 2 && (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-lg font-semibold">Species & Grade</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Species</Label>
                  <Select value={species} onValueChange={(v) => { setSpecies(v); setGrade('') }}>
                    <SelectTrigger><SelectValue placeholder="Select species" /></SelectTrigger>
                    <SelectContent>
                      {speciesList.filter((s) => s.name).map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Grade</Label>
                  {gradesList.length > 0 ? (
                    <Select value={grade} onValueChange={setGrade}>
                      <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>
                        {gradesList.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Enter grade" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Yield % {yieldPercent && <span className="text-gray-400 font-normal">(auto-filled)</span>}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={yieldPercent}
                    onChange={(e) => setYieldPercent(e.target.value)}
                    placeholder="e.g. 65"
                  />
                </div>
                <div>
                  <Label>Lumber Cost per BF ($) {lumberCostPerBf && <span className="text-gray-400 font-normal">(auto-filled)</span>}</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={lumberCostPerBf}
                    onChange={(e) => setLumberCostPerBf(e.target.value)}
                    placeholder="e.g. 1.25"
                  />
                  {lumberPricingEntries.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Based on {lumberPricingEntries.length} entr{lumberPricingEntries.length === 1 ? 'y' : 'ies'}
                      {' '}(dates: {lumberPricingEntries.map((e) => new Date(e.date).toLocaleDateString()).join(', ')})
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Quantity & Dimensions */}
          {currentStep === 3 && (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-lg font-semibold">Quantity & Dimensions</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unit Type</Label>
                  <Select value={unitType} onValueChange={setUnitType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LF">Lineal Feet</SelectItem>
                      <SelectItem value="BF">Board Feet</SelectItem>
                      <SelectItem value="PIECES">Pieces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Width (inches)</Label>
                  <Input type="number" step="0.001" value={widthInches} onChange={(e) => setWidthInches(e.target.value)} />
                </div>
                <div>
                  <Label>Thickness (inches)</Label>
                  <Input type="number" step="0.001" value={thicknessInches} onChange={(e) => setThicknessInches(e.target.value)} />
                </div>
                <div>
                  <Label>Length (inches)</Label>
                  <Input type="number" step="0.001" value={lengthInches} onChange={(e) => setLengthInches(e.target.value)} />
                </div>
              </div>
              {finishedBF > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Finished BF:</span><span className="font-medium">{finishedBF.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Rough BF Required:</span><span className="font-medium">{roughBFRequired.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Lumber Cost Total:</span><span className="font-semibold">${lumberCostTotal.toFixed(2)}</span></div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Machine Steps */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Machine Steps</h2>
              <p className="text-sm text-gray-500">Edit values below for this quote only — template values are not affected.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Machine</th>
                      <th className="text-right px-3 py-2">Rate/Hr</th>
                      <th className="text-right px-3 py-2">Setup</th>
                      <th className="text-left px-3 py-2">Unit</th>
                      <th className="text-right px-3 py-2">Throughput</th>
                      <th className="text-right px-3 py-2">Time (hrs)</th>
                      <th className="text-right px-3 py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {machineSteps.map((ms, i) => {
                      const time = calcTimeRequired(ms)
                      const cost = calcMachineCost(ms)
                      return (
                        <tr key={ms.localId}>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2">
                            <Input value={ms.machine_name} className="h-8 w-40"
                              onChange={(e) => setMachineSteps((prev) => prev.map((s, j) => j === i ? { ...s, machine_name: e.target.value } : s))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" step="0.01" value={ms.rate_per_hour} className="h-8 w-24 text-right"
                              onChange={(e) => setMachineSteps((prev) => prev.map((s, j) => j === i ? { ...s, rate_per_hour: parseFloat(e.target.value) || 0 } : s))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" step="0.01" value={ms.setup_cost} className="h-8 w-24 text-right"
                              onChange={(e) => setMachineSteps((prev) => prev.map((s, j) => j === i ? { ...s, setup_cost: parseFloat(e.target.value) || 0 } : s))}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{THROUGHPUT_LABELS[ms.throughput_unit] || ms.throughput_unit}</td>
                          <td className="px-3 py-2">
                            <Input type="number" step="0.1" value={ms.throughput_rate} className="h-8 w-24 text-right"
                              onChange={(e) => setMachineSteps((prev) => prev.map((s, j) => j === i ? { ...s, throughput_rate: parseFloat(e.target.value) || 0 } : s))}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{time.toFixed(3)}</td>
                          <td className="px-3 py-2 text-right font-mono font-medium">${cost.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={7} className="px-3 py-2 text-right">Machine Cost Subtotal:</td>
                      <td className="px-3 py-2 text-right font-mono">${totalMachineCost.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* STEP 6: Tooling Surcharges */}
          {currentStep === 5 && (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-lg font-semibold">Tooling Surcharges</h2>
              <p className="text-sm text-gray-500">Add any additional tooling or setup charges.</p>
              {surcharges.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Input
                    value={s.description}
                    onChange={(e) => setSurcharges((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    placeholder="Description"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={s.amount || ''}
                    onChange={(e) => setSurcharges((prev) => prev.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                    placeholder="$0.00"
                    className="w-28"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setSurcharges((prev) => prev.filter((_, j) => j !== i))} className="text-red-500">
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setSurcharges((prev) => [...prev, { id: `sc-${Date.now()}`, description: '', amount: 0 }])}
              >
                <Plus size={14} /> Add Surcharge
              </Button>
              {surcharges.length > 0 && (
                <div className="text-sm font-medium text-right pt-2 border-t">
                  Surcharge Subtotal: <span className="font-mono">${totalSurcharges.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 7: Cost Summary & Margin Comparison */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Cost Summary & Margin Comparison</h2>

              {/* Cost Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm max-w-lg">
                <div className="font-semibold text-gray-900 mb-2">Internal Cost Breakdown</div>
                <div className="flex justify-between">
                  <span>Lumber ({roughBFRequired.toFixed(2)} BF x ${lumberCostNum.toFixed(4)}/BF)</span>
                  <span className="font-mono">${lumberCostTotal.toFixed(2)}</span>
                </div>
                {machineSteps.map((ms, i) => (
                  <div key={ms.localId} className="flex justify-between">
                    <span>{ms.machine_name} ({calcTimeRequired(ms).toFixed(3)} hrs)</span>
                    <span className="font-mono">${calcMachineCost(ms).toFixed(2)}</span>
                  </div>
                ))}
                {surcharges.filter((s) => s.amount > 0).map((s, i) => (
                  <div key={s.id} className="flex justify-between">
                    <span>{s.description || 'Surcharge'}</span>
                    <span className="font-mono">${s.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-bold text-base">
                  <span>Total Cost</span>
                  <span className="font-mono">${totalCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Margin Comparison */}
              <div>
                <div className="font-semibold text-gray-900 mb-3">Margin Comparison</div>
                <div className="grid grid-cols-3 gap-4">
                  {margins.map((m, i) => {
                    const r = marginResults[i]
                    const isSelected = selectedMarginCol === i
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedMarginCol(i)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          isSelected ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={i === 0 ? margin1 : i === 1 ? margin2 : margin3}
                            onChange={(e) => {
                              const v = e.target.value
                              if (i === 0) setMargin1(v)
                              else if (i === 1) setMargin2(v)
                              else setMargin3(v)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-20 h-8 text-right font-mono"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Price:</span>
                            <span className="font-semibold font-mono">${r.price.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Per {UNIT_LABELS[unitType] || 'unit'}:</span>
                            <span className="font-mono">${r.perUnit.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Profit:</span>
                            <span className="font-mono text-green-600">${r.profit.toFixed(2)}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-2 text-center">
                            <Badge className="bg-amber-600">Selected</Badge>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Finalize */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Finalize Quote</h2>
              <div className="max-w-lg">
                <Label>Internal Notes (not shown on customer copy)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm max-w-lg">
                <div className="font-semibold text-gray-900 mb-2">Quote Summary</div>
                <div className="flex justify-between"><span>Customer:</span><span className="font-medium">{customerName}</span></div>
                {jobReference && <div className="flex justify-between"><span>Job Ref:</span><span>{jobReference}</span></div>}
                <div className="flex justify-between"><span>Product:</span><span>{productNameSnapshot}</span></div>
                <div className="flex justify-between"><span>Species / Grade:</span><span>{species} / {grade}</span></div>
                <div className="flex justify-between"><span>Quantity:</span><span>{qtyNum} {UNIT_LABELS[unitType]}</span></div>
                <div className="flex justify-between border-t pt-2"><span>Total Cost:</span><span className="font-mono">${totalCost.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Margin:</span><span>{selectedMarginPct}%</span></div>
                <div className="flex justify-between font-bold text-base"><span>Final Price:</span><span className="font-mono">${finalPrice.toFixed(2)}</span></div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => saveQuote('DRAFT')}
                  disabled={isSaving}
                  variant="outline"
                  className="gap-2"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  Save as Draft
                </Button>
                <Button
                  onClick={() => saveQuote('SENT')}
                  disabled={isSaving}
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Save & Mark Sent
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 7 && (
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft size={16} /> Back
            </Button>
            <Button
              onClick={() => setCurrentStep((s) => Math.min(7, s + 1))}
              disabled={!canGoNext()}
              className="gap-1 bg-amber-600 hover:bg-amber-700"
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Right-side Summary Panel */}
      <div className="w-72 shrink-0 hidden xl:block">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sticky top-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Live Summary</h3>
          <div className="space-y-1.5 text-xs">
            {customerName && (
              <div className="flex justify-between"><span className="text-gray-500">Customer:</span><span className="font-medium truncate ml-2">{customerName}</span></div>
            )}
            {productNameSnapshot && (
              <div className="flex justify-between"><span className="text-gray-500">Product:</span><span className="font-medium truncate ml-2">{productNameSnapshot}</span></div>
            )}
            {species && (
              <div className="flex justify-between"><span className="text-gray-500">Species:</span><span>{species}{grade ? ` / ${grade}` : ''}</span></div>
            )}
            {qtyNum > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Qty:</span><span>{qtyNum} {unitType}</span></div>
            )}
            {yieldNum > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Yield:</span><span>{yieldNum}%</span></div>
            )}
            {roughBFRequired > 0 && (
              <>
                <div className="border-t my-1" />
                <div className="flex justify-between"><span className="text-gray-500">Rough BF:</span><span className="font-mono">{roughBFRequired.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Lumber:</span><span className="font-mono">${lumberCostTotal.toFixed(2)}</span></div>
              </>
            )}
            {totalMachineCost > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Machines:</span><span className="font-mono">${totalMachineCost.toFixed(2)}</span></div>
            )}
            {totalSurcharges > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Surcharges:</span><span className="font-mono">${totalSurcharges.toFixed(2)}</span></div>
            )}
            {totalCost > 0 && (
              <>
                <div className="border-t my-1" />
                <div className="flex justify-between font-semibold"><span>Total Cost:</span><span className="font-mono">${totalCost.toFixed(2)}</span></div>
              </>
            )}
            {finalPrice > 0 && selectedMarginPct > 0 && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">Margin:</span><span>{selectedMarginPct}%</span></div>
                <div className="flex justify-between font-bold text-sm text-amber-700"><span>Final Price:</span><span className="font-mono">${finalPrice.toFixed(2)}</span></div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product Name</Label>
              <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-2 block">Machine Steps (drag to reorder)</Label>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProductDragEnd}>
                <SortableContext items={newProductSteps.map((s) => s.localId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {newProductSteps.map((step, i) => (
                      <SortableDialogStep
                        key={step.localId}
                        step={step}
                        index={i}
                        machines={machines}
                        onUpdate={(idx, field, val) =>
                          setNewProductSteps((prev) => prev.map((s, j) => j === idx ? { ...s, [field]: val } : s))
                        }
                        onRemove={(idx) => setNewProductSteps((prev) => prev.filter((_, j) => j !== idx))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1"
                onClick={() => setNewProductSteps((prev) => [...prev, { localId: `ns-${Date.now()}`, machine_id: '', throughput_override: null }])}
              >
                <Plus size={14} /> Add Step
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
            <Button onClick={createProduct} disabled={isCreatingProduct || !newProductName} className="bg-amber-600 hover:bg-amber-700">
              {isCreatingProduct ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Save Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
