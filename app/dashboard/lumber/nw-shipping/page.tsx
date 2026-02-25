'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArchboldPartsManager } from '@/components/nw-shipping/archbold-parts-manager'
import { Plus, FileText, Trash2, Loader2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ArchboldPart {
  id: number
  item_code: string
  width: number | null
  length: number | null
  used_for: string | null
}

interface ShippingReport {
  id: number
  northwest_po: string | null
  archbold_po: string | null
  item_count: number
  total_qty: number
  created_at: string
  updated_at: string
}

export default function NWShippingPage() {
  const router = useRouter()
  const [reports, setReports] = useState<ShippingReport[]>([])
  const [parts, setParts] = useState<ArchboldPart[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(true)
  const [isLoadingParts, setIsLoadingParts] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/nw-shipping-reports')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setReports(data)
    } catch {
      toast.error('Failed to load shipping reports')
    } finally {
      setIsLoadingReports(false)
    }
  }, [])

  const fetchParts = useCallback(async () => {
    try {
      const res = await fetch('/api/archbold-parts')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setParts(data)
    } catch {
      toast.error('Failed to load archbold parts')
    } finally {
      setIsLoadingParts(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
    fetchParts()
  }, [fetchReports, fetchParts])

  async function handleCreateReport() {
    setIsCreating(true)
    try {
      const res = await fetch('/api/nw-shipping-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Failed to create')
      const report = await res.json()
      router.push(`/dashboard/lumber/nw-shipping/${report.id}`)
    } catch {
      toast.error('Failed to create report')
      setIsCreating(false)
    }
  }

  async function handleDeleteReport(id: number) {
    if (!confirm('Delete this shipping report? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/nw-shipping-reports/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Report deleted')
      setReports(prev => prev.filter(r => r.id !== id))
    } catch {
      toast.error('Failed to delete report')
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Northwest Shipping Report</h1>
          <p className="text-sm text-gray-500 mt-1">Manage shipping reports and Archbold parts</p>
        </div>
        <Button onClick={handleCreateReport} disabled={isCreating} className="gap-2">
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Report
        </Button>
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="mb-4">
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Shipping Reports
          </TabsTrigger>
          <TabsTrigger value="parts" className="gap-1.5">
            <Package className="h-4 w-4" />
            Archbold Parts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingReports ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading reports...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500">No reports yet</p>
                  <p className="text-sm text-gray-400 mt-1">Create your first Northwest shipping report</p>
                  <Button onClick={handleCreateReport} disabled={isCreating} variant="outline" className="mt-4 gap-1.5">
                    <Plus className="h-4 w-4" /> New Report
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-y">
                        <th className="px-4 py-2.5 text-left font-medium text-gray-500">NW PO #</th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-500">Archbold PO #</th>
                        <th className="px-4 py-2.5 text-right font-medium text-gray-500">Items</th>
                        <th className="px-4 py-2.5 text-right font-medium text-gray-500">Total Qty</th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-500">Created</th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-500">Updated</th>
                        <th className="px-4 py-2.5 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map(report => (
                        <tr
                          key={report.id}
                          className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/dashboard/lumber/nw-shipping/${report.id}`)}
                        >
                          <td className="px-4 py-3 font-medium">
                            {report.northwest_po || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {report.archbold_po || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">{report.item_count}</td>
                          <td className="px-4 py-3 text-right font-medium">{report.total_qty}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {format(new Date(report.updated_at), 'MMM d, yyyy h:mm a')}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteReport(report.id)
                              }}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                              title="Delete report"
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parts">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Archbold Parts</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Manage item codes with their dimensions. These are available for selection when entering shipping report line items.
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingParts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading parts...</span>
                </div>
              ) : (
                <ArchboldPartsManager parts={parts} onPartsChanged={fetchParts} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
