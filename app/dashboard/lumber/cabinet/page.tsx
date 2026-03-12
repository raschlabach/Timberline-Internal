'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Trash2, Loader2, CheckCircle2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  processWorkbook,
  processSpecialTabs,
  collectUploadCombos,
} from '@/lib/cabinet-processing'
import type { ProcessedSheet, SpecialTabResult } from '@/lib/cabinet-processing'

interface CabinetOrder {
  id: number
  file_name: string
  po_numbers: string[]
  due_date: string | null
  is_done: boolean
  sheet_count: number
  special_count: number
  created_at: string
  updated_at: string
}

export default function CabinetOrderListPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<CabinetOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/lumber/cabinet/orders')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setOrders(data)
    } catch {
      toast.error('Failed to load cabinet orders')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  async function handleDeleteOrder(id: number) {
    if (!confirm('Delete this order? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/lumber/cabinet/orders/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Order deleted')
      setOrders(prev => prev.filter(r => r.id !== id))
    } catch {
      toast.error('Failed to delete order')
    }
  }

  function processAndSave(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }

    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const processedSheets: ProcessedSheet[] = processWorkbook(workbook)
        const specialResults: SpecialTabResult[] = processSpecialTabs(workbook)
        const uploadCombos = collectUploadCombos(processedSheets, specialResults)

        const allPOs = processedSheets
          .map(s => s.poNumber)
          .filter(po => po && po.trim() !== '')
        const firstDueDate = processedSheets.find(s => s.dueDate)?.dueDate || null

        const res = await fetch('/api/lumber/cabinet/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            po_numbers: Array.from(new Set(allPOs)),
            due_date: firstDueDate,
            processed_sheets: processedSheets,
            special_results: specialResults,
            upload_combos: uploadCombos,
          }),
        })

        if (!res.ok) throw new Error('Failed to save')
        const saved = await res.json()
        toast.success('Order uploaded and saved')
        router.push(`/dashboard/lumber/cabinet/${saved.id}`)
      } catch {
        toast.error('Failed to process and save order')
        setIsUploading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragOver(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processAndSave(file)
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processAndSave(file)
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cabinet Shop Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Upload and manage Nature&apos;s Blend order files</p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Plus className="h-4 w-4" />}
          Upload Order
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
        </Button>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer mb-6 ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
            : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
        }`}
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="text-lg font-medium text-gray-700">Processing and saving...</p>
          </div>
        ) : (
          <>
            <FileSpreadsheet className={`h-12 w-12 mx-auto mb-3 ${isDragOver ? 'text-emerald-500' : 'text-gray-400'}`} />
            <p className="text-lg font-medium text-gray-700">Drop Nature&apos;s Blend .xlsx file here</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse &mdash; the order will be saved automatically</p>
          </>
        )}
      </div>

      {/* Saved Orders Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <span className="font-semibold text-gray-900">Saved Orders</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading orders...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No orders yet</p>
            <p className="text-sm text-gray-400 mt-1">Upload a Nature&apos;s Blend .xlsx file to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-y">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 w-16">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">File</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">PO #</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Due Date</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">Tabs</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">Rip/Mould</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Uploaded</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr
                    key={order.id}
                    className={`border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors ${
                      order.is_done ? 'opacity-60' : ''
                    }`}
                    onClick={() => router.push(`/dashboard/lumber/cabinet/${order.id}`)}
                  >
                    <td className="px-4 py-3">
                      {order.is_done
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />}
                    </td>
                    <td className="px-4 py-3 font-medium">{order.file_name}</td>
                    <td className="px-4 py-3">
                      {order.po_numbers.length > 0
                        ? order.po_numbers.slice(0, 3).join(', ') + (order.po_numbers.length > 3 ? ` +${order.po_numbers.length - 3}` : '')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {order.due_date || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{order.sheet_count}</td>
                    <td className="px-4 py-3 text-right">{order.special_count}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteOrder(order.id)
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
      </div>
    </div>
  )
}
