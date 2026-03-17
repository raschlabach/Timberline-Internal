'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
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
  ArrowLeft, Pencil, Save, Loader2, AlertTriangle, Printer,
  Play, CheckCircle, Truck, FileText, Trash2, ClipboardList, X,
  Download, FileUp, ExternalLink, CheckSquare, Square, Copy, Check,
  Plus, Search, BookOpen,
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

interface OrderFile {
  id: number
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_at: string
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
  in_quickbooks: boolean
  in_quickbooks_at: string | null
  sent_to_shop: boolean
  sent_to_shop_at: string | null
  original_file_url: string | null
  original_file_name: string | null
  created_at: string
  updated_at: string
  items: OrderItem[]
}

interface Customer {
  id: number
  customer_name: string
}

interface PartResult {
  id: number
  rnr_part_number: string | null
  customer_part_number: string | null
  description: string | null
  species_name: string | null
  price: number | null
}

interface EditLineItem {
  key: string
  part_id: number | null
  partSearch: string
  partResults: PartResult[]
  isSearching: boolean
  showDropdown: boolean
  customer_part_number: string
  description: string
  quantity_ordered: string
  quantity_final: string
  price_per_unit: string
  price_unit: string
  line_total: string
  is_new_part: boolean
  notes: string
}

function newEditLineItem(): EditLineItem {
  return {
    key: crypto.randomUUID(), part_id: null, partSearch: '', partResults: [],
    isSearching: false, showDropdown: false,
    customer_part_number: '', description: '', quantity_ordered: '',
    quantity_final: '', price_per_unit: '', price_unit: 'BF', line_total: '',
    is_new_part: false, notes: '',
  }
}

function orderItemToEditItem(item: OrderItem): EditLineItem {
  return {
    key: crypto.randomUUID(),
    part_id: item.part_id,
    partSearch: item.rnr_part_number || item.customer_part_number || '',
    partResults: [],
    isSearching: false,
    showDropdown: false,
    customer_part_number: item.customer_part_number || '',
    description: item.description || '',
    quantity_ordered: item.quantity_ordered?.toString() || '',
    quantity_final: item.quantity_final?.toString() || '',
    price_per_unit: item.price_per_unit?.toString() || '',
    price_unit: item.price_unit || 'BF',
    line_total: item.line_total?.toString() || '',
    is_new_part: item.is_new_part,
    notes: item.notes || '',
  }
}

function calcLineTotal(qty: string, price: string): string {
  const q = parseFloat(qty), p = parseFloat(price)
  if (!q || !p) return ''
  return (q * p).toFixed(2)
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
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>{config.label}</span>
}

export default function OrderDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const routeParams = useParams()
  const orderId = routeParams?.orderId as string

  const [order, setOrder] = useState<Order | null>(null)
  const [files, setFiles] = useState<OrderFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [isEditingQty, setIsEditingQty] = useState(false)
  const [finalQtys, setFinalQtys] = useState<Record<number, string>>({})

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isUploading, setIsUploading] = useState(false)
  const [copiedCell, setCopiedCell] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Header editing state
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [editCustomerId, setEditCustomerId] = useState('')
  const [editPoNumber, setEditPoNumber] = useState('')
  const [editOrderDate, setEditOrderDate] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editIsRush, setEditIsRush] = useState(false)

  // Line item editing state
  const [isEditingItems, setIsEditingItems] = useState(false)
  const [editItems, setEditItems] = useState<EditLineItem[]>([])
  const searchTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // QuickBooks entry popup window ref
  const qbWindowRef = useRef<Window | null>(null)

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch('/api/rnr/customer-settings')
        if (res.ok) {
          const settings = await res.json()
          const custs: Customer[] = settings.map((s: { customer_id: number; customer_name: string }) => ({
            id: s.customer_id, customer_name: s.customer_name,
          }))
          setCustomers(custs)
        }
      } catch { /* ignore */ }
    }
    fetchCustomers()
  }, [])

  function copyToClipboard(text: string, cellKey: string) {
    navigator.clipboard.writeText(text)
    setCopiedCell(cellKey)
    toast.success(`Copied: ${text}`, { duration: 1500 })
    setTimeout(() => setCopiedCell(null), 1500)
  }

  function openQBPopup() {
    if (!order) return

    if (qbWindowRef.current && !qbWindowRef.current.closed) {
      qbWindowRef.current.focus()
      return
    }

    const width = 360
    const height = Math.min(600, 260 + order.items.length * 36)
    const left = window.screenX + window.outerWidth - width - 30
    const top = window.screenY + 80

    const popup = window.open('', 'qb_entry', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`)
    if (!popup) {
      toast.error('Popup blocked — please allow popups for this site')
      return
    }
    qbWindowRef.current = popup

    const itemRows = order.items.map((item, idx) => {
      const partNum = (item.rnr_part_number || item.customer_part_number || '-').replace(/'/g, "\\'").replace(/"/g, '&quot;')
      const qty = item.quantity_ordered
      return `
        <div class="row" id="row-${idx}">
          <span class="part" id="part-text-${idx}" title="${partNum}">${partNum}</span>
          <button class="copy-btn" id="part-btn-${idx}" onclick="copyField('${partNum}', 'part-${idx}')" title="Copy part #">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <span class="qty" id="qty-text-${idx}">${qty}</span>
          <button class="copy-btn" id="qty-btn-${idx}" onclick="copyField('${qty}', 'qty-${idx}')" title="Copy qty">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>`
    }).join('')

    const customerName = (order.customer_name || '-').replace(/'/g, "\\'").replace(/"/g, '&quot;')
    const poNumber = (order.po_number || '-').replace(/'/g, "\\'").replace(/"/g, '&quot;')
    const totalItems = order.items.length

    popup.document.write(`<!DOCTYPE html>
<html><head>
<title>QB Entry — ${order.order_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a1a1a; font-size: 13px; user-select: none; }
  .header { background: #16a34a; color: white; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; }
  .header-title { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  .header-actions { display: flex; gap: 4px; }
  .header-btn { background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; }
  .header-btn:hover { background: rgba(255,255,255,0.15); color: white; }
  .field { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
  .field-label { font-size: 9px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.8px; }
  .field-row { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
  .field-value { font-size: 13px; font-weight: 600; transition: color 0.2s; }
  .field-value.copied { color: #16a34a; }
  .field-value.mono { font-family: 'SF Mono', 'Consolas', monospace; font-size: 12px; }
  .copy-btn { background: none; border: none; color: #bbb; cursor: pointer; padding: 3px; border-radius: 4px; display: flex; align-items: center; transition: all 0.15s; }
  .copy-btn:hover { background: #f0f0f0; color: #16a34a; }
  .copy-btn.copied { background: #dcfce7; color: #16a34a; }
  .items-header { padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f0f0f0; }
  .items-label { font-size: 9px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.8px; }
  .col-headers { display: grid; grid-template-columns: 1fr auto auto auto; gap: 4px; padding: 0 12px 4px; font-size: 9px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.5px; }
  .items-list { max-height: calc(100vh - 220px); overflow-y: auto; padding: 0 12px; }
  .row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 4px; align-items: center; padding: 6px 0; border-bottom: 1px solid #f8f8f8; }
  .row:last-child { border-bottom: none; }
  .row.both-copied { opacity: 0.45; }
  .part { font-family: 'SF Mono', 'Consolas', monospace; font-size: 11px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color 0.2s; }
  .part.copied { color: #16a34a; }
  .qty { font-family: 'SF Mono', 'Consolas', monospace; font-size: 11px; text-align: right; min-width: 36px; transition: color 0.2s; }
  .qty.copied { color: #16a34a; font-weight: 700; }
  .footer { padding: 6px 12px; background: #f9f9f9; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #999; }
  .reset-btn { background: none; border: none; color: #999; cursor: pointer; font-size: 10px; display: flex; align-items: center; gap: 3px; }
  .reset-btn:hover { color: #16a34a; }
  .check-svg { display: none; }
  .copy-btn.copied .copy-svg { display: none; }
  .copy-btn.copied .check-svg { display: inline; }
</style>
</head><body>
  <div class="header">
    <span class="header-title">QB Entry — ${order.order_number}</span>
    <div class="header-actions">
      <button class="header-btn" onclick="resetAll()" title="Reset copied">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      </button>
    </div>
  </div>

  <div class="field">
    <div class="field-label">Customer</div>
    <div class="field-row">
      <span class="field-value" id="customer-text">${customerName}</span>
      <button class="copy-btn" id="customer-btn" onclick="copyField('${customerName}', 'customer')" title="Copy customer">
        <svg class="copy-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <svg class="check-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
  </div>

  <div class="field">
    <div class="field-label">PO #</div>
    <div class="field-row">
      <span class="field-value mono" id="po-text">${poNumber}</span>
      <button class="copy-btn" id="po-btn" onclick="copyField('${poNumber}', 'po')" title="Copy PO #">
        <svg class="copy-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <svg class="check-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
  </div>

  <div class="items-header">
    <span class="items-label">Items (${totalItems})</span>
    <span id="copied-count" style="font-size:10px;color:#999;"></span>
  </div>
  <div class="col-headers"><span>Part #</span><span></span><span style="text-align:right">Qty</span><span></span></div>
  <div class="items-list">${itemRows}</div>

  <div class="footer">
    <span id="progress">0 / ${totalItems * 2} fields copied</span>
    <button class="reset-btn" onclick="resetAll()">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      Reset
    </button>
  </div>

<script>
  var copied = {};
  var totalItems = ${totalItems};

  function copyField(text, key) {
    navigator.clipboard.writeText(text).then(function() {
      copied[key] = true;
      updateUI(key);
      updateProgress();
    });
  }

  function updateUI(key) {
    var btn = document.getElementById(key + '-btn');
    var text = document.getElementById(key + '-text');
    if (btn) btn.classList.add('copied');
    if (text) text.classList.add('copied');

    var parts = key.split('-');
    if (parts[0] === 'part' || parts[0] === 'qty') {
      var idx = parts[1];
      var partCopied = copied['part-' + idx];
      var qtyCopied = copied['qty-' + idx];
      var row = document.getElementById('row-' + idx);
      if (row) {
        if (partCopied && qtyCopied) row.classList.add('both-copied');
        else row.classList.remove('both-copied');
      }
    }
  }

  function updateProgress() {
    var count = 0;
    for (var k in copied) {
      if (k.startsWith('part-') || k.startsWith('qty-')) count++;
    }
    var el = document.getElementById('progress');
    if (el) el.textContent = count + ' / ' + (totalItems * 2) + ' fields copied';
    var countEl = document.getElementById('copied-count');
    if (countEl) countEl.textContent = count > 0 ? count + ' copied' : '';
  }

  function resetAll() {
    copied = {};
    var allBtns = document.querySelectorAll('.copy-btn');
    allBtns.forEach(function(b) { b.classList.remove('copied'); });
    var allTexts = document.querySelectorAll('.copied');
    allTexts.forEach(function(t) { t.classList.remove('copied'); });
    var allRows = document.querySelectorAll('.row');
    allRows.forEach(function(r) { r.classList.remove('both-copied'); });
    updateProgress();
  }
</script>
</body></html>`)

    popup.document.close()
  }

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

  async function fetchFiles() {
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}/files`)
      if (res.ok) setFiles(await res.json())
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchOrder(); fetchFiles() }, [orderId])

  // --- Header editing ---
  function startEditingHeader() {
    if (!order) return
    setEditCustomerId(order.customer_id?.toString() || '')
    setEditPoNumber(order.po_number || '')
    setEditOrderDate(order.order_date ? order.order_date.substring(0, 10) : '')
    setEditDueDate(order.due_date ? order.due_date.substring(0, 10) : '')
    setEditNotes(order.notes || '')
    setEditIsRush(order.is_rush)
    setIsEditingHeader(true)
  }

  function cancelEditingHeader() {
    setIsEditingHeader(false)
  }

  async function saveHeader() {
    if (!order) return
    if (!editCustomerId) { toast.error('Customer is required'); return }
    if (!editOrderDate) { toast.error('Order date is required'); return }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: parseInt(editCustomerId),
          po_number: editPoNumber || null,
          order_date: editOrderDate,
          due_date: editDueDate || null,
          notes: editNotes || null,
          is_rush: editIsRush,
        }),
      })
      if (res.ok) {
        toast.success('Order details updated')
        setIsEditingHeader(false)
        fetchOrder()
      } else {
        toast.error('Failed to save changes')
      }
    } catch { toast.error('Failed to save changes') }
    finally { setIsSaving(false) }
  }

  // --- Line item editing ---
  function startEditingItems() {
    if (!order) return
    setEditItems(order.items.map(orderItemToEditItem))
    setIsEditingItems(true)
  }

  function cancelEditingItems() {
    setIsEditingItems(false)
    setEditItems([])
  }

  function updateEditItem(index: number, updates: Partial<EditLineItem>) {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      const updated = { ...item, ...updates }
      if ('quantity_ordered' in updates || 'price_per_unit' in updates) {
        updated.line_total = calcLineTotal(updated.quantity_ordered, updated.price_per_unit)
      }
      return updated
    }))
  }

  function addEditRow() {
    setEditItems(prev => [...prev, newEditLineItem()])
  }

  function removeEditRow(index: number) {
    if (editItems.length <= 1) return
    setEditItems(prev => prev.filter((_, i) => i !== index))
  }

  const searchParts = useCallback(async (index: number, q: string) => {
    if (q.length < 1) {
      updateEditItem(index, { partResults: [], showDropdown: false, isSearching: false })
      return
    }
    updateEditItem(index, { isSearching: true })
    try {
      const params = new URLSearchParams({ q, limit: '10' })
      if (order?.customer_id) params.set('customer_id', order.customer_id.toString())
      const res = await fetch(`/api/rnr/parts/search?${params}`)
      if (res.ok) {
        const results = await res.json()
        updateEditItem(index, { partResults: results, showDropdown: true, isSearching: false })
      }
    } catch { updateEditItem(index, { isSearching: false }) }
  }, [order?.customer_id])

  function handlePartSearchChange(index: number, value: string) {
    updateEditItem(index, { partSearch: value, part_id: null, is_new_part: false })
    const key = editItems[index].key
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key])
    searchTimers.current[key] = setTimeout(() => searchParts(index, value), 250)
  }

  function selectPart(index: number, part: PartResult) {
    updateEditItem(index, {
      part_id: part.id,
      partSearch: part.rnr_part_number || part.customer_part_number || '',
      customer_part_number: part.customer_part_number || '',
      description: part.description || '',
      price_per_unit: part.price?.toString() || '',
      showDropdown: false, partResults: [], is_new_part: false,
    })
  }

  function editItemsTotal(): string {
    let total = 0
    for (const item of editItems) total += parseFloat(item.line_total || '0')
    return total.toFixed(2)
  }

  async function saveItems() {
    if (!order) return
    const hasItems = editItems.some(i => i.part_id || i.description)
    if (!hasItems) { toast.error('Add at least one line item'); return }

    setIsSaving(true)
    try {
      const totalPrice = parseFloat(editItemsTotal())
      const payload = {
        total_price: totalPrice,
        items: editItems.filter(i => i.part_id || i.description).map(i => ({
          part_id: i.part_id,
          customer_part_number: i.customer_part_number || null,
          description: i.description || null,
          quantity_ordered: parseInt(i.quantity_ordered) || 0,
          quantity_final: i.quantity_final ? parseInt(i.quantity_final) : null,
          price_per_unit: parseFloat(i.price_per_unit) || null,
          price_unit: i.price_unit,
          line_total: parseFloat(i.line_total) || 0,
          is_new_part: i.is_new_part,
          notes: i.notes || null,
        })),
      }
      const res = await fetch(`/api/rnr/orders/${orderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success('Line items updated')
        setIsEditingItems(false)
        setEditItems([])
        fetchOrder()
      } else {
        toast.error('Failed to save line items')
      }
    } catch { toast.error('Failed to save') }
    finally { setIsSaving(false) }
  }

  // --- Existing functionality ---
  async function updateStatus(newStatus: string) {
    if (!order) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) { toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`); fetchOrder() }
      else toast.error('Failed to update status')
    } catch { toast.error('Failed to update status') }
    finally { setIsSaving(false) }
  }

  async function toggleQBStatus() {
    if (!order) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ in_quickbooks: !order.in_quickbooks }),
      })
      if (res.ok) { toast.success(order.in_quickbooks ? 'Removed from QuickBooks' : 'Marked in QuickBooks'); fetchOrder() }
    } catch { toast.error('Failed to update') }
    finally { setIsSaving(false) }
  }

  async function toggleShopStatus() {
    if (!order) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent_to_shop: !order.sent_to_shop }),
      })
      if (res.ok) { toast.success(order.sent_to_shop ? 'Unmarked from shop' : 'Marked sent to shop'); fetchOrder() }
    } catch { toast.error('Failed to update') }
    finally { setIsSaving(false) }
  }

  async function saveFinalQtys() {
    if (!order) return
    setIsSaving(true)
    try {
      const updatedItems = order.items.map(item => ({
        part_id: item.part_id, customer_part_number: item.customer_part_number,
        description: item.description, quantity_ordered: item.quantity_ordered,
        quantity_final: finalQtys[item.id] ? parseInt(finalQtys[item.id]) : null,
        price_per_unit: item.price_per_unit, price_unit: item.price_unit,
        line_total: item.line_total, is_new_part: item.is_new_part, notes: item.notes,
      }))
      const res = await fetch(`/api/rnr/orders/${orderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems }),
      })
      if (res.ok) { toast.success('Final quantities saved'); setIsEditingQty(false); fetchOrder() }
      else toast.error('Failed to save quantities')
    } catch { toast.error('Failed to save') }
    finally { setIsSaving(false) }
  }

  async function deleteOrder() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/rnr/orders/${orderId}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Order deleted'); router.push('/dashboard/rnr-office/orders') }
      else toast.error('Failed to delete order')
    } catch { toast.error('Failed to delete') }
    finally { setIsDeleting(false) }
  }

  async function uploadFile(file: File) {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('setAsOriginal', 'false')
      const res = await fetch(`/api/rnr/orders/${orderId}/files`, { method: 'POST', body: formData })
      if (res.ok) { toast.success('File uploaded'); fetchFiles() }
      else toast.error('Failed to upload')
    } catch { toast.error('Upload failed') }
    finally { setIsUploading(false) }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) uploadFile(e.target.files[0])
  }

  function exportToCSV() {
    if (!order) return
    const headers = ['Part #', 'Customer Part #', 'Description', 'Species', 'Qty Ordered', 'Price', 'Unit', 'Total']
    const rows = order.items.map(i => [
      i.rnr_part_number || '', i.customer_part_number || '', `"${(i.description || '').replace(/"/g, '""')}"`,
      i.species_name || '', i.quantity_ordered, i.price_per_unit || '', i.price_unit || '', i.line_total || '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${order.order_number}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  function formatDate(d: string | null): string {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }
  if (!order) return null

  const flow = STATUS_FLOW[order.status]

  return (
    <>
      <div className="space-y-6 print:space-y-2">
        {/* Screen Header */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/rnr-office/orders"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <ClipboardList className="h-7 w-7 text-amber-600" />
                {order.order_number}
                {order.is_rush && <span className="flex items-center gap-1 text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold"><AlertTriangle size={13} />RUSH</span>}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800" onClick={openQBPopup}>
              <BookOpen size={14} />QB Entry
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportToCSV}><Download size={14} />Export CSV</Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}><Printer size={14} />Print</Button>
            {order.status === 'ordered' && (
              <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => setIsDeleteOpen(true)}><Trash2 size={14} />Delete</Button>
            )}
          </div>
        </div>

        {/* ===== PRINT VIEW ===== */}
        <div className="hidden print:block">
          <div className="border-b-2 border-black pb-3 mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">RNR Manufacturing</h1>
              <p className="text-sm text-gray-600">1361 County Road 108, Sugar Creek, OH 44681</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{order.order_number}</p>
              {order.is_rush && <p className="text-sm font-bold text-red-600">*** RUSH ORDER ***</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
            <div><span className="font-semibold">Customer:</span> {order.customer_name || '-'}</div>
            <div><span className="font-semibold">PO #:</span> {order.po_number || '-'}</div>
            <div><span className="font-semibold">Order Date:</span> {formatDate(order.order_date)}</div>
            <div><span className="font-semibold">Due Date:</span> {formatDate(order.due_date)}</div>
          </div>
          {order.notes && <div className="mb-4 text-sm"><span className="font-semibold">Notes:</span> {order.notes}</div>}
        </div>

        {/* Status + Tracking Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm print:border-0 print:shadow-none print:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <StatusBadge status={order.status} />
              <div className="text-sm text-gray-500">
                Created {formatDate(order.created_at)}
                {order.updated_at !== order.created_at && ` · Updated ${formatDate(order.updated_at)}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {flow && (
                <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm" onClick={() => updateStatus(flow.next)} disabled={isSaving}>
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <flow.icon size={14} />}{flow.action}
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
            <button onClick={toggleQBStatus} disabled={isSaving}
              className="flex items-center gap-2 text-sm hover:text-amber-700 transition-colors disabled:opacity-50">
              {order.in_quickbooks ? <CheckSquare size={18} className="text-green-600" /> : <Square size={18} className="text-gray-400" />}
              <span className={order.in_quickbooks ? 'text-green-700 font-medium' : 'text-gray-600'}>
                In QuickBooks
                {order.in_quickbooks_at && <span className="text-xs text-gray-400 ml-1">({formatDate(order.in_quickbooks_at)})</span>}
              </span>
            </button>
            <button onClick={toggleShopStatus} disabled={isSaving}
              className="flex items-center gap-2 text-sm hover:text-amber-700 transition-colors disabled:opacity-50">
              {order.sent_to_shop ? <CheckSquare size={18} className="text-green-600" /> : <Square size={18} className="text-gray-400" />}
              <span className={order.sent_to_shop ? 'text-green-700 font-medium' : 'text-gray-600'}>
                Sent to Shop
                {order.sent_to_shop_at && <span className="text-xs text-gray-400 ml-1">({formatDate(order.sent_to_shop_at)})</span>}
              </span>
            </button>
          </div>
        </div>

        {/* Order Info Grid — View or Edit */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm print:border-0 print:shadow-none print:hidden">
          {isEditingHeader ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Edit Order Details</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEditingHeader} disabled={isSaving}><X size={14} /></Button>
                  <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm" onClick={saveHeader} disabled={isSaving}>
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">Customer *</Label>
                  <Select value={editCustomerId || 'none'} onValueChange={v => setEditCustomerId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Select --</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.customer_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">PO #</Label>
                  <Input value={editPoNumber} onChange={e => setEditPoNumber(e.target.value)} placeholder="Customer PO number" />
                </div>
                <div>
                  <Label className="text-xs">Order Date *</Label>
                  <Input type="date" value={editOrderDate} onChange={e => setEditOrderDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} placeholder="Internal notes..." />
                </div>
                <div className="flex items-end">
                  <Button variant={editIsRush ? 'destructive' : 'outline'} className="gap-2" onClick={() => setEditIsRush(!editIsRush)}>
                    <AlertTriangle size={14} />{editIsRush ? 'RUSH ORDER' : 'Mark as Rush'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Order Details</h2>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditingHeader}>
                  <Pencil size={14} />Edit
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</label>
                  <p className="text-sm font-medium flex items-center gap-1">
                    {order.customer_name || '-'}
                    {order.customer_name && (
                      <button onClick={() => copyToClipboard(order.customer_name!, 'header-customer')}
                        className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors print:hidden"
                        title="Copy customer name">
                        {copiedCell === 'header-customer' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      </button>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">PO #</label>
                  <p className="text-sm font-mono flex items-center gap-1">
                    {order.po_number || '-'}
                    {order.po_number && (
                      <button onClick={() => copyToClipboard(order.po_number!, 'header-po')}
                        className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors print:hidden"
                        title="Copy PO number">
                        {copiedCell === 'header-po' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      </button>
                    )}
                  </p>
                </div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Order Date</label><p className="text-sm">{formatDate(order.order_date)}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</label><p className="text-sm font-medium">{formatDate(order.due_date)}</p></div>
              </div>
              {order.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</label>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Line Items — View or Edit */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border print:border-gray-400 print:rounded-none">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between print:bg-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Line Items ({isEditingItems ? editItems.length : order.items.length})
            </h2>
            <div className="flex items-center gap-2 print:hidden">
              {isEditingItems ? (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={addEditRow}><Plus size={14} />Add Row</Button>
                  <Button variant="outline" size="sm" onClick={cancelEditingItems} disabled={isSaving}><X size={14} /></Button>
                  <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm" onClick={saveItems} disabled={isSaving}>
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save Items
                  </Button>
                </>
              ) : isEditingQty ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditingQty(false)} disabled={isSaving}><X size={14} /></Button>
                  <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm" onClick={saveFinalQtys} disabled={isSaving}>
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditingItems}>
                    <Pencil size={14} />Edit Items
                  </Button>
                  {['in_production', 'complete'].includes(order.status) && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsEditingQty(true)}>
                      <Pencil size={14} />Edit Final Qty
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {isEditingItems ? (
            /* ===== EDIT LINE ITEMS TABLE ===== */
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-medium text-gray-600 w-[220px]">Part #</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-[90px]">Qty</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-[100px]">Price</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-600 w-[80px]">Unit</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-[100px]">Total</th>
                      <th className="w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editItems.map((item, idx) => (
                      <tr key={item.key} className={`border-b border-gray-100 ${item.is_new_part ? 'bg-amber-50' : ''}`}>
                        <td className="px-3 py-2 relative">
                          <div className="relative">
                            <Input
                              value={item.partSearch}
                              onChange={e => handlePartSearchChange(idx, e.target.value)}
                              onFocus={() => { if (item.partResults.length > 0) updateEditItem(idx, { showDropdown: true }) }}
                              onBlur={() => setTimeout(() => updateEditItem(idx, { showDropdown: false }), 200)}
                              placeholder="Search parts..."
                              className="font-mono text-xs pr-8"
                            />
                            {item.isSearching && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                            {item.part_id && !item.isSearching && <Check size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500" />}
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
                        </td>
                        <td className="px-3 py-2">
                          <Input value={item.description} onChange={e => updateEditItem(idx, { description: e.target.value })} placeholder="Description" className="text-xs" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" value={item.quantity_ordered} onChange={e => updateEditItem(idx, { quantity_ordered: e.target.value })} className="text-right text-xs font-mono" placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" step="0.0001" value={item.price_per_unit} onChange={e => updateEditItem(idx, { price_per_unit: e.target.value })} className="text-right text-xs font-mono" placeholder="0.00" />
                        </td>
                        <td className="px-3 py-2">
                          <Select value={item.price_unit} onValueChange={v => updateEditItem(idx, { price_unit: v })}>
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
                          <Button variant="ghost" size="sm" onClick={() => removeEditRow(idx)} disabled={editItems.length <= 1} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={addEditRow}><Plus size={14} />Add Row</Button>
                <div className="text-right">
                  <span className="text-sm text-gray-500 mr-3">Order Total:</span>
                  <span className="text-lg font-bold text-gray-900 font-mono">${editItemsTotal()}</span>
                </div>
              </div>
            </>
          ) : (
            /* ===== VIEW LINE ITEMS TABLE ===== */
            <>
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
                            {item.is_new_part && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full print:bg-gray-800">NEW</span>}
                            {(item.rnr_part_number || item.customer_part_number) && (
                              <button onClick={() => copyToClipboard((item.rnr_part_number || item.customer_part_number)!, `part-${item.id}`)}
                                className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors print:hidden"
                                title="Copy part number">
                                {copiedCell === `part-${item.id}` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                              </button>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate">{item.description || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{item.species_name || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          <span className="inline-flex items-center gap-1 justify-end">
                            {item.quantity_ordered}
                            <button onClick={() => copyToClipboard(item.quantity_ordered.toString(), `qty-${item.id}`)}
                              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors print:hidden"
                              title="Copy quantity">
                              {copiedCell === `qty-${item.id}` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                            </button>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {isEditingQty ? (
                            <Input type="number" value={finalQtys[item.id] || ''} onChange={e => setFinalQtys({ ...finalQtys, [item.id]: e.target.value })}
                              className="w-20 text-right text-xs font-mono ml-auto" placeholder="-" />
                          ) : (
                            <span className={`font-mono text-xs ${item.quantity_final !== null && item.quantity_final !== item.quantity_ordered ? 'text-amber-600 font-semibold' : ''}`}>
                              {item.quantity_final !== null ? item.quantity_final : '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          <span className="inline-flex items-center gap-1 justify-end">
                            {item.price_per_unit ? `$${Number(item.price_per_unit).toFixed(4)}` : '-'}
                            {item.price_per_unit && (
                              <button onClick={() => copyToClipboard(Number(item.price_per_unit).toFixed(4), `price-${item.id}`)}
                                className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors print:hidden"
                                title="Copy price">
                                {copiedCell === `price-${item.id}` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                              </button>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{item.price_unit || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">{item.line_total ? `$${Number(item.line_total).toFixed(2)}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={7} className="px-4 py-3 text-right font-semibold text-gray-700">Order Total</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{order.total_price ? `$${Number(order.total_price).toFixed(2)}` : '-'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Print footer */}
        <div className="hidden print:block mt-6 pt-4 border-t border-gray-300 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Printed: {new Date().toLocaleDateString()}</span>
            <span>RNR Manufacturing Internal Use</span>
          </div>
        </div>

        {/* Attached Files (screen only) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Attached Files ({files.length})
            </h2>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput} />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}Attach File
              </Button>
            </div>
          </div>

          {order.original_file_url && (
            <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Original Order: {order.original_file_name}</span>
              </div>
              <a href={order.original_file_url} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700">
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          {files.length === 0 && !order.original_file_url && (
            <p className="text-sm text-gray-400 text-center py-4">No files attached. Click &quot;Attach File&quot; to add order documents.</p>
          )}

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(f => (
                <div key={f.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{f.file_name}</span>
                    <span className="text-xs text-gray-400">{(f.file_size / 1024).toFixed(0)} KB</span>
                  </div>
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-amber-600">
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Order</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete order <span className="font-mono font-semibold">{order.order_number}</span>? This cannot be undone.
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
