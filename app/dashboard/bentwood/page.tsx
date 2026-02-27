'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Package,
  Clock,
  EyeOff,
  Eye,
} from 'lucide-react'
import { BentwoodImportDetail } from '@/components/bentwood/import-detail'

interface BentwoodImport {
  id: number
  file_name: string
  week_label: string | null
  week_date: string | null
  total_items: number
  total_skids: number
  total_bundles: number
  status: string
  notes: string | null
  created_at: string
  created_by_name: string
  pending_items: string
  converted_items: string
  unmatched_items: string
}

export default function BentwoodPage() {
  const [imports, setImports] = useState<BentwoodImport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('active')
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set())
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const fetchImports = useCallback(async () => {
    try {
      const res = await fetch('/api/bentwood/imports')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setImports(data)
    } catch {
      toast.error('Failed to load imports')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImports()
  }, [fetchImports])

  async function uploadFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/bentwood/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      if (data.imports?.length > 0) {
        toast.success(data.message)
      } else {
        toast.info(data.message)
      }
      await fetchImports()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this import? This cannot be undone.')) return

    try {
      const res = await fetch(`/api/bentwood/imports/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      toast.success('Import deleted')
      setImports(prev => prev.filter(i => i.id !== id))
      setSelectedImports(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (selectedImportId === id) {
        setSelectedImportId(null)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete import')
    }
  }

  async function handleBulkStatusUpdate(status: 'hidden' | 'active') {
    if (selectedImports.size === 0) return

    setIsBulkUpdating(true)
    try {
      const res = await fetch('/api/bentwood/imports/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importIds: Array.from(selectedImports),
          status,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      toast.success(data.message)
      setSelectedImports(new Set())
      await fetchImports()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update imports')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  if (selectedImportId) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <BentwoodImportDetail
          importId={selectedImportId}
          onBack={() => {
            setSelectedImportId(null)
            fetchImports()
          }}
        />
      </div>
    )
  }

  const activeImports = imports.filter(i => i.status === 'active')
  const pastImports = imports.filter(i => i.status === 'completed')
  const hiddenImports = imports.filter(i => i.status === 'hidden')

  const currentTabImports =
    activeTab === 'active' ? activeImports :
    activeTab === 'past' ? pastImports :
    hiddenImports

  const selectedInCurrentTab = Array.from(selectedImports).filter(id =>
    currentTabImports.some(i => i.id === id)
  )

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bentwood Solutions</h1>
            <p className="text-sm text-gray-500 mt-1">
              Upload pickup confirmation sheets from Bentwood Solutions and convert them into delivery orders
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
          id="bentwood-upload"
        />
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg px-6 py-5 cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50'
            }
            ${isUploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <div className="flex items-center justify-center gap-3">
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : (
              <Upload className={`h-5 w-5 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            )}
            <div className="text-sm">
              {isUploading ? (
                <span className="text-gray-500 font-medium">Uploading...</span>
              ) : isDragging ? (
                <span className="text-blue-600 font-medium">Drop Excel file here</span>
              ) : (
                <>
                  <span className="text-gray-700 font-medium">Drag & drop an Excel file here</span>
                  <span className="text-gray-400 mx-1.5">or</span>
                  <span className="text-blue-600 font-medium hover:underline">browse</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-1">.xlsx or .xls files</p>
        </div>
      </div>

      {selectedInCurrentTab.length > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-gray-50 border rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-gray-700">
            {selectedInCurrentTab.length} selected
          </span>
          {activeTab === 'hidden' ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => handleBulkStatusUpdate('active')}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Unhide Selected
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => handleBulkStatusUpdate('hidden')}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
              Hide Selected
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-500"
            onClick={() => setSelectedImports(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedImports(new Set()) }}>
        <TabsList className="mb-4">
          <TabsTrigger value="active" className="gap-1.5">
            <Package className="h-4 w-4" />
            Active ({activeImports.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Past ({pastImports.length})
          </TabsTrigger>
          {hiddenImports.length > 0 && (
            <TabsTrigger value="hidden" className="gap-1.5">
              <EyeOff className="h-4 w-4" />
              Hidden ({hiddenImports.length})
            </TabsTrigger>
          )}
        </TabsList>

        {['active', 'past', 'hidden'].map(tab => (
          <TabsContent key={tab} value={tab}>
            <ImportsList
              imports={
                tab === 'active' ? activeImports :
                tab === 'past' ? pastImports :
                hiddenImports
              }
              isLoading={isLoading}
              onSelect={setSelectedImportId}
              onDelete={handleDelete}
              onUpload={() => fileInputRef.current?.click()}
              isUploading={isUploading}
              emptyMessage={
                tab === 'active' ? 'No active imports' :
                tab === 'past' ? 'No past imports' :
                'No hidden imports'
              }
              emptyDescription={
                tab === 'active' ? 'Upload a Bentwood Solutions Excel file to get started' :
                tab === 'past' ? 'Imports move here once all items are converted' :
                'Hidden imports will appear here'
              }
              selectedImports={selectedImports}
              onToggleSelect={(id, checked) => {
                setSelectedImports(prev => {
                  const next = new Set(prev)
                  if (checked) { next.add(id) } else { next.delete(id) }
                  return next
                })
              }}
              onSelectAll={(ids, checked) => {
                setSelectedImports(prev => {
                  const next = new Set(prev)
                  if (checked) { ids.forEach(id => next.add(id)) } else { ids.forEach(id => next.delete(id)) }
                  return next
                })
              }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

interface ImportsListProps {
  imports: BentwoodImport[]
  isLoading: boolean
  onSelect: (id: number) => void
  onDelete: (id: number, e: React.MouseEvent) => void
  onUpload: () => void
  isUploading: boolean
  emptyMessage: string
  emptyDescription: string
  selectedImports: Set<number>
  onToggleSelect: (id: number, checked: boolean) => void
  onSelectAll: (ids: number[], checked: boolean) => void
}

function ImportsList({
  imports,
  isLoading,
  onSelect,
  onDelete,
  onUpload,
  isUploading,
  emptyMessage,
  emptyDescription,
  selectedImports,
  onToggleSelect,
  onSelectAll,
}: ImportsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading imports...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (imports.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">{emptyMessage}</p>
            <p className="text-sm text-gray-400 mt-1">{emptyDescription}</p>
            <Button onClick={onUpload} disabled={isUploading} variant="outline" className="mt-4 gap-1.5">
              <Upload className="h-4 w-4" /> Upload Excel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const allIds = imports.map(i => i.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selectedImports.has(id))

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2.5 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onSelectAll(allIds, checked as boolean)}
                  />
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-500 w-12">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-500">Week</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Items</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Pending</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Converted</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Unmatched</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Skids</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Bundles</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-500">Uploaded</th>
                <th className="px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {imports.map(imp => {
                const pendingCount = parseInt(imp.pending_items) || 0
                const convertedCount = parseInt(imp.converted_items) || 0
                const unmatchedCount = parseInt(imp.unmatched_items) || 0
                const isChecked = selectedImports.has(imp.id)

                return (
                  <tr
                    key={imp.id}
                    className={`border-b border-gray-100 transition-colors ${
                      isChecked ? 'bg-blue-50/50' : 'hover:bg-blue-50/30'
                    } ${imp.status === 'completed' ? 'opacity-60' : ''} cursor-pointer`}
                    onClick={() => onSelect(imp.id)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => onToggleSelect(imp.id, checked as boolean)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {imp.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : imp.status === 'hidden' ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : unmatchedCount > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {imp.week_label || imp.file_name}
                    </td>
                    <td className="px-4 py-3 text-right">{imp.total_items}</td>
                    <td className="px-4 py-3 text-right">
                      {pendingCount > 0 ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 font-mono">
                          {pendingCount}
                        </Badge>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {convertedCount > 0 ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 font-mono">
                          {convertedCount}
                        </Badge>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {unmatchedCount > 0 ? (
                        <Badge variant="outline" className="text-red-600 border-red-200 font-mono">
                          {unmatchedCount}
                        </Badge>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {imp.total_skids || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {imp.total_bundles || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {format(new Date(imp.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => onDelete(imp.id, e)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete import"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
