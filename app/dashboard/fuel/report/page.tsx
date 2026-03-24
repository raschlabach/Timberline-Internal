"use client"

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, FileText, Printer, Download, Fuel, Search } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

interface ReportFillup {
  id: number
  fillup_date: string
  truck_name: string
  driver_name: string | null
  mileage: number
  gallons: string | number
  notes: string | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function FuelReportPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [fillups, setFillups] = useState<ReportFillup[]>([])
  const [totalGallons, setTotalGallons] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Fuel Report ${startDate} to ${endDate}`,
  })

  async function handleSearch() {
    if (!startDate || !endDate) return
    setIsLoading(true)
    setHasSearched(true)
    try {
      const res = await fetch(`/api/fuel/report?startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      setFillups(data.fillups || [])
      setTotalGallons(data.totalGallons || 0)
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDownloadPDF() {
    if (!printRef.current) return
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default

    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      useCORS: true,
    } as Parameters<typeof html2canvas>[1] & { scale?: number })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'letter')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const imgWidth = pageWidth - 20
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
    pdf.save(`fuel-report-${startDate}-to-${endDate}.pdf`)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/fuel">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <FileText className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fuel Report</h1>
            <p className="text-sm text-gray-500">Truck fill-up records by date range</p>
          </div>
        </div>
        {fillups.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-1.5">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        )}
      </div>

      {/* Date Range Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[160px]">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[160px]">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!startDate || !endDate || isLoading}
              className="bg-blue-600 hover:bg-blue-700 gap-1.5"
            >
              <Search className="h-4 w-4" />
              {isLoading ? 'Loading...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {hasSearched && (
        <div ref={printRef} className="bg-white">
          <div className="text-center py-4 print:py-2">
            <h2 className="text-xl font-bold text-gray-900">Timberline Trucking</h2>
            <p className="text-sm text-gray-500">Fuel Report</p>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Truck Fill-up Report</CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatDate(startDate + 'T00:00:00')} - {formatDate(endDate + 'T00:00:00')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-700">{totalGallons.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">total gallons</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {fillups.length === 0 ? (
                <div className="p-8 text-center">
                  <Fuel className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No fill-ups in this date range</p>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_100px_100px_1fr] gap-2 px-6 py-2 bg-gray-50 border-y text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <div>Date</div>
                    <div>Driver</div>
                    <div>Truck</div>
                    <div className="text-right">Mileage</div>
                    <div className="text-right">Gallons</div>
                    <div>Notes</div>
                  </div>

                  <div className="divide-y">
                    {fillups.map((f) => (
                      <div key={f.id} className="px-4 md:px-6 py-3 hover:bg-gray-50/50 transition-colors">
                        {/* Desktop */}
                        <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_100px_100px_1fr] gap-2 items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{formatDate(f.fillup_date)}</div>
                            <div className="text-xs text-gray-400">{formatTime(f.fillup_date)}</div>
                          </div>
                          <div className="text-sm text-gray-700">{f.driver_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-700">{f.truck_name}</div>
                          <div className="text-sm text-gray-700 text-right font-mono">{Number(f.mileage).toLocaleString()}</div>
                          <div className="text-sm font-semibold text-blue-700 text-right">{parseFloat(String(f.gallons)).toFixed(1)}</div>
                          <div className="text-xs text-gray-400 truncate">{f.notes || '-'}</div>
                        </div>
                        {/* Mobile */}
                        <div className="md:hidden space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{formatDate(f.fillup_date)}</span>
                            <span className="text-sm font-bold text-blue-700">{parseFloat(String(f.gallons)).toFixed(1)} gal</span>
                          </div>
                          <div className="text-sm text-gray-600">{f.driver_name || 'Unknown'} &rarr; {f.truck_name}</div>
                          <div className="text-xs text-gray-400">Mileage: {Number(f.mileage).toLocaleString()}</div>
                          {f.notes && <div className="text-xs text-gray-400">{f.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary footer */}
                  <div className="px-6 py-4 bg-blue-50 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-800">
                        {fillups.length} fill-up{fillups.length !== 1 ? 's' : ''} in range
                      </span>
                      <span className="text-lg font-bold text-blue-800">
                        Total: {totalGallons.toFixed(1)} gallons
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
