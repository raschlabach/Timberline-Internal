'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SkidEditor, FreightSkid } from '@/components/freight/skid-editor'
import { FreightPrintView } from '@/components/freight/freight-print-view'
import { ArrowLeft, Save, Loader2, Eye, Pencil, Printer, Download, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'

interface OrderData {
  id: number
  customer: string
  po_number: string | null
  is_done: boolean
  skids: Array<{
    id: number
    skid_number: string | null
    po_number: string | null
    width: number | null
    length: number | null
    height: number | null
    weight: number | null
    sort_order: number
  }>
}

function apiSkidToLocal(skid: OrderData['skids'][number]): FreightSkid {
  return {
    id: skid.id,
    skid_number: skid.skid_number || '',
    po_number: skid.po_number || '',
    width: skid.width?.toString() || '',
    length: skid.length?.toString() || '',
    height: skid.height?.toString() || '',
    weight: skid.weight?.toString() || '',
  }
}

export default function FreightOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params?.orderId as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'report'>('edit')
  const printRef = useRef<HTMLDivElement>(null)

  const [customer, setCustomer] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [isDone, setIsDone] = useState(false)
  const [skids, setSkids] = useState<FreightSkid[]>([])

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/freight-orders/${orderId}`)
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Order not found')
          router.push('/dashboard/lumber/freight')
          return
        }
        throw new Error('Failed to fetch')
      }
      const data: OrderData = await res.json()
      setCustomer(data.customer || '')
      setPoNumber(data.po_number || '')
      setIsDone(data.is_done ?? false)
      setSkids(data.skids.map(apiSkidToLocal))
    } catch {
      toast.error('Failed to load order')
    } finally {
      setIsLoading(false)
    }
  }, [orderId, router])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  function buildPayload(overrides?: { is_done?: boolean }) {
    return {
      customer: customer.trim(),
      po_number: poNumber.trim() || null,
      is_done: overrides?.is_done ?? isDone,
      skids: skids.map(s => ({
        skid_number: s.skid_number || null,
        po_number: s.po_number || null,
        width: s.width ? parseFloat(s.width) : null,
        length: s.length ? parseFloat(s.length) : null,
        height: s.height ? parseFloat(s.height) : null,
        weight: s.weight ? parseFloat(s.weight) : null,
      })),
    }
  }

  async function handleSave() {
    if (!customer.trim()) {
      toast.error('Customer name is required')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/freight-orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated: OrderData = await res.json()
      setSkids(updated.skids.map(apiSkidToLocal))
      toast.success('Order saved')
    } catch {
      toast.error('Failed to save order')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleDone() {
    const newValue = !isDone
    setIsDone(newValue)
    try {
      const res = await fetch(`/api/freight-orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload({ is_done: newValue })),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(newValue ? 'Order marked as done' : 'Order marked as active')
    } catch {
      setIsDone(!newValue)
      toast.error('Failed to update status')
    }
  }

  const handlePrint = useReactToPrint({
    documentTitle: `Freight-${customer || orderId}-${poNumber || 'no-po'}`,
    contentRef: printRef,
    pageStyle: `
      @page { size: letter portrait; margin: 0.5in; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  async function handleDownloadPdf() {
    if (!printRef.current) return
    setIsDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      } as Parameters<typeof html2canvas>[1] & { scale?: number })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'in', 'letter')

      const imgWidth = 7.5
      const pageHeight = 10
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0.5, 0.5, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0.5, position + 0.5, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const filename = `Freight-${customer || orderId}-${poNumber || 'no-po'}.pdf`
      pdf.save(filename)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  function handlePoChange(value: string) {
    const oldPo = poNumber
    setPoNumber(value)
    setSkids(prev => prev.map(s => ({
      ...s,
      po_number: s.po_number === oldPo ? value : s.po_number,
    })))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading order...</span>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/lumber/freight')}
            className="gap-1.5 text-gray-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {customer || 'Freight Order'} {poNumber && <span className="text-gray-400 font-normal">— {poNumber}</span>}
            </h1>
            <p className="text-xs text-gray-500">Order #{orderId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'edit'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => setViewMode('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'report'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> Report
            </button>
          </div>
          {viewMode === 'report' && (
            <>
              <Button variant="outline" size="sm" onClick={() => handlePrint()} className="gap-1.5">
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isDownloading} className="gap-1.5">
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
            </>
          )}
          <Button
            variant={isDone ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleDone}
            className={`gap-1.5 ${isDone ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            {isDone ? 'Done' : 'Mark Done'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Customer *</Label>
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Enter customer name"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">PO #</Label>
            <Input
              value={poNumber}
              onChange={(e) => handlePoChange(e.target.value)}
              placeholder="Enter PO number"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'edit' ? (
        <SkidEditor skids={skids} mainPo={poNumber} onChange={setSkids} />
      ) : (
        <FreightPrintView ref={printRef} customer={customer} poNumber={poNumber} skids={skids} />
      )}
    </div>
  )
}
