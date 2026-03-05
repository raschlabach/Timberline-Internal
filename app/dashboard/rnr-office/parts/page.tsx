'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { Search, Upload, Plus, ChevronLeft, ChevronRight, X, Boxes, Pencil, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Part {
  id: number
  rnr_part_number: string | null
  customer_part_number: string | null
  description: string | null
  thickness: number | null
  width: number | null
  length: number | null
  board_feet: number | null
  lineal_feet: number | null
  layup_width: number | null
  layup_length: number | null
  pieces_per_layup: number | null
  item_class: string | null
  qb_item_code: string | null
  price: number | null
  is_active: boolean
  customer_id: number | null
  species_id: number | null
  product_type_id: number | null
  profile_id: number | null
  customer_name: string | null
  species_name: string | null
  product_type_name: string | null
  profile_name: string | null
}

interface Species { id: number; name: string; code: string }
interface ProductType { id: number; name: string; code: string }
interface Profile { id: number; name: string }
interface Customer { id: number; customer_name: string }

interface PartFormData {
  rnr_part_number: string
  customer_part_number: string
  customer_id: string
  description: string
  species_id: string
  product_type_id: string
  profile_id: string
  thickness: string
  width: string
  length: string
  board_feet: string
  lineal_feet: string
  layup_width: string
  layup_length: string
  pieces_per_layup: string
  item_class: string
  qb_item_code: string
  price: string
  is_active: boolean
}

function emptyForm(): PartFormData {
  return {
    rnr_part_number: '', customer_part_number: '', customer_id: '', description: '',
    species_id: '', product_type_id: '', profile_id: '',
    thickness: '', width: '', length: '', board_feet: '', lineal_feet: '',
    layup_width: '', layup_length: '', pieces_per_layup: '',
    item_class: '', qb_item_code: '', price: '', is_active: true,
  }
}

function partToForm(p: Part): PartFormData {
  return {
    rnr_part_number: p.rnr_part_number || '',
    customer_part_number: p.customer_part_number || '',
    customer_id: p.customer_id?.toString() || '',
    description: p.description || '',
    species_id: p.species_id?.toString() || '',
    product_type_id: p.product_type_id?.toString() || '',
    profile_id: p.profile_id?.toString() || '',
    thickness: p.thickness?.toString() || '',
    width: p.width?.toString() || '',
    length: p.length?.toString() || '',
    board_feet: p.board_feet?.toString() || '',
    lineal_feet: p.lineal_feet?.toString() || '',
    layup_width: p.layup_width?.toString() || '',
    layup_length: p.layup_length?.toString() || '',
    pieces_per_layup: p.pieces_per_layup?.toString() || '',
    item_class: p.item_class || '',
    qb_item_code: p.qb_item_code || '',
    price: p.price?.toString() || '',
    is_active: p.is_active,
  }
}

function formToBody(f: PartFormData) {
  return {
    rnr_part_number: f.rnr_part_number || null,
    customer_part_number: f.customer_part_number || null,
    customer_id: f.customer_id ? parseInt(f.customer_id) : null,
    description: f.description || null,
    species_id: f.species_id ? parseInt(f.species_id) : null,
    product_type_id: f.product_type_id ? parseInt(f.product_type_id) : null,
    profile_id: f.profile_id ? parseInt(f.profile_id) : null,
    thickness: f.thickness ? parseFloat(f.thickness) : null,
    width: f.width ? parseFloat(f.width) : null,
    length: f.length ? parseFloat(f.length) : null,
    board_feet: f.board_feet ? parseFloat(f.board_feet) : null,
    lineal_feet: f.lineal_feet ? parseFloat(f.lineal_feet) : null,
    layup_width: f.layup_width ? parseFloat(f.layup_width) : null,
    layup_length: f.layup_length ? parseFloat(f.layup_length) : null,
    pieces_per_layup: f.pieces_per_layup ? parseInt(f.pieces_per_layup) : null,
    item_class: f.item_class || null,
    qb_item_code: f.qb_item_code || null,
    price: f.price ? parseFloat(f.price) : null,
    is_active: f.is_active,
  }
}

function calcBF(thickness: string, width: string, length: string): string {
  const t = parseFloat(thickness), w = parseFloat(width), l = parseFloat(length)
  if (!t || !w || !l) return ''
  return ((t * w * l) / 144).toFixed(4)
}

function calcLF(length: string): string {
  const l = parseFloat(length)
  if (!l) return ''
  return (l / 12).toFixed(4)
}

export default function PartsListPage() {
  const { data: session } = useSession()

  const [parts, setParts] = useState<Part[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalParts, setTotalParts] = useState(0)

  // Filter options derived from parts data (only values that exist in parts)
  const [filterCustomers, setFilterCustomers] = useState<Customer[]>([])
  const [filterSpeciesList, setFilterSpeciesList] = useState<Species[]>([])
  const [filterProductTypesList, setFilterProductTypesList] = useState<ProductType[]>([])

  // Full reference lists for edit/new part forms
  const [species, setSpecies] = useState<Species[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Tiered search state
  const [lockedCustomer, setLockedCustomer] = useState<Customer | null>(null)
  const [lockedSpecies, setLockedSpecies] = useState<Species | null>(null)
  const [lockedProduct, setLockedProduct] = useState<ProductType | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [filterActive, setFilterActive] = useState('true')

  const [selectedPart, setSelectedPart] = useState<Part | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<PartFormData>(emptyForm())
  const [isSaving, setIsSaving] = useState(false)

  const [isNewPartOpen, setIsNewPartOpen] = useState(false)
  const [newForm, setNewForm] = useState<PartFormData>(emptyForm())
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, lockedCustomer, lockedSpecies, lockedProduct, filterActive])

  const fetchParts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (lockedCustomer) params.set('customer_id', lockedCustomer.id.toString())
      if (lockedSpecies) params.set('species_id', lockedSpecies.id.toString())
      if (lockedProduct) params.set('product_type_id', lockedProduct.id.toString())
      if (filterActive !== 'all') params.set('is_active', filterActive)

      const res = await fetch(`/api/rnr/parts?${params}`)
      const data = await res.json()
      if (res.ok) {
        setParts(data.parts)
        setTotalPages(data.totalPages)
        setTotalParts(data.total)
        if (data.filters) {
          setFilterCustomers(data.filters.customers || [])
          setFilterSpeciesList(data.filters.species || [])
          setFilterProductTypesList(data.filters.product_types || [])
        }
      }
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }, [page, debouncedSearch, lockedCustomer, lockedSpecies, lockedProduct, filterActive])

  useEffect(() => { fetchParts() }, [fetchParts])

  useEffect(() => {
    async function fetchFormRefs() {
      try {
        const [sRes, ptRes, prRes, cRes] = await Promise.all([
          fetch('/api/rnr/species'), fetch('/api/rnr/product-types'),
          fetch('/api/rnr/profiles'), fetch('/api/customers'),
        ])
        if (sRes.ok) setSpecies(await sRes.json())
        if (ptRes.ok) setProductTypes(await ptRes.json())
        if (prRes.ok) setProfiles(await prRes.json())
        if (cRes.ok) {
          const data = await cRes.json()
          setCustomers(Array.isArray(data) ? data : data.customers || [])
        }
      } catch { /* ignore */ }
    }
    fetchFormRefs()
  }, [])

  function formatDim(val: number | null): string {
    if (val === null || val === undefined) return '-'
    return val.toString()
  }

  const hasActiveFilters = !!lockedCustomer || !!lockedSpecies || !!lockedProduct || filterActive !== 'true' || debouncedSearch !== ''

  function clearFilters() {
    setSearch(''); setLockedCustomer(null); setLockedSpecies(null); setLockedProduct(null); setFilterActive('true')
  }

  function getCurrentTier(): 'customer' | 'species' | 'product' | 'text' {
    if (!lockedCustomer) return 'customer'
    if (!lockedSpecies) return 'species'
    if (!lockedProduct) return 'product'
    return 'text'
  }

  function getSuggestions(): { id: number; name: string; type: string }[] {
    const tier = getCurrentTier()
    const q = search.toLowerCase().trim()
    if (tier === 'customer') {
      return filterCustomers
        .filter(c => !q || c.customer_name.toLowerCase().includes(q))
        .slice(0, 8)
        .map(c => ({ id: c.id, name: c.customer_name, type: 'customer' }))
    }
    if (tier === 'species') {
      return filterSpeciesList
        .filter(s => !q || s.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map(s => ({ id: s.id, name: s.name, type: 'species' }))
    }
    if (tier === 'product') {
      return filterProductTypesList
        .filter(pt => !q || pt.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map(pt => ({ id: pt.id, name: pt.name, type: 'product' }))
    }
    return []
  }

  function selectSuggestion(item: { id: number; name: string; type: string }) {
    if (item.type === 'customer') {
      const c = filterCustomers.find(c => c.id === item.id)
      if (c) setLockedCustomer(c)
    } else if (item.type === 'species') {
      const s = filterSpeciesList.find(s => s.id === item.id)
      if (s) setLockedSpecies(s)
    } else if (item.type === 'product') {
      const pt = filterProductTypesList.find(pt => pt.id === item.id)
      if (pt) setLockedProduct(pt)
    }
    setSearch('')
    setShowSuggestions(false)
    searchInputRef.current?.focus()
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && search === '') {
      if (lockedProduct) { setLockedProduct(null) }
      else if (lockedSpecies) { setLockedSpecies(null) }
      else if (lockedCustomer) { setLockedCustomer(null) }
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const suggestions = getSuggestions()
  const tier = getCurrentTier()
  const tierLabels: Record<string, string> = {
    customer: 'Search customers...',
    species: 'Search species...',
    product: 'Search product types...',
    text: 'Search parts...',
  }

  function openEdit() {
    if (!selectedPart) return
    setEditForm(partToForm(selectedPart))
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditForm(emptyForm())
  }

  async function saveEdit() {
    if (!selectedPart) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/rnr/parts/${selectedPart.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToBody(editForm)),
      })
      if (res.ok) {
        toast.success('Part updated')
        setIsEditing(false)
        setSelectedPart(null)
        fetchParts()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save')
      }
    } catch { toast.error('Failed to save') }
    finally { setIsSaving(false) }
  }

  async function toggleActive() {
    if (!selectedPart) return
    setIsSaving(true)
    try {
      const body = formToBody(partToForm(selectedPart))
      body.is_active = !selectedPart.is_active
      const res = await fetch(`/api/rnr/parts/${selectedPart.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(selectedPart.is_active ? 'Part deactivated' : 'Part reactivated')
        setSelectedPart(null)
        fetchParts()
      }
    } catch { toast.error('Failed to update') }
    finally { setIsSaving(false) }
  }

  function updateNewFormDimensions(field: string, value: string, form: PartFormData, setter: (f: PartFormData) => void) {
    const updated = { ...form, [field]: value }
    if (['thickness', 'width', 'length'].includes(field)) {
      updated.board_feet = calcBF(updated.thickness, updated.width, updated.length)
      updated.lineal_feet = calcLF(updated.length)
    }
    setter(updated)
  }

  async function createPart() {
    setIsCreating(true)
    try {
      const res = await fetch('/api/rnr/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToBody(newForm)),
      })
      if (res.ok) {
        toast.success('Part created')
        setIsNewPartOpen(false)
        setNewForm(emptyForm())
        fetchParts()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create part')
      }
    } catch { toast.error('Failed to create part') }
    finally { setIsCreating(false) }
  }

  function PartFormFields({ form, setForm, autoCalc = false }: { form: PartFormData; setForm: (f: PartFormData) => void; autoCalc?: boolean }) {
    function handleDimChange(field: string, value: string) {
      if (autoCalc) {
        updateNewFormDimensions(field, value, form, setForm)
      } else {
        setForm({ ...form, [field]: value })
      }
    }

    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">RNR Part #</Label>
            <Input value={form.rnr_part_number} onChange={e => setForm({ ...form, rnr_part_number: e.target.value })} className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">Customer Part #</Label>
            <Input value={form.customer_part_number} onChange={e => setForm({ ...form, customer_part_number: e.target.value })} className="font-mono text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Customer</Label>
            <Select value={form.customer_id || 'none'} onValueChange={v => setForm({ ...form, customer_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- None --</SelectItem>
                {customers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.customer_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Price</Label>
            <Input type="number" step="0.0001" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Description</Label>
          <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Species</Label>
            <Select value={form.species_id || 'none'} onValueChange={v => setForm({ ...form, species_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- None --</SelectItem>
                {species.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Product Type</Label>
            <Select value={form.product_type_id || 'none'} onValueChange={v => setForm({ ...form, product_type_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- None --</SelectItem>
                {productTypes.map(pt => <SelectItem key={pt.id} value={pt.id.toString()}>{pt.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Profile</Label>
            <Select value={form.profile_id || 'none'} onValueChange={v => setForm({ ...form, profile_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- None --</SelectItem>
                {profiles.map(pr => <SelectItem key={pr.id} value={pr.id.toString()}>{pr.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">Thickness</Label>
            <Input type="number" step="any" value={form.thickness} onChange={e => handleDimChange('thickness', e.target.value)} className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">Width</Label>
            <Input type="number" step="any" value={form.width} onChange={e => handleDimChange('width', e.target.value)} className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">Length</Label>
            <Input type="number" step="any" value={form.length} onChange={e => handleDimChange('length', e.target.value)} className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">Board Ft {autoCalc && <span className="text-amber-600">(auto)</span>}</Label>
            <Input type="number" step="any" value={form.board_feet} onChange={e => setForm({ ...form, board_feet: e.target.value })} className="font-mono text-sm" readOnly={autoCalc} />
          </div>
          <div>
            <Label className="text-xs">Lineal Ft {autoCalc && <span className="text-amber-600">(auto)</span>}</Label>
            <Input type="number" step="any" value={form.lineal_feet} onChange={e => setForm({ ...form, lineal_feet: e.target.value })} className="font-mono text-sm" readOnly={autoCalc} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Layup Width</Label>
            <Input type="number" step="any" value={form.layup_width} onChange={e => setForm({ ...form, layup_width: e.target.value })} className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">Layup Length</Label>
            <Input type="number" step="any" value={form.layup_length} onChange={e => setForm({ ...form, layup_length: e.target.value })} className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">Pcs / Layup</Label>
            <Input type="number" value={form.pieces_per_layup} onChange={e => setForm({ ...form, pieces_per_layup: e.target.value })} className="font-mono text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Item Class</Label>
            <Input value={form.item_class} onChange={e => setForm({ ...form, item_class: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">QB Item Code</Label>
            <Input value={form.qb_item_code} onChange={e => setForm({ ...form, qb_item_code: e.target.value })} className="font-mono text-sm" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Boxes className="h-7 w-7 text-amber-600" />
            Master Parts List
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalParts.toLocaleString()} parts {filterActive === 'true' ? '(active)' : filterActive === 'false' ? '(inactive)' : '(all)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="text-xs text-gray-500"
            onClick={async () => {
              if (!confirm('Remove "AF-" prefix from all Archbold part numbers?')) return
              try {
                const res = await fetch('/api/admin/fix-archbold-parts', { method: 'POST' })
                const data = await res.json()
                if (res.ok) {
                  toast.success(`Fixed ${data.rnr_part_numbers_fixed || 0} RNR part #s and ${data.customer_part_numbers_fixed || 0} customer part #s`)
                  fetchParts()
                } else { toast.error(data.error || 'Failed') }
              } catch { toast.error('Failed') }
            }}>Fix Archbold AF-</Button>
          <Link href="/dashboard/rnr-office/parts/import">
            <Button variant="outline" className="gap-2"><Upload size={16} />Import CSV</Button>
          </Link>
          <Button className="gap-2 bg-amber-600 hover:bg-amber-700" onClick={() => { setNewForm(emptyForm()); setIsNewPartOpen(true) }}>
            <Plus size={16} />New Part
          </Button>
        </div>
      </div>

      {/* Smart Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div
              className="flex items-center flex-wrap gap-1.5 border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-amber-300 focus-within:border-amber-400 transition-all cursor-text min-h-[40px]"
              onClick={() => searchInputRef.current?.focus()}
            >
              <Search className="h-4 w-4 text-gray-400 shrink-0" />

              {lockedCustomer && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-md">
                  {lockedCustomer.customer_name}
                  <button type="button" onClick={e => { e.stopPropagation(); setLockedCustomer(null); setLockedSpecies(null); setLockedProduct(null); setSearch('') }} className="hover:text-amber-900">
                    <X size={11} />
                  </button>
                  <span className="text-amber-400 ml-0.5">›</span>
                </span>
              )}

              {lockedSpecies && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-md">
                  {lockedSpecies.name}
                  <button type="button" onClick={e => { e.stopPropagation(); setLockedSpecies(null); setLockedProduct(null); setSearch('') }} className="hover:text-green-900">
                    <X size={11} />
                  </button>
                  <span className="text-green-400 ml-0.5">›</span>
                </span>
              )}

              {lockedProduct && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-md">
                  {lockedProduct.name}
                  <button type="button" onClick={e => { e.stopPropagation(); setLockedProduct(null); setSearch('') }} className="hover:text-blue-900">
                    <X size={11} />
                  </button>
                  <span className="text-blue-400 ml-0.5">›</span>
                </span>
              )}

              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={handleSearchKeyDown}
                placeholder={tierLabels[tier]}
                className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
              />
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[260px] overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  {tier === 'customer' ? 'Customers' : tier === 'species' ? 'Species' : 'Product Types'}
                </div>
                {suggestions.map(s => (
                  <button
                    key={`${s.type}-${s.id}`}
                    type="button"
                    onMouseDown={() => selectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between"
                  >
                    <span className="text-gray-800">{s.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      s.type === 'customer' ? 'bg-amber-50 text-amber-600' :
                      s.type === 'species' ? 'bg-green-50 text-green-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {s.type === 'customer' ? 'Customer' : s.type === 'species' ? 'Species' : 'Product'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={filterActive === 'true' ? 'default' : 'outline'}
              size="sm" className={`text-xs h-8 ${filterActive === 'true' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
              onClick={() => setFilterActive(filterActive === 'true' ? 'all' : 'true')}
            >
              {filterActive === 'true' ? 'Active Only' : 'All Status'}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-gray-500 h-8"><X size={14} />Clear</Button>
            )}
          </div>
        </div>

        {(lockedCustomer || lockedSpecies || lockedProduct) && (
          <p className="text-[11px] text-gray-400 mt-2 pl-1">
            Filtering: {[lockedCustomer?.customer_name, lockedSpecies?.name, lockedProduct?.name].filter(Boolean).join(' › ')}
            {search ? ` › "${search}"` : ''} — Backspace to remove last filter
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Part #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Description</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Species</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Profile</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Thick</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Width</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Length</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">BF</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Price</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">Loading parts...</td></tr>
              ) : parts.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                  {hasActiveFilters ? 'No parts match your filters' : 'No parts found. Import parts from QuickBooks to get started.'}
                </td></tr>
              ) : parts.map(part => (
                <tr key={part.id} onClick={() => { setSelectedPart(part); setIsEditing(false) }}
                  className="border-b border-gray-100 hover:bg-amber-50/50 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-900">{part.rnr_part_number || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-[150px] truncate">{part.customer_name || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[250px] truncate">{part.description || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{part.species_name || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{part.product_type_name || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[120px] truncate">{part.profile_name || '-'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">{formatDim(part.thickness)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">{formatDim(part.width)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">{formatDim(part.length)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">{formatDim(part.board_feet)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-700 font-medium">{part.price ? `$${Number(part.price).toFixed(2)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} ({totalParts.toLocaleString()} parts)</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={16} /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={16} /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Part Detail / Edit Dialog */}
      <Dialog open={!!selectedPart} onOpenChange={() => { setSelectedPart(null); setIsEditing(false) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? 'Edit Part' : 'Part Detail'}
              {selectedPart && !selectedPart.is_active && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">Inactive</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedPart && !isEditing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">RNR Part #</label><p className="font-mono text-sm font-medium">{selectedPart.rnr_part_number || '-'}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Part #</label><p className="font-mono text-sm font-medium">{selectedPart.customer_part_number || '-'}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</label><p className="text-sm">{selectedPart.customer_name || '-'}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">QB Item Code</label><p className="font-mono text-sm">{selectedPart.qb_item_code || '-'}</p></div>
              </div>
              <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</label><p className="text-sm">{selectedPart.description || '-'}</p></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Species</label><p className="text-sm">{selectedPart.species_name || '-'}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Product Type</label><p className="text-sm">{selectedPart.product_type_name || '-'}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</label><p className="text-sm">{selectedPart.profile_name || '-'}</p></div>
              </div>
              <div className="grid grid-cols-5 gap-4 bg-gray-50 rounded-lg p-3">
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Thickness</label><p className="font-mono text-sm">{formatDim(selectedPart.thickness)}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Width</label><p className="font-mono text-sm">{formatDim(selectedPart.width)}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Length</label><p className="font-mono text-sm">{formatDim(selectedPart.length)}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Board Ft</label><p className="font-mono text-sm">{formatDim(selectedPart.board_feet)}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Lineal Ft</label><p className="font-mono text-sm">{formatDim(selectedPart.lineal_feet)}</p></div>
              </div>
              {(selectedPart.layup_width || selectedPart.layup_length || selectedPart.pieces_per_layup) && (
                <div className="grid grid-cols-3 gap-4 bg-amber-50 rounded-lg p-3">
                  <div><label className="text-xs font-medium text-amber-700 uppercase tracking-wider">Layup Width</label><p className="font-mono text-sm">{formatDim(selectedPart.layup_width)}</p></div>
                  <div><label className="text-xs font-medium text-amber-700 uppercase tracking-wider">Layup Length</label><p className="font-mono text-sm">{formatDim(selectedPart.layup_length)}</p></div>
                  <div><label className="text-xs font-medium text-amber-700 uppercase tracking-wider">Pcs / Layup</label><p className="font-mono text-sm">{selectedPart.pieces_per_layup || '-'}</p></div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Price</label><p className="text-lg font-semibold text-gray-900">{selectedPart.price ? `$${Number(selectedPart.price).toFixed(4)}` : 'Not set'}</p></div>
                <div className="text-right"><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Item Class</label><p className="font-mono text-sm">{selectedPart.item_class || '-'}</p></div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleActive} disabled={isSaving}>
                  {selectedPart.is_active ? <><ToggleRight size={14} />Deactivate</> : <><ToggleLeft size={14} />Reactivate</>}
                </Button>
                <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm" onClick={openEdit}>
                  <Pencil size={14} />Edit Part
                </Button>
              </div>
            </div>
          )}

          {selectedPart && isEditing && (
            <>
              <PartFormFields form={editForm} setForm={setEditForm} />
              <DialogFooter className="gap-2 pt-4 border-t">
                <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>Cancel</Button>
                <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={saveEdit} disabled={isSaving}>
                  {isSaving ? <><Loader2 size={14} className="animate-spin" />Saving...</> : <><Save size={14} />Save Changes</>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Part Dialog */}
      <Dialog open={isNewPartOpen} onOpenChange={setIsNewPartOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Part</DialogTitle>
          </DialogHeader>
          <PartFormFields form={newForm} setForm={setNewForm} autoCalc />
          <DialogFooter className="gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsNewPartOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={createPart} disabled={isCreating}>
              {isCreating ? <><Loader2 size={14} className="animate-spin" />Creating...</> : <><Plus size={14} />Create Part</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
