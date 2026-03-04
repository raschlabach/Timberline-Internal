'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Plus, Trash2, Loader2, AlertTriangle, Save,
  ClipboardList, Sparkles, FileUp, FileText, X, Eye, EyeOff,
  RefreshCw, BookmarkPlus, MessageSquare
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Customer { id: number; customer_name: string }
interface Species { id: number; name: string; code: string }
interface ProductType { id: number; name: string; code: string }
interface Profile { id: number; name: string }

interface PartResult {
  id: number
  rnr_part_number: string | null
  customer_part_number: string | null
  description: string | null
  thickness: number | null
  width: number | null
  length: number | null
  board_feet: number | null
  lineal_feet: number | null
  price: number | null
  customer_id: number | null
  customer_name: string | null
  species_name: string | null
  product_type_name: string | null
  profile_name: string | null
}

interface LineItem {
  key: string
  part_id: number | null
  partSearch: string
  partResults: PartResult[]
  isSearching: boolean
  showDropdown: boolean
  selectedPart: PartResult | null
  customer_part_number: string
  description: string
  quantity_ordered: string
  price_per_unit: string
  price_unit: string
  line_total: string
  is_new_part: boolean
  notes: string
}

function newLineItem(): LineItem {
  return {
    key: crypto.randomUUID(), part_id: null, partSearch: '', partResults: [],
    isSearching: false, showDropdown: false, selectedPart: null,
    customer_part_number: '', description: '', quantity_ordered: '',
    price_per_unit: '', price_unit: 'BF', line_total: '', is_new_part: false, notes: '',
  }
}

function calcLineTotal(qty: string, price: string): string {
  const q = parseFloat(qty), p = parseFloat(price)
  if (!q || !p) return ''
  return (q * p).toFixed(2)
}

export default function NewOrderPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [species, setSpecies] = useState<Species[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])

  const [customerId, setCustomerId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [isRush, setIsRush] = useState(false)
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<LineItem[]>([newLineItem()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isShowingPreview, setIsShowingPreview] = useState(false)
  const dragCounterRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [userHint, setUserHint] = useState('')
  const [isHintOpen, setIsHintOpen] = useState(false)
  const [isSavingHint, setIsSavingHint] = useState(false)

  const [isNewPartOpen, setIsNewPartOpen] = useState(false)
  const [newPartLineIdx, setNewPartLineIdx] = useState<number | null>(null)
  const [newPartForm, setNewPartForm] = useState({
    rnr_part_number: '', customer_part_number: '', customer_id: '',
    description: '', species_id: '', product_type_id: '', profile_id: '',
    thickness: '', width: '', length: '', board_feet: '', lineal_feet: '',
    price: '', item_class: '', qb_item_code: '',
  })
  const [isCreatingPart, setIsCreatingPart] = useState(false)

  const searchTimers = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    async function fetchRefs() {
      try {
        const [cRes, sRes, ptRes, prRes] = await Promise.all([
          fetch('/api/customers'), fetch('/api/rnr/species'),
          fetch('/api/rnr/product-types'), fetch('/api/rnr/profiles'),
        ])
        if (cRes.ok) { const d = await cRes.json(); setCustomers(Array.isArray(d) ? d : d.customers || []) }
        if (sRes.ok) setSpecies(await sRes.json())
        if (ptRes.ok) setProductTypes(await ptRes.json())
        if (prRes.ok) setProfiles(await prRes.json())
      } catch { /* ignore */ }
    }
    fetchRefs()
  }, [])

  // --- Drag and Drop ---
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0])
    }
  }
  function handleFile(file: File) {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g|xlsx?|csv)$/i)) {
      toast.error('Please upload a PDF, image, or spreadsheet file')
      return
    }
    setUploadedFile(file)
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreviewUrl(url)
      setIsShowingPreview(true)
    }
    parseFileWithAI(file)
  }

  async function parseFileWithAI(file: File, hint?: string) {
    setIsParsing(true)
    setParseError(null)
    toast.info(hint ? 'Re-parsing with your instructions...' : 'Reading order file with AI...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (hint) formData.append('user_hint', hint)
      const res = await fetch('/api/rnr/orders/parse-file', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        const errMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to parse')
        setParseError(errMsg)
        toast.error(errMsg, { duration: 8000 })
        return
      }

      if (data.customer_id) setCustomerId(data.customer_id.toString())
      if (data.po_number) setPoNumber(data.po_number)
      if (data.order_date) setOrderDate(data.order_date)
      if (data.due_date) setDueDate(data.due_date)
      if (data.is_rush) setIsRush(true)
      if (data.notes) setNotes(data.notes)

      if (data.items && data.items.length > 0) {
        const parsedItems: LineItem[] = data.items.map((item: {
          part_number?: string; description?: string; quantity?: number;
          price?: number; unit?: string; matched_part_id?: number | null;
          matched_part_number?: string | null; is_new_part?: boolean;
        }) => ({
          key: crypto.randomUUID(),
          part_id: item.matched_part_id || null,
          partSearch: item.matched_part_number || item.part_number || '',
          partResults: [],
          isSearching: false,
          showDropdown: false,
          selectedPart: null,
          customer_part_number: item.part_number || '',
          description: item.description || '',
          quantity_ordered: item.quantity?.toString() || '',
          price_per_unit: item.price?.toString() || '',
          price_unit: item.unit || 'PC',
          line_total: (item.quantity && item.price) ? (item.quantity * item.price).toFixed(2) : '',
          is_new_part: item.is_new_part || false,
          notes: '',
        }))
        setItems(parsedItems)
      }

      const newCount = (data.items || []).filter((i: { is_new_part?: boolean }) => i.is_new_part).length
      const matchedCount = (data.items || []).length - newCount
      toast.success(
        `Parsed ${data.items?.length || 0} line items (${matchedCount} matched, ${newCount} new parts)`,
        { duration: 5000 }
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse order file'
      setParseError(msg)
      toast.error(msg, { duration: 8000 })
    }
    finally { setIsParsing(false) }
  }
  function reparseWithHint() {
    if (!uploadedFile || !userHint.trim()) return
    parseFileWithAI(uploadedFile, userHint.trim())
  }

  async function saveHintForCustomer() {
    if (!customerId || !userHint.trim()) {
      toast.error('Select a customer and enter parsing instructions first')
      return
    }
    setIsSavingHint(true)
    try {
      const res = await fetch('/api/rnr/customer-parse-hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: parseInt(customerId), hint_text: userHint.trim() }),
      })
      if (res.ok) {
        const customerName = customers.find(c => c.id.toString() === customerId)?.customer_name || 'customer'
        toast.success(`Parsing hints saved for ${customerName}. Future orders will use these automatically.`, { duration: 5000 })
      } else {
        toast.error('Failed to save hint')
      }
    } catch { toast.error('Failed to save hint') }
    finally { setIsSavingHint(false) }
  }

  function removeFile() {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    setUploadedFile(null)
    setFilePreviewUrl(null)
    setIsShowingPreview(false)
    setUserHint('')
    setIsHintOpen(false)
  }

  // --- Line Item Logic ---
  function updateItem(index: number, updates: Partial<LineItem>) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      const updated = { ...item, ...updates }
      if ('quantity_ordered' in updates || 'price_per_unit' in updates) {
        updated.line_total = calcLineTotal(updated.quantity_ordered, updated.price_per_unit)
      }
      return updated
    }))
  }
  function addRow() { setItems(prev => [...prev, newLineItem()]) }
  function removeRow(index: number) {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const searchParts = useCallback(async (index: number, q: string) => {
    if (q.length < 1) { updateItem(index, { partResults: [], showDropdown: false, isSearching: false }); return }
    updateItem(index, { isSearching: true })
    try {
      const params = new URLSearchParams({ q, limit: '10' })
      if (customerId) params.set('customer_id', customerId)
      const res = await fetch(`/api/rnr/parts/search?${params}`)
      if (res.ok) {
        const results = await res.json()
        updateItem(index, { partResults: results, showDropdown: true, isSearching: false })
      }
    } catch { updateItem(index, { isSearching: false }) }
  }, [customerId])

  function handlePartSearchChange(index: number, value: string) {
    updateItem(index, { partSearch: value, selectedPart: null, part_id: null, is_new_part: false })
    const key = items[index].key
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key])
    searchTimers.current[key] = setTimeout(() => searchParts(index, value), 250)
  }

  function selectPart(index: number, part: PartResult) {
    updateItem(index, {
      part_id: part.id, selectedPart: part,
      partSearch: part.rnr_part_number || part.customer_part_number || '',
      customer_part_number: part.customer_part_number || '',
      description: part.description || '',
      price_per_unit: part.price?.toString() || '',
      showDropdown: false, partResults: [], is_new_part: false,
    })
  }

  function openNewPartDialog(index: number) {
    updateItem(index, { is_new_part: true, showDropdown: false, partResults: [] })
    setNewPartLineIdx(index)
    setNewPartForm({
      rnr_part_number: '', customer_part_number: items[index].customer_part_number || items[index].partSearch,
      customer_id: customerId, description: items[index].description || '',
      species_id: '', product_type_id: '', profile_id: '',
      thickness: '', width: '', length: '', board_feet: '', lineal_feet: '',
      price: items[index].price_per_unit || '', item_class: '', qb_item_code: '',
    })
    setIsNewPartOpen(true)
  }

  function handleNewPartDimChange(field: string, value: string) {
    const updated = { ...newPartForm, [field]: value }
    if (['thickness', 'width', 'length'].includes(field)) {
      const t = parseFloat(updated.thickness), w = parseFloat(updated.width), l = parseFloat(updated.length)
      updated.board_feet = (t && w && l) ? ((t * w * l) / 144).toFixed(4) : ''
      updated.lineal_feet = l ? (l / 12).toFixed(4) : ''
    }
    setNewPartForm(updated)
  }

  async function createPartAndLink() {
    if (newPartLineIdx === null) return
    setIsCreatingPart(true)
    try {
      const body: Record<string, unknown> = {
        rnr_part_number: newPartForm.rnr_part_number || null,
        customer_part_number: newPartForm.customer_part_number || null,
        customer_id: newPartForm.customer_id ? parseInt(newPartForm.customer_id) : null,
        description: newPartForm.description || null,
        species_id: newPartForm.species_id ? parseInt(newPartForm.species_id) : null,
        product_type_id: newPartForm.product_type_id ? parseInt(newPartForm.product_type_id) : null,
        profile_id: newPartForm.profile_id ? parseInt(newPartForm.profile_id) : null,
        thickness: newPartForm.thickness ? parseFloat(newPartForm.thickness) : null,
        width: newPartForm.width ? parseFloat(newPartForm.width) : null,
        length: newPartForm.length ? parseFloat(newPartForm.length) : null,
        board_feet: newPartForm.board_feet ? parseFloat(newPartForm.board_feet) : null,
        lineal_feet: newPartForm.lineal_feet ? parseFloat(newPartForm.lineal_feet) : null,
        price: newPartForm.price ? parseFloat(newPartForm.price) : null,
        item_class: newPartForm.item_class || null, qb_item_code: newPartForm.qb_item_code || null,
      }
      const res = await fetch('/api/rnr/parts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        const part = await res.json()
        updateItem(newPartLineIdx, {
          part_id: part.id, partSearch: part.rnr_part_number || part.customer_part_number || '',
          customer_part_number: part.customer_part_number || '', description: part.description || '',
          price_per_unit: part.price?.toString() || '', is_new_part: false, selectedPart: part,
        })
        toast.success('Part created and linked')
        setIsNewPartOpen(false)
      } else { const d = await res.json(); toast.error(d.error || 'Failed to create part') }
    } catch { toast.error('Failed to create part') }
    finally { setIsCreatingPart(false) }
  }

  function orderTotal(): string {
    let total = 0
    for (const item of items) total += parseFloat(item.line_total || '0')
    return total.toFixed(2)
  }

  async function submitOrder() {
    if (!customerId) { toast.error('Please select a customer'); return }
    if (!orderDate) { toast.error('Please set an order date'); return }
    const hasItems = items.some(i => i.part_id || i.description)
    if (!hasItems) { toast.error('Add at least one line item'); return }

    setIsSubmitting(true)
    try {
      const payload = {
        customer_id: parseInt(customerId),
        po_number: poNumber || null,
        order_date: orderDate,
        due_date: dueDate || null,
        is_rush: isRush,
        notes: notes || null,
        source: uploadedFile ? 'import' : 'manual',
        items: items.filter(i => i.part_id || i.description).map(i => ({
          part_id: i.part_id,
          customer_part_number: i.customer_part_number || null,
          description: i.description || null,
          quantity_ordered: parseInt(i.quantity_ordered) || 0,
          price_per_unit: parseFloat(i.price_per_unit) || null,
          price_unit: i.price_unit,
          line_total: parseFloat(i.line_total) || 0,
          is_new_part: i.is_new_part,
          notes: i.notes || null,
        })),
      }

      const res = await fetch('/api/rnr/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed to create order'); return }
      const order = await res.json()

      if (uploadedFile) {
        const formData = new FormData()
        formData.append('file', uploadedFile)
        formData.append('setAsOriginal', 'true')
        await fetch(`/api/rnr/orders/${order.id}/files`, { method: 'POST', body: formData })
      }

      toast.success(`Order ${order.order_number} created`)
      router.push(`/dashboard/rnr-office/orders/${order.id}`)
    } catch { toast.error('Failed to create order') }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="space-y-6"
      onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
      onDragOver={handleDragOver} onDrop={handleDrop}
    >
      {/* Full-page drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-amber-600/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl border-2 border-dashed border-amber-500 p-12 text-center shadow-2xl">
            <FileUp className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-800">Drop Order File</p>
            <p className="text-sm text-gray-500 mt-1">PDF, Image, or Spreadsheet</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/rnr-office/orders">
            <Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <ClipboardList className="h-7 w-7 text-amber-600" />
              New Order
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Drop an order file or enter manually</p>
          </div>
        </div>
        {filePreviewUrl && (
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={() => setIsShowingPreview(!isShowingPreview)}
          >
            {isShowingPreview ? <><EyeOff size={14} />Hide Preview</> : <><Eye size={14} />Show Preview</>}
          </Button>
        )}
      </div>

      {/* File Upload Zone (when no file yet) */}
      {!uploadedFile && (
        <div
          className="bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-amber-400 p-8 text-center cursor-pointer transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Drag & drop an order file here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">AI will automatically read and fill in the order · Supports PDF, images, and spreadsheets</p>
        </div>
      )}

      {/* File Attached Banner + AI Status */}
      {uploadedFile && (
        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${isParsing ? 'bg-blue-50 border-blue-200' : parseError ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-3">
            {isParsing ? (
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            ) : (
              <FileText className={`h-5 w-5 ${parseError ? 'text-red-600' : 'text-amber-600'}`} />
            )}
            <div>
              <p className={`text-sm font-medium ${isParsing ? 'text-blue-800' : parseError ? 'text-red-800' : 'text-amber-800'}`}>
                {uploadedFile.name}
              </p>
              <p className={`text-xs ${isParsing ? 'text-blue-600' : parseError ? 'text-red-600' : 'text-amber-600'}`}>
                {isParsing ? 'AI is reading the order...' : parseError ? parseError : `${(uploadedFile.size / 1024).toFixed(0)} KB · AI parsed · Review below and save`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isParsing && (
              <>
                <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700" onClick={() => fileInputRef.current?.click()}>
                  Replace
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500" onClick={removeFile}>
                  <X size={14} />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Re-parse with instructions (shown after parse error or on demand) */}
      {uploadedFile && !isParsing && (
        <div className="space-y-2">
          {!isHintOpen ? (
            <button
              onClick={() => setIsHintOpen(true)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 transition-colors"
            >
              <MessageSquare size={13} />
              AI didn&apos;t get it right? Add parsing instructions and retry
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-amber-600" />
                  Parsing Instructions
                </label>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400" onClick={() => setIsHintOpen(false)}>
                  <X size={12} />
                </Button>
              </div>
              <Textarea
                value={userHint}
                onChange={e => setUserHint(e.target.value)}
                rows={3}
                placeholder='Tell the AI how to read this order format. Examples:&#10;"The part numbers are in the Vendor Item # column"&#10;"Each item spans 3 lines, combine them"&#10;"No part numbers - items are defined by dimensions only"'
                className="text-sm"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                  onClick={reparseWithHint}
                  disabled={isParsing || !userHint.trim()}
                >
                  <RefreshCw size={13} />Re-parse with Instructions
                </Button>
                {customerId && userHint.trim() && (
                  <Button
                    variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-300"
                    onClick={saveHintForCustomer}
                    disabled={isSavingHint}
                  >
                    {isSavingHint ? <Loader2 size={13} className="animate-spin" /> : <BookmarkPlus size={13} />}
                    Save for {customers.find(c => c.id.toString() === customerId)?.customer_name || 'customer'}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                Saved hints are automatically used for future orders from this customer.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Content - Side by Side when preview is showing */}
      <div className={isShowingPreview && filePreviewUrl ? 'grid grid-cols-2 gap-6' : ''}>
        {/* PDF Preview Panel */}
        {isShowingPreview && filePreviewUrl && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-4" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Order File Preview</span>
              <Button variant="ghost" size="sm" onClick={() => setIsShowingPreview(false)}><X size={14} /></Button>
            </div>
            {uploadedFile?.type === 'application/pdf' ? (
              <iframe src={filePreviewUrl} className="w-full h-full" title="Order preview" />
            ) : (
              <div className="p-4 flex items-center justify-center h-full">
                <img src={filePreviewUrl} alt="Order preview" className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>
        )}

        {/* Order Form */}
        <div className="space-y-6">
          {/* Order Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Order Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Customer *</Label>
                <Select value={customerId || 'none'} onValueChange={v => setCustomerId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Select --</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.customer_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">PO #</Label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Customer PO number" />
              </div>
              <div>
                <Label className="text-xs">Order Date *</Label>
                <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes..." />
              </div>
              <div className="flex items-end">
                <Button variant={isRush ? 'destructive' : 'outline'} className="gap-2" onClick={() => setIsRush(!isRush)}>
                  <AlertTriangle size={14} />{isRush ? 'RUSH ORDER' : 'Mark as Rush'}
                </Button>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Line Items</h2>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addRow}><Plus size={14} />Add Row</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-[240px]">Part #</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-[90px]">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-[100px]">Price</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600 w-[80px]">Unit</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-[100px]">Total</th>
                    <th className="w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.key} className={`border-b border-gray-100 ${item.is_new_part ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-2 relative">
                        <div className="relative">
                          <Input
                            value={item.partSearch}
                            onChange={e => handlePartSearchChange(idx, e.target.value)}
                            onFocus={() => { if (item.partResults.length > 0) updateItem(idx, { showDropdown: true }) }}
                            onBlur={() => setTimeout(() => updateItem(idx, { showDropdown: false }), 200)}
                            placeholder="Search parts..."
                            className={`font-mono text-xs pr-8 ${item.is_new_part ? 'border-amber-400' : ''}`}
                          />
                          {item.isSearching && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                          {item.is_new_part && (
                            <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-medium">NEW</span>
                          )}
                        </div>
                        {item.showDropdown && item.partResults.length > 0 && (
                          <div className="absolute z-50 mt-1 left-3 right-3 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                            {item.partResults.map(p => (
                              <button key={p.id} type="button" onMouseDown={() => selectPart(idx, p)}
                                className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-gray-50 last:border-0">
                                <span className="font-mono text-xs font-medium">{p.rnr_part_number || p.customer_part_number || '-'}</span>
                                <span className="text-xs text-gray-500 ml-2 truncate">{p.description}</span>
                                {p.species_name && <span className="text-xs text-gray-400 ml-1">({p.species_name})</span>}
                              </button>
                            ))}
                          </div>
                        )}
                        {item.showDropdown && item.partSearch.length >= 2 && item.partResults.length === 0 && !item.isSearching && (
                          <div className="absolute z-50 mt-1 left-3 right-3 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center">
                            <p className="text-xs text-gray-500 mb-2">No parts found</p>
                            <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                              onMouseDown={() => openNewPartDialog(idx)}>
                              <Sparkles size={12} />Create New Part
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="Description" className="text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" value={item.quantity_ordered} onChange={e => updateItem(idx, { quantity_ordered: e.target.value })} className="text-right text-xs font-mono" placeholder="0" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" step="0.0001" value={item.price_per_unit} onChange={e => updateItem(idx, { price_per_unit: e.target.value })} className="text-right text-xs font-mono" placeholder="0.00" />
                      </td>
                      <td className="px-3 py-2">
                        <Select value={item.price_unit} onValueChange={v => updateItem(idx, { price_unit: v })}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BF">BF</SelectItem>
                            <SelectItem value="LF">LF</SelectItem>
                            <SelectItem value="PC">Piece</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-right font-mono text-xs text-gray-700 font-medium py-2">
                          {item.line_total ? `$${item.line_total}` : '-'}
                        </div>
                      </td>
                      <td className="px-1 py-2">
                        <Button variant="ghost" size="sm" onClick={() => removeRow(idx)} disabled={items.length <= 1} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addRow}><Plus size={14} />Add Row</Button>
              <div className="text-right">
                <span className="text-sm text-gray-500 mr-3">Order Total:</span>
                <span className="text-lg font-bold text-gray-900 font-mono">${orderTotal()}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <Link href="/dashboard/rnr-office/orders">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={submitOrder} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 size={14} className="animate-spin" />Saving...</> : <><Save size={14} />Save Order</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Inline New Part Dialog */}
      <Dialog open={isNewPartOpen} onOpenChange={setIsNewPartOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />Create New Part
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">RNR Part #</Label><Input value={newPartForm.rnr_part_number} onChange={e => setNewPartForm({ ...newPartForm, rnr_part_number: e.target.value })} className="font-mono text-sm" /></div>
              <div><Label className="text-xs">Customer Part #</Label><Input value={newPartForm.customer_part_number} onChange={e => setNewPartForm({ ...newPartForm, customer_part_number: e.target.value })} className="font-mono text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Customer</Label>
                <Select value={newPartForm.customer_id || 'none'} onValueChange={v => setNewPartForm({ ...newPartForm, customer_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent><SelectItem value="none">-- None --</SelectItem>{customers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.customer_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Price</Label><Input type="number" step="0.0001" value={newPartForm.price} onChange={e => setNewPartForm({ ...newPartForm, price: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Description</Label><Input value={newPartForm.description} onChange={e => setNewPartForm({ ...newPartForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Species</Label>
                <Select value={newPartForm.species_id || 'none'} onValueChange={v => setNewPartForm({ ...newPartForm, species_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent><SelectItem value="none">-- None --</SelectItem>{species.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Product Type</Label>
                <Select value={newPartForm.product_type_id || 'none'} onValueChange={v => setNewPartForm({ ...newPartForm, product_type_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent><SelectItem value="none">-- None --</SelectItem>{productTypes.map(pt => <SelectItem key={pt.id} value={pt.id.toString()}>{pt.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Profile</Label>
                <Select value={newPartForm.profile_id || 'none'} onValueChange={v => setNewPartForm({ ...newPartForm, profile_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent><SelectItem value="none">-- None --</SelectItem>{profiles.map(pr => <SelectItem key={pr.id} value={pr.id.toString()}>{pr.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div><Label className="text-xs">Thickness</Label><Input type="number" step="any" value={newPartForm.thickness} onChange={e => handleNewPartDimChange('thickness', e.target.value)} className="font-mono text-sm" /></div>
              <div><Label className="text-xs">Width</Label><Input type="number" step="any" value={newPartForm.width} onChange={e => handleNewPartDimChange('width', e.target.value)} className="font-mono text-sm" /></div>
              <div><Label className="text-xs">Length</Label><Input type="number" step="any" value={newPartForm.length} onChange={e => handleNewPartDimChange('length', e.target.value)} className="font-mono text-sm" /></div>
              <div><Label className="text-xs">Board Ft <span className="text-amber-600">(auto)</span></Label><Input type="number" step="any" value={newPartForm.board_feet} readOnly className="font-mono text-sm" /></div>
              <div><Label className="text-xs">Lineal Ft <span className="text-amber-600">(auto)</span></Label><Input type="number" step="any" value={newPartForm.lineal_feet} readOnly className="font-mono text-sm" /></div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsNewPartOpen(false)} disabled={isCreatingPart}>Cancel</Button>
            <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={createPartAndLink} disabled={isCreatingPart}>
              {isCreatingPart ? <><Loader2 size={14} className="animate-spin" />Creating...</> : <><Plus size={14} />Create & Link</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
