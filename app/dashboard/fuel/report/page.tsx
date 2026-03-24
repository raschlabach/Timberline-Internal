"use client"

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, FileText, Printer, Download, Fuel, Search, CalendarDays } from 'lucide-react'
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

interface ExternalTransaction {
  id: number
  transaction_date: string
  merchant_name: string
  merchant_city: string
  state: string
  invoice_number: string
  odometer: number
  product_code: string
  quantity: string | number
  unit_cost: string | number
  trans_amount: string | number
  vehicle_description: string
  truck_id: number | null
  truck_name: string | null
}

interface TruckReport {
  truckName: string
  driverName: string
  fillups: ReportFillup[]
  totalGallons: number
  externalTxns: ExternalTransaction[]
  totalExternalGallons: number
  totalExternalAmount: number
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateRange(start: string, end: string): string {
  return `${formatDate(start + 'T00:00:00')} - ${formatDate(end + 'T00:00:00')}`
}

function formatCurrency(val: number): string {
  return '$' + val.toFixed(2)
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function getLastMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function buildTruckReports(
  fillups: ReportFillup[],
  externalTxns: ExternalTransaction[]
): TruckReport[] {
  const map = new Map<string, TruckReport>()

  for (const f of fillups) {
    const key = f.truck_name
    if (!map.has(key)) {
      map.set(key, {
        truckName: key,
        driverName: '',
        fillups: [],
        totalGallons: 0,
        externalTxns: [],
        totalExternalGallons: 0,
        totalExternalAmount: 0,
      })
    }
    map.get(key)!.fillups.push(f)
  }

  for (const t of externalTxns) {
    const key = t.truck_name || `Unmatched (${t.vehicle_description})`
    if (!map.has(key)) {
      map.set(key, {
        truckName: key,
        driverName: '',
        fillups: [],
        totalGallons: 0,
        externalTxns: [],
        totalExternalGallons: 0,
        totalExternalAmount: 0,
      })
    }
    map.get(key)!.externalTxns.push(t)
  }

  const reports = Array.from(map.values()).map((report) => {
    const driverNames = Array.from(new Set(report.fillups.map(f => f.driver_name || 'Unknown')))
    report.driverName = report.fillups.length > 0 ? driverNames.join(', ') : '-'
    report.totalGallons = report.fillups.reduce((sum, f) => sum + (parseFloat(String(f.gallons)) || 0), 0)
    report.totalExternalGallons = report.externalTxns.reduce((sum, t) => sum + (parseFloat(String(t.quantity)) || 0), 0)
    report.totalExternalAmount = report.externalTxns.reduce((sum, t) => sum + (parseFloat(String(t.trans_amount)) || 0), 0)
    return report
  })

  return reports.sort((a, b) => a.truckName.localeCompare(b.truckName))
}

export default function FuelReportPage() {
  const currentMonth = getCurrentMonthRange()
  const [startDate, setStartDate] = useState(currentMonth.start)
  const [endDate, setEndDate] = useState(currentMonth.end)
  const [truckReports, setTruckReports] = useState<TruckReport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const truckRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    handleSearch()
  }, [])

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Fuel Reports ${startDate} to ${endDate}`,
  })

  function setLastMonth() {
    const range = getLastMonthRange()
    setStartDate(range.start)
    setEndDate(range.end)
  }

  function setCurrentMonth() {
    const range = getCurrentMonthRange()
    setStartDate(range.start)
    setEndDate(range.end)
  }

  async function handleSearch() {
    if (!startDate || !endDate) return
    setIsLoading(true)
    setHasSearched(true)
    try {
      const [fillupRes, externalRes] = await Promise.all([
        fetch(`/api/fuel/report?startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/fuel/external-transactions?startDate=${startDate}&endDate=${endDate}`),
      ])
      const fillupData = await fillupRes.json()
      const externalData = await externalRes.json()

      const fillups: ReportFillup[] = fillupData.fillups || []
      const externalTxns: ExternalTransaction[] = externalData.transactions || []
      const grouped = buildTruckReports(fillups, externalTxns)
      setTruckReports(grouped)
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDownloadAll() {
    if (truckReports.length === 0) return
    setIsDownloading(true)

    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      for (const report of truckReports) {
        const el = truckRefs.current.get(report.truckName)
        if (!el) continue

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
        } as Parameters<typeof html2canvas>[1] & { scale?: number })

        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'mm', 'letter')
        const pageWidth = pdf.internal.pageSize.getWidth()
        const imgWidth = pageWidth - 20
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
        const safeName = report.truckName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')
        pdf.save(`${safeName}_${startDate}_to_${endDate}.pdf`)

        await new Promise(resolve => setTimeout(resolve, 300))
      }
    } catch (error) {
      console.error('Error downloading PDFs:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const dateRangeLabel = startDate && endDate ? formatDateRange(startDate, endDate) : ''

  const grandTotalGallons = truckReports.reduce((s, r) => s + r.totalGallons, 0)
  const grandTotalExtGallons = truckReports.reduce((s, r) => s + r.totalExternalGallons, 0)
  const grandTotalExtAmount = truckReports.reduce((s, r) => s + r.totalExternalAmount, 0)
  const grandTotalFillups = truckReports.reduce((s, r) => s + r.fillups.length, 0)
  const grandTotalExtTxns = truckReports.reduce((s, r) => s + r.externalTxns.length, 0)
  const hasAnyData = truckReports.length > 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
        {hasAnyData && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Print All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={isDownloading}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'Downloading...' : 'Download All PDFs'}
            </Button>
          </div>
        )}
      </div>

      {/* Date Range Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={setCurrentMonth} className="gap-1.5 whitespace-nowrap">
                <CalendarDays className="h-3.5 w-3.5" />
                This Month
              </Button>
              <Button variant="outline" size="sm" onClick={setLastMonth} className="gap-1.5 whitespace-nowrap">
                <CalendarDays className="h-3.5 w-3.5" />
                Last Month
              </Button>
            </div>
            <Button
              onClick={handleSearch}
              disabled={!startDate || !endDate || isLoading}
              className="bg-blue-600 hover:bg-blue-700 gap-1.5"
            >
              <Search className="h-4 w-4" />
              {isLoading ? 'Loading...' : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports - one per truck */}
      {hasSearched && (
        <div ref={printRef} className="space-y-8">
          {!hasAnyData ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Fuel className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No fuel data in this date range</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {truckReports.map((report) => (
                <div
                  key={report.truckName}
                  ref={(el) => {
                    if (el) truckRefs.current.set(report.truckName, el)
                  }}
                  className="bg-white print:break-before-page first:print:break-before-auto"
                >
                  {/* Company header */}
                  <div className="text-center pt-4 pb-2">
                    <h2 className="text-xl font-bold text-gray-900">Timberline Trucking</h2>
                    <p className="text-sm text-gray-500">Fuel Report</p>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{report.truckName}</CardTitle>
                          {report.driverName !== '-' && (
                            <p className="text-sm text-gray-600 mt-0.5">Driver: {report.driverName}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">{dateRangeLabel}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-700">
                            {(report.totalGallons + report.totalExternalGallons).toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">total gallons</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 space-y-0 divide-y-0">
                      {/* On-Site Tank Section */}
                      {report.fillups.length > 0 && (
                        <div>
                          <div className="px-6 py-2 bg-blue-50 border-y">
                            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">On-Site Tank</span>
                          </div>
                          <div className="hidden md:grid grid-cols-[1fr_100px_100px_1fr] gap-2 px-6 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <div>Date</div>
                            <div className="text-right">Mileage</div>
                            <div className="text-right">Gallons</div>
                            <div>Notes</div>
                          </div>
                          <div className="divide-y">
                            {report.fillups.map((f) => (
                              <div key={f.id} className="px-4 md:px-6 py-3">
                                <div className="hidden md:grid grid-cols-[1fr_100px_100px_1fr] gap-2 items-center">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{formatDate(f.fillup_date)}</div>
                                    <div className="text-xs text-gray-400">{formatTime(f.fillup_date)}</div>
                                  </div>
                                  <div className="text-sm text-gray-700 text-right font-mono">{Number(f.mileage).toLocaleString()}</div>
                                  <div className="text-sm font-semibold text-blue-700 text-right">{parseFloat(String(f.gallons)).toFixed(1)}</div>
                                  <div className="text-xs text-gray-400 truncate">{f.notes || '-'}</div>
                                </div>
                                <div className="md:hidden space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-900">{formatDate(f.fillup_date)}</span>
                                    <span className="text-sm font-bold text-blue-700">{parseFloat(String(f.gallons)).toFixed(1)} gal</span>
                                  </div>
                                  <div className="text-xs text-gray-400">Mileage: {Number(f.mileage).toLocaleString()}</div>
                                  {f.notes && <div className="text-xs text-gray-400">{f.notes}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-6 py-2 bg-blue-50/50 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-800">
                                {report.fillups.length} fill-up{report.fillups.length !== 1 ? 's' : ''}
                              </span>
                              <span className="text-sm font-bold text-blue-800">
                                {report.totalGallons.toFixed(1)} gallons
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Red Rover / External Section */}
                      {report.externalTxns.length > 0 && (
                        <div>
                          <div className="px-6 py-2 bg-orange-50 border-y">
                            <span className="text-xs font-semibold text-orange-800 uppercase tracking-wide">Red Rover / External</span>
                          </div>
                          <div className="hidden md:grid grid-cols-[1fr_1fr_80px_80px_80px_90px] gap-2 px-6 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <div>Date</div>
                            <div>Merchant</div>
                            <div className="text-right">Odometer</div>
                            <div className="text-right">Gallons</div>
                            <div className="text-right">$/Gal</div>
                            <div className="text-right">Amount</div>
                          </div>
                          <div className="divide-y">
                            {report.externalTxns.map((t) => (
                              <div key={t.id} className="px-4 md:px-6 py-2.5">
                                <div className="hidden md:grid grid-cols-[1fr_1fr_80px_80px_80px_90px] gap-2 items-center">
                                  <div className="text-sm text-gray-900">{formatDate(String(t.transaction_date).slice(0, 10) + 'T00:00:00')}</div>
                                  <div className="text-sm text-gray-700 truncate">
                                    {t.merchant_name}
                                    <span className="text-gray-400 ml-1">{t.merchant_city}, {t.state}</span>
                                  </div>
                                  <div className="text-sm text-gray-600 text-right font-mono">
                                    {t.odometer ? Number(t.odometer).toLocaleString() : '-'}
                                  </div>
                                  <div className="text-sm font-semibold text-orange-700 text-right">
                                    {parseFloat(String(t.quantity)).toFixed(1)}
                                  </div>
                                  <div className="text-sm text-gray-500 text-right">
                                    {formatCurrency(parseFloat(String(t.unit_cost)))}
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900 text-right">
                                    {formatCurrency(parseFloat(String(t.trans_amount)))}
                                  </div>
                                </div>
                                <div className="md:hidden space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-900">{formatDate(String(t.transaction_date).slice(0, 10) + 'T00:00:00')}</span>
                                    <span className="text-sm font-bold text-gray-900">{formatCurrency(parseFloat(String(t.trans_amount)))}</span>
                                  </div>
                                  <div className="text-xs text-gray-500">{t.merchant_name}, {t.merchant_city}</div>
                                  <div className="text-xs text-gray-400">
                                    {parseFloat(String(t.quantity)).toFixed(1)} gal @ {formatCurrency(parseFloat(String(t.unit_cost)))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-6 py-2 bg-orange-50/50 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-orange-800">
                                {report.externalTxns.length} transaction{report.externalTxns.length !== 1 ? 's' : ''}
                                <span className="mx-1">&middot;</span>
                                {report.totalExternalGallons.toFixed(1)} gal
                              </span>
                              <span className="text-sm font-bold text-orange-800">
                                {formatCurrency(report.totalExternalAmount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Combined total for this truck */}
                      {report.fillups.length > 0 && report.externalTxns.length > 0 && (
                        <div className="px-6 py-3 bg-gray-50 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">Combined Total</span>
                            <span className="text-lg font-bold text-gray-900">
                              {(report.totalGallons + report.totalExternalGallons).toFixed(1)} gallons
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}

              {/* Grand total across all trucks */}
              {truckReports.length > 1 && (
                <div className="px-6 py-4 bg-gray-100 rounded-xl border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      All trucks
                    </span>
                    <span className="text-xl font-bold text-gray-900">
                      Grand Total: {(grandTotalGallons + grandTotalExtGallons).toFixed(1)} gallons
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {grandTotalFillups > 0 && `${grandTotalFillups} on-site fill-up${grandTotalFillups !== 1 ? 's' : ''}`}
                      {grandTotalFillups > 0 && grandTotalExtTxns > 0 && ' + '}
                      {grandTotalExtTxns > 0 && `${grandTotalExtTxns} external transaction${grandTotalExtTxns !== 1 ? 's' : ''}`}
                    </span>
                    {grandTotalExtAmount > 0 && (
                      <span>External spend: {formatCurrency(grandTotalExtAmount)}</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
