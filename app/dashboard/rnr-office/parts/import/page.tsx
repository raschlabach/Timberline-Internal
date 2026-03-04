'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle, AlertTriangle, ArrowLeft, Loader2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  totalRows: number
  species: number
  productTypes: number
  profiles: number
  unmatchedCustomers: string[]
}

export default function ImportPartsPage() {
  const { data: session } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [migrationDone, setMigrationDone] = useState(false)

  async function handleRunMigration() {
    setIsMigrating(true)
    try {
      const res = await fetch('/api/admin/apply-rnr-office-migration', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Migration applied! Tables: ${data.tables?.join(', ')}`)
        setMigrationDone(true)
      } else {
        toast.error(`${data.error || 'Migration failed'}${data.details ? ': ' + data.details : ''}`)
      }
    } catch (err) {
      toast.error(`Migration failed: ${err instanceof Error ? err.message : 'Network error'}`)
    } finally {
      setIsMigrating(false)
    }
  }

  async function handleImport() {
    if (!file) return

    setIsUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/rnr/parts/import', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setResult(data)
        toast.success(`Imported ${data.imported} parts!`)
      } else {
        toast.error(`${data.error || 'Import failed'}${data.details ? ': ' + data.details : ''}`)
      }
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'Network error'}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/rnr-office/parts">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft size={16} />
            Back to Parts
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <FileSpreadsheet className="h-7 w-7 text-amber-600" />
          Import Parts from QuickBooks
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload your QuickBooks parts CSV export to populate the master parts database
        </p>
      </div>

      {/* Step 1: Run Migration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm shrink-0">
            1
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Set Up Database Tables</h3>
            <p className="text-sm text-gray-500 mt-1">
              Run the migration to create the RNR Office tables (species, product types, profiles, parts, orders, quotes, machines).
              Only needed once.
            </p>
            <div className="mt-3">
              <Button
                onClick={handleRunMigration}
                disabled={isMigrating || migrationDone}
                variant={migrationDone ? 'outline' : 'default'}
                className={migrationDone ? 'gap-2' : 'gap-2 bg-amber-600 hover:bg-amber-700'}
              >
                {isMigrating ? (
                  <><Loader2 size={16} className="animate-spin" /> Running Migration...</>
                ) : migrationDone ? (
                  <><CheckCircle size={16} className="text-green-600" /> Migration Complete</>
                ) : (
                  'Run Migration'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Upload CSV */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm shrink-0">
            2
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Upload QuickBooks CSV</h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload the &quot;All Parts Export&quot; CSV from QuickBooks. The import will create species, product types,
              profiles, and parts entries automatically. Duplicate item codes will be skipped.
            </p>

            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors">
                  <Upload size={16} className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {file ? file.name : 'Choose CSV File'}
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                {file && (
                  <span className="text-xs text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                )}
              </div>

              <Button
                onClick={handleImport}
                disabled={!file || isUploading}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {isUploading ? (
                  <><Loader2 size={16} className="animate-spin" /> Importing...</>
                ) : (
                  <><Upload size={16} /> Import Parts</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-600" />
            Import Complete
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-700">{result.imported.toLocaleString()}</p>
              <p className="text-sm text-green-600">Parts Imported</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-700">{result.skipped.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Skipped (duplicates or no item code)</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Species created:</span>
              <span className="ml-2 font-medium">{result.species}</span>
            </div>
            <div>
              <span className="text-gray-500">Product types:</span>
              <span className="ml-2 font-medium">{result.productTypes}</span>
            </div>
            <div>
              <span className="text-gray-500">Profiles:</span>
              <span className="ml-2 font-medium">{result.profiles}</span>
            </div>
          </div>

          {result.unmatchedCustomers.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-700 flex items-center gap-2">
                <AlertTriangle size={16} />
                {result.unmatchedCustomers.length} customers from CSV not matched to existing customers
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.unmatchedCustomers.map(c => (
                  <span key={c} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                    {c.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">
                These parts were imported without a customer link. You can add these customers and re-link later.
              </p>
            </div>
          )}

          <Link href="/dashboard/rnr-office/parts">
            <Button className="gap-2 bg-amber-600 hover:bg-amber-700 mt-2">
              View Parts List
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
