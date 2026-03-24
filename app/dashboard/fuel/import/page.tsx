"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

interface ParsedTransaction {
  transactionDate: string
  merchantName: string
  merchantCity: string
  state: string
  invoiceNumber: string
  odometer: number
  productCode: string
  quantity: number
  unitCost: number
  transAmount: number
}

interface ParsedVehicle {
  vehicleDescription: string
  transactions: ParsedTransaction[]
  totalQuantity: number
  totalAmount: number
  matchedTruckId: number | null
  matchedTruckName: string | null
}

interface ParseResult {
  filename: string
  dateFrom: string
  dateTo: string
  vehicles: ParsedVehicle[]
}

interface PastImport {
  id: number
  filename: string
  date_from: string
  date_to: string
  total_transactions: number
  created_at: string
  created_by_name: string | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(val: number): string {
  return '$' + val.toFixed(2)
}

export default function FuelImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [saveResult, setSaveResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState('')
  const [pastImports, setPastImports] = useState<PastImport[]>([])

  const fetchPastImports = useCallback(async () => {
    try {
      const res = await fetch('/api/fuel/import')
      const data = await res.json()
      setPastImports(data.imports || [])
    } catch (err) {
      console.error('Error fetching imports:', err)
    }
  }, [])

  useEffect(() => {
    fetchPastImports()
  }, [fetchPastImports])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/fuel/import/parse', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to parse PDF')
        return
      }

      setParseResult(data)
      setStep('preview')
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload file')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  async function handleConfirmImport() {
    if (!parseResult) return
    setIsSaving(true)
    setError('')
    try {
      const res = await fetch('/api/fuel/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: parseResult.filename,
          dateFrom: parseResult.dateFrom,
          dateTo: parseResult.dateTo,
          vehicles: parseResult.vehicles.map((v) => ({
            vehicleDescription: v.vehicleDescription,
            matchedTruckId: v.matchedTruckId,
            transactions: v.transactions,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save import')
        return
      }

      setSaveResult({ imported: data.imported, skipped: data.skipped })
      setStep('done')
      fetchPastImports()
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save import')
    } finally {
      setIsSaving(false)
    }
  }

  function resetForm() {
    setStep('upload')
    setParseResult(null)
    setSaveResult(null)
    setError('')
  }

  const unmatchedVehicles = parseResult?.vehicles.filter((v) => !v.matchedTruckId) || []
  const totalTxns = parseResult?.vehicles.reduce((s, v) => s + v.transactions.length, 0) || 0
  const totalAmount = parseResult?.vehicles.reduce((s, v) => s + v.totalAmount, 0) || 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/fuel">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <Upload className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Fuel Report</h1>
          <p className="text-sm text-gray-500">Upload Red Rover / Voyager fuel card PDFs</p>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Voyager PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">Select a Voyager Transaction Vehicle Report PDF</p>
              <label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleUpload}
                  disabled={isUploading}
                  className="max-w-xs mx-auto cursor-pointer"
                />
              </label>
              {isUploading && (
                <div className="flex items-center justify-center gap-2 mt-4 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Parsing PDF...</span>
                </div>
              )}
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && parseResult && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{parseResult.filename}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(parseResult.dateFrom)} - {formatDate(parseResult.dateTo)}
                    <span className="mx-2">&middot;</span>
                    {parseResult.vehicles.length} vehicle{parseResult.vehicles.length !== 1 ? 's' : ''}
                    <span className="mx-2">&middot;</span>
                    {totalTxns} transaction{totalTxns !== 1 ? 's' : ''}
                    <span className="mx-2">&middot;</span>
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Import All
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {unmatchedVehicles.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {unmatchedVehicles.length} vehicle{unmatchedVehicles.length !== 1 ? 's' : ''} not matched to a truck
                </p>
                <p className="mt-0.5 text-amber-700">
                  Unmatched: {unmatchedVehicles.map((v) => v.vehicleDescription).join(', ')}.
                  Go to <Link href="/dashboard/fuel/trucks" className="underline font-medium">Trucks</Link> to set up Voyager Vehicle Descriptions.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-6">
            {parseResult.vehicles.map((vehicle) => (
              <Card key={vehicle.vehicleDescription}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">Vehicle: {vehicle.vehicleDescription}</CardTitle>
                        {vehicle.matchedTruckId ? (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                            {vehicle.matchedTruckName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                            Unmatched
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {vehicle.transactions.length} transaction{vehicle.transactions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-700">{formatCurrency(vehicle.totalAmount)}</div>
                      <div className="text-xs text-gray-500">{vehicle.totalQuantity.toFixed(1)} gal</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="hidden md:grid grid-cols-[100px_1fr_80px_80px_80px_80px_90px] gap-2 px-6 py-2 bg-gray-50 border-y text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <div>Date</div>
                    <div>Merchant</div>
                    <div className="text-right">Odometer</div>
                    <div className="text-center">Product</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">$/Unit</div>
                    <div className="text-right">Amount</div>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {vehicle.transactions.map((txn, idx) => (
                      <div key={idx} className="px-4 md:px-6 py-2.5">
                        <div className="hidden md:grid grid-cols-[100px_1fr_80px_80px_80px_80px_90px] gap-2 items-center">
                          <div className="text-sm text-gray-900">{formatDate(txn.transactionDate)}</div>
                          <div className="text-sm text-gray-700 truncate">
                            {txn.merchantName}
                            <span className="text-gray-400 ml-1">{txn.merchantCity}, {txn.state}</span>
                          </div>
                          <div className="text-sm text-gray-600 text-right font-mono">
                            {txn.odometer ? txn.odometer.toLocaleString() : '-'}
                          </div>
                          <div className="text-xs text-center">
                            <Badge variant="outline" className="text-xs">{txn.productCode}</Badge>
                          </div>
                          <div className="text-sm text-gray-700 text-right">{txn.quantity.toFixed(2)}</div>
                          <div className="text-sm text-gray-500 text-right">{formatCurrency(txn.unitCost)}</div>
                          <div className="text-sm font-semibold text-gray-900 text-right">{formatCurrency(txn.transAmount)}</div>
                        </div>
                        <div className="md:hidden space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{formatDate(txn.transactionDate)}</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(txn.transAmount)}</span>
                          </div>
                          <div className="text-xs text-gray-500">{txn.merchantName}, {txn.merchantCity}</div>
                          <div className="text-xs text-gray-400">{txn.quantity.toFixed(2)} gal @ {formatCurrency(txn.unitCost)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 py-3 bg-blue-50 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-800">
                        {vehicle.transactions.length} transaction{vehicle.transactions.length !== 1 ? 's' : ''}
                        <span className="mx-1">&middot;</span>
                        {vehicle.totalQuantity.toFixed(1)} gal
                      </span>
                      <span className="text-lg font-bold text-blue-800">{formatCurrency(vehicle.totalAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Step 3: Done */}
      {step === 'done' && saveResult && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h2>
            <p className="text-gray-600">
              {saveResult.imported} transaction{saveResult.imported !== 1 ? 's' : ''} imported
              {saveResult.skipped > 0 && (
                <span className="text-amber-600">
                  , {saveResult.skipped} duplicate{saveResult.skipped !== 1 ? 's' : ''} skipped
                </span>
              )}
            </p>
            <Button onClick={resetForm} className="mt-6 bg-blue-600 hover:bg-blue-700">
              Import Another Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Past Imports */}
      {pastImports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Import History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {pastImports.map((imp) => (
                <div key={imp.id} className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{imp.filename}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(imp.date_from)} - {formatDate(imp.date_to)}
                      <span className="mx-1">&middot;</span>
                      {imp.total_transactions} transaction{imp.total_transactions !== 1 ? 's' : ''}
                      {imp.created_by_name && (
                        <>
                          <span className="mx-1">&middot;</span>
                          by {imp.created_by_name}
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(imp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
