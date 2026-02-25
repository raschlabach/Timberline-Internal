'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReportEditor, ReportLineItem } from '@/components/nw-shipping/report-editor'
import { GroupedView } from '@/components/nw-shipping/grouped-view'
import { ArrowLeft, Save, Loader2, Eye, Pencil, Printer, Download } from 'lucide-react'
import { toast } from 'sonner'

interface ArchboldPart {
  id: number
  item_code: string
  width: number | null
  length: number | null
  used_for: string | null
}

interface ReportData {
  id: number
  northwest_po: string | null
  archbold_po: string | null
  delivery_date: string | null
  items: Array<{
    id: number
    pallet_number: string | null
    pallet_tag: string | null
    archbold_part_id: number | null
    qty_per_skid: number | null
    skid_width: number | null
    skid_length: number | null
    skid_height: number | null
    skid_weight: number | null
    sort_order: number
    item_code: string | null
    part_width: number | null
    part_length: number | null
    used_for: string | null
  }>
}

function apiItemToLocal(item: ReportData['items'][number]): ReportLineItem {
  return {
    id: item.id,
    pallet_number: item.pallet_number || '',
    pallet_tag: item.pallet_tag || '',
    archbold_part_id: item.archbold_part_id,
    item_code: item.item_code || undefined,
    part_width: item.part_width,
    part_length: item.part_length,
    used_for: item.used_for,
    qty_per_skid: item.qty_per_skid?.toString() || '',
    skid_width: item.skid_width?.toString() || '',
    skid_length: item.skid_length?.toString() || '',
    skid_height: item.skid_height?.toString() || '',
    skid_weight: item.skid_weight?.toString() || '',
  }
}

export default function NWShippingReportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const reportId = params?.reportId as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'grouped'>('edit')
  const printRef = useRef<HTMLDivElement>(null)

  const [northwestPo, setNorthwestPo] = useState('')
  const [archboldPo, setArchboldPo] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [items, setItems] = useState<ReportLineItem[]>([])
  const [parts, setParts] = useState<ArchboldPart[]>([])

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/nw-shipping-reports/${reportId}`)
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Report not found')
          router.push('/dashboard/lumber/nw-shipping')
          return
        }
        throw new Error('Failed to fetch')
      }
      const data: ReportData = await res.json()
      setNorthwestPo(data.northwest_po || '')
      setArchboldPo(data.archbold_po || '')
      setDeliveryDate(data.delivery_date || '')
      setItems(data.items.map(apiItemToLocal))
    } catch {
      toast.error('Failed to load report')
    } finally {
      setIsLoading(false)
    }
  }, [reportId, router])

  const fetchParts = useCallback(async () => {
    try {
      const res = await fetch('/api/archbold-parts')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setParts(data)
    } catch {
      toast.error('Failed to load archbold parts')
    }
  }, [])

  useEffect(() => {
    fetchReport()
    fetchParts()
  }, [fetchReport, fetchParts])

  async function handleSave() {
    setIsSaving(true)
    try {
      const payload = {
        northwest_po: northwestPo || null,
        archbold_po: archboldPo || null,
        delivery_date: deliveryDate || null,
        items: items.map(item => ({
          pallet_number: item.pallet_number || null,
          pallet_tag: item.pallet_tag || null,
          archbold_part_id: item.archbold_part_id || null,
          qty_per_skid: item.qty_per_skid ? parseInt(item.qty_per_skid) : null,
          skid_width: item.skid_width ? parseFloat(item.skid_width) : null,
          skid_length: item.skid_length ? parseFloat(item.skid_length) : null,
          skid_height: item.skid_height ? parseFloat(item.skid_height) : null,
          skid_weight: item.skid_weight ? parseFloat(item.skid_weight) : null,
        })),
      }

      const res = await fetch(`/api/nw-shipping-reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save')

      const updatedData: ReportData = await res.json()
      setItems(updatedData.items.map(apiItemToLocal))
      toast.success('Report saved')
    } catch {
      toast.error('Failed to save report')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = useReactToPrint({
    documentTitle: `NW-Shipping-Report-${northwestPo || reportId}`,
    contentRef: printRef,
    pageStyle: `
      @page { size: letter landscape; margin: 0.4in; }
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
      const pdf = new jsPDF('l', 'in', 'letter')

      const imgWidth = 10
      const pageHeight = 7.5
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

      const filename = `NW-Shipping-Report-${northwestPo || reportId}.pdf`
      pdf.save(filename)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading report...</span>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/lumber/nw-shipping')}
            className="gap-1.5 text-gray-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Shipping Report #{reportId}</h1>
            <p className="text-xs text-gray-500">
              {northwestPo ? `NW PO: ${northwestPo}` : 'No NW PO set'}
              {archboldPo ? ` • Archbold PO: ${archboldPo}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
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
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> Grouped View
            </button>
          </div>
          {viewMode === 'grouped' && (
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
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {/* PO Number Inputs */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm font-medium">Northwest PO #</Label>
            <Input
              value={northwestPo}
              onChange={(e) => setNorthwestPo(e.target.value)}
              placeholder="Enter Northwest PO number"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Archbold PO #</Label>
            <Input
              value={archboldPo}
              onChange={(e) => setArchboldPo(e.target.value)}
              placeholder="Enter Archbold PO number"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Delivery Date</Label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'edit' ? (
        <ReportEditor items={items} parts={parts} archboldPo={archboldPo} onChange={setItems} />
      ) : (
        <GroupedView ref={printRef} items={items} northwestPo={northwestPo} archboldPo={archboldPo} deliveryDate={deliveryDate} />
      )}
    </div>
  )
}
