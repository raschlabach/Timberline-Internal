'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, ExternalLink, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-react'
import { toast } from 'sonner'

export default function InvoicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [filteredLoads, setFilteredLoads] = useState<LumberLoadWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLoad, setSelectedLoad] = useState<LumberLoadWithDetails | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [enteredInQuickbooks, setEnteredInQuickbooks] = useState(false)
  const [isPaid, setIsPaid] = useState(false)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [selectedQBStatus, setSelectedQBStatus] = useState<string>('all')
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('load_id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Unique values for filters
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [species, setSpecies] = useState<string[]>([])
  const [speciesColors, setSpeciesColors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/invoices')
    }
  }, [status, router])

  async function fetchLoads() {
    try {
      const [loadsRes, speciesRes] = await Promise.all([
        fetch('/api/lumber/loads/for-invoice'),
        fetch('/api/lumber/species')
      ])
      
      if (loadsRes.ok) {
        const data = await loadsRes.json()
        // Ensure each load has documents array
        const loadsWithDocs = data.map((load: any) => ({
          ...load,
          documents: load.documents || [],
          items: load.items || []
        }))
        setLoads(loadsWithDocs)
        setFilteredLoads(loadsWithDocs)
        
        // Extract unique values for filters
        const uniqueSuppliers = Array.from(new Set(loadsWithDocs.map((l: any) => l.supplier_name))).filter(Boolean).sort() as string[]
        const uniqueSpecies = Array.from(new Set(loadsWithDocs.flatMap((l: any) => (l.items || []).map((i: any) => i.species)))).filter(Boolean).sort() as string[]
        
        setSuppliers(uniqueSuppliers)
        setSpecies(uniqueSpecies)
      } else {
        console.error('Failed to fetch invoice loads:', await loadsRes.text())
        toast.error('Failed to fetch invoices')
      }
      
      if (speciesRes.ok) {
        const speciesData = await speciesRes.json()
        const colorMap: Record<string, string> = {}
        speciesData.forEach((sp: any) => {
          colorMap[sp.name] = sp.color || '#6B7280'
        })
        setSpeciesColors(colorMap)
      }
    } catch (error) {
      console.error('Error fetching invoice loads:', error)
      toast.error('Error loading invoices')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLoads()
    }
  }, [status])

  // Filter and sort effect
  useEffect(() => {
    let filtered = loads

    // Apply search filter
    if (searchTerm !== '') {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(load =>
        load.load_id?.toLowerCase().includes(search) ||
        load.supplier_name?.toLowerCase().includes(search) ||
        load.invoice_number?.toLowerCase().includes(search) ||
        (load.items && load.items.some(item => 
          item.species?.toLowerCase().includes(search)
        ))
      )
    }

    // Apply supplier filter
    if (selectedSupplier !== 'all') {
      filtered = filtered.filter(load => load.supplier_name === selectedSupplier)
    }

    // Apply species filter
    if (selectedSpecies !== 'all') {
      filtered = filtered.filter(load =>
        load.items && load.items.some(item => item.species === selectedSpecies)
      )
    }

    // Apply QuickBooks status filter
    if (selectedQBStatus !== 'all') {
      if (selectedQBStatus === 'entered') {
        filtered = filtered.filter(load => load.entered_in_quickbooks)
      } else if (selectedQBStatus === 'pending') {
        filtered = filtered.filter(load => !load.entered_in_quickbooks)
      }
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortColumn) {
        case 'load_id':
          aVal = parseInt(a.load_id) || 0
          bVal = parseInt(b.load_id) || 0
          break
        case 'supplier':
          aVal = a.supplier_name?.toLowerCase() || ''
          bVal = b.supplier_name?.toLowerCase() || ''
          break
        case 'species':
          aVal = a.items?.[0]?.species?.toLowerCase() || ''
          bVal = b.items?.[0]?.species?.toLowerCase() || ''
          break
        case 'invoice_number':
          aVal = a.invoice_number?.toLowerCase() || ''
          bVal = b.invoice_number?.toLowerCase() || ''
          break
        case 'invoice_total':
          aVal = Number(a.invoice_total) || 0
          bVal = Number(b.invoice_total) || 0
          break
        case 'arrival':
          aVal = a.actual_arrival_date ? new Date(a.actual_arrival_date).getTime() : 0
          bVal = b.actual_arrival_date ? new Date(b.actual_arrival_date).getTime() : 0
          break
        case 'invoice_date':
          aVal = a.invoice_date ? new Date(a.invoice_date).getTime() : 0
          bVal = b.invoice_date ? new Date(b.invoice_date).getTime() : 0
          break
        case 'inventory_entry':
          // Use the earliest actual_footage_entered_at from items
          aVal = a.items?.[0]?.actual_footage_entered_at ? new Date(a.items[0].actual_footage_entered_at).getTime() : 0
          bVal = b.items?.[0]?.actual_footage_entered_at ? new Date(b.items[0].actual_footage_entered_at).getTime() : 0
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    setFilteredLoads(filtered)
  }, [searchTerm, selectedSupplier, selectedSpecies, selectedQBStatus, loads, sortColumn, sortDirection])

  function clearAllFilters() {
    setSearchTerm('')
    setSelectedSupplier('all')
    setSelectedSpecies('all')
    setSelectedQBStatus('all')
  }

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function getSortIcon(column: string) {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  function handleOpenInvoiceDialog(load: LumberLoadWithDetails) {
    setSelectedLoad(load)
    setEnteredInQuickbooks(load.entered_in_quickbooks || false)
    setIsPaid(load.is_paid || false)
    setIsDialogOpen(true)
  }

  async function handleSaveInvoiceStatus() {
    if (!selectedLoad) return

    try {
      const response = await fetch(`/api/lumber/loads/${selectedLoad.id}/invoice-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entered_in_quickbooks: enteredInQuickbooks,
          is_paid: isPaid
        })
      })

      if (response.ok) {
        toast.success('Invoice status updated')
        setIsDialogOpen(false)
        fetchLoads()
      } else {
        throw new Error('Failed to update invoice status')
      }
    } catch (error) {
      console.error('Error updating invoice status:', error)
      toast.error('Failed to update invoice status')
    }
  }

  const hasActiveFilters = searchTerm !== '' || selectedSupplier !== 'all' || selectedSpecies !== 'all' || selectedQBStatus !== 'all'

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
        <p className="text-gray-600 mt-1">
          Track invoices, QuickBooks entry, and payment status
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>

          {/* Supplier Filter */}
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map(supplier => (
                <SelectItem key={supplier} value={supplier}>
                  {supplier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Species Filter */}
          <Select value={selectedSpecies} onValueChange={setSelectedSpecies}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Species" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Species</SelectItem>
              {species.map(sp => (
                <SelectItem key={sp} value={sp}>
                  {sp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* QuickBooks Status Filter */}
          <Select value={selectedQBStatus} onValueChange={setSelectedQBStatus}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All QB Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All QB Status</SelectItem>
              <SelectItem value="entered">Entered</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {searchTerm && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                Search: {searchTerm}
                <button onClick={() => setSearchTerm('')} className="hover:text-blue-900">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedSupplier !== 'all' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                Supplier: {selectedSupplier}
                <button onClick={() => setSelectedSupplier('all')} className="hover:text-green-900">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedSpecies !== 'all' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                Species: {selectedSpecies}
                <button onClick={() => setSelectedSpecies('all')} className="hover:text-purple-900">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedQBStatus !== 'all' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                QB Status: {selectedQBStatus}
                <button onClick={() => setSelectedQBStatus('all')} className="hover:text-orange-900">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="text-xs text-gray-500 self-center ml-auto">
              Showing {filteredLoads.length} of {loads.length} invoices
            </div>
          </div>
        )}
      </div>

      {/* Color Legend */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex items-center gap-6 text-xs">
          <span className="font-medium text-gray-700">Color Key:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
            <span>No Invoice #</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
            <span>Has Invoice #</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
            <span>Invoice # + In QuickBooks</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
            <span>Date Mismatch (different months)</span>
          </div>
        </div>
      </div>

      {loads.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Pending Invoices
          </h3>
          <p className="text-gray-600">
            All loads are either not arrived yet or have been marked as paid
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-800 text-white sticky top-0">
              <tr>
                <th 
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('load_id')}
                >
                  <div className="flex items-center">
                    Load ID
                    {getSortIcon('load_id')}
                  </div>
                </th>
                <th 
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('supplier')}
                >
                  <div className="flex items-center">
                    Supplier
                    {getSortIcon('supplier')}
                  </div>
                </th>
                <th 
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('species')}
                >
                  <div className="flex items-center">
                    Species
                    {getSortIcon('species')}
                  </div>
                </th>
                <th 
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('invoice_number')}
                >
                  <div className="flex items-center">
                    Invoice #
                    {getSortIcon('invoice_number')}
                  </div>
                </th>
                <th 
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('invoice_total')}
                >
                  <div className="flex items-center">
                    Total
                    {getSortIcon('invoice_total')}
                  </div>
                </th>
                <th 
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('arrival')}
                >
                  <div className="flex items-center">
                    Arrival
                    {getSortIcon('arrival')}
                  </div>
                </th>
                <th 
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('invoice_date')}
                >
                  <div className="flex items-center">
                    Inv Date
                    {getSortIcon('invoice_date')}
                  </div>
                </th>
                <th 
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('inventory_entry')}
                >
                  <div className="flex items-center">
                    Inv Entry
                    {getSortIcon('inventory_entry')}
                  </div>
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLoads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">
                    {loads.length === 0 ? 'No pending invoices' : 'No invoices match your filters'}
                  </td>
                </tr>
              ) : (
                filteredLoads.map((load, loadIdx) => {
                  // Check if arrival date and invoice date are in different months
                  const arrivalDate = load.actual_arrival_date ? new Date(load.actual_arrival_date) : null
                  const invoiceDate = load.invoice_date ? new Date(load.invoice_date) : null
                  const monthMismatch = arrivalDate && invoiceDate && (
                    arrivalDate.getMonth() !== invoiceDate.getMonth() ||
                    arrivalDate.getFullYear() !== invoiceDate.getFullYear()
                  )
                  
                  // Determine row color based on invoice status
                  let rowColor = 'bg-yellow-50 hover:bg-yellow-100' // No invoice number
                  if (monthMismatch) {
                    rowColor = 'bg-red-100 hover:bg-red-200' // Date mismatch takes priority
                  } else if (load.invoice_number && load.entered_in_quickbooks) {
                    rowColor = 'bg-green-100 hover:bg-green-200' // Has invoice # AND in QB
                  } else if (load.invoice_number) {
                    rowColor = 'bg-blue-100 hover:bg-blue-200' // Has invoice # only
                  }
                  
                  return (
                  <tr 
                    key={load.id} 
                    className={`transition-colors ${rowColor}`}
                  >
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs font-semibold text-gray-900">
                        {load.load_id}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">{load.supplier_name}</span>
                    </td>
                    <td className="px-2 py-1">
                      <div className="text-xs flex flex-wrap gap-x-2 gap-y-0.5">
                        {load.items && load.items.map((item, idx) => (
                          <span key={idx} className="whitespace-nowrap flex items-center gap-1">
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: speciesColors[item.species] || '#6B7280' }}
                            />
                            <span className="font-medium">{item.species}</span>
                            <span className="text-gray-500">{item.grade}</span>
                            <span className="text-[10px] bg-gray-200 px-1 rounded">{item.thickness}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs text-gray-900">{load.invoice_number || '-'}</span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">
                        {load.invoice_total ? `$${Number(load.invoice_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs">
                        {load.actual_arrival_date 
                          ? new Date(load.actual_arrival_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
                          : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs">
                        {load.invoice_date 
                          ? new Date(load.invoice_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
                          : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs">
                        {load.items?.[0]?.actual_footage_entered_at 
                          ? new Date(load.items[0].actual_footage_entered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-1.5"
                          onClick={() => handleOpenInvoiceDialog(load)}
                        >
                          <FileText className="h-3 w-3 mr-0.5" />
                          Manage
                        </Button>
                        {load.documents && load.documents.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => window.open(load.documents[0].file_path, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)}
                        >
                          <Info className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Management Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Manage Invoice - {selectedLoad?.load_id}</DialogTitle>
          </DialogHeader>
          
          {selectedLoad && (
            <div className="flex gap-4 h-[70vh]">
              {/* Left Side - Info and Toggles */}
              <div className="w-[280px] flex-shrink-0 flex flex-col">
                <div className="space-y-3 p-3 bg-gray-50 rounded text-sm">
                  <div>
                    <Label className="text-xs text-gray-500">Supplier</Label>
                    <div className="font-medium">{selectedLoad.supplier_name}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Invoice Number</Label>
                    <div className="font-medium">{selectedLoad.invoice_number || '-'}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Invoice Total</Label>
                    <div className="font-medium">
                      {selectedLoad.invoice_total ? `$${Number(selectedLoad.invoice_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Invoice Date</Label>
                    <div className="font-medium">
                      {selectedLoad.invoice_date 
                        ? new Date(selectedLoad.invoice_date).toLocaleDateString('en-US', { timeZone: 'UTC' })
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Arrival Date</Label>
                    <div className="font-medium">
                      {selectedLoad.actual_arrival_date 
                        ? new Date(selectedLoad.actual_arrival_date).toLocaleDateString('en-US', { timeZone: 'UTC' })
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Species</Label>
                    <div className="font-medium">
                      {selectedLoad.items?.map(i => i.species).join(', ') || '-'}
                    </div>
                  </div>
                </div>

                {/* Status Toggles */}
                <div className="space-y-3 pt-4 mt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="quickbooks"
                      checked={enteredInQuickbooks}
                      onCheckedChange={(checked) => setEnteredInQuickbooks(checked as boolean)}
                    />
                    <Label htmlFor="quickbooks" className="cursor-pointer text-sm">
                      Entered in QuickBooks
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="paid"
                      checked={isPaid}
                      onCheckedChange={(checked) => setIsPaid(checked as boolean)}
                    />
                    <Label htmlFor="paid" className="cursor-pointer font-semibold text-sm">
                      Mark as Paid
                    </Label>
                  </div>
                </div>

                {/* Action Buttons at Bottom of Left Side */}
                <div className="mt-auto pt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveInvoiceStatus}>
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* Right Side - Document Preview (Full Height) */}
              <div className="flex-1 border rounded overflow-hidden flex flex-col min-w-0">
                {selectedLoad.documents && selectedLoad.documents.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b flex-shrink-0">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="font-medium truncate">{selectedLoad.documents[0].file_name}</span>
                        {selectedLoad.documents.length > 1 && (
                          <span className="text-xs text-gray-500">+{selectedLoad.documents.length - 1} more</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => window.open(selectedLoad.documents[0].file_path, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open in New Tab
                      </Button>
                    </div>
                    <div className="flex-1 bg-gray-50 overflow-auto">
                      {(() => {
                        const doc = selectedLoad.documents[0]
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name)
                        const isPdf = /\.pdf$/i.test(doc.file_name)
                        
                        if (isImage) {
                          return (
                            <img 
                              src={doc.file_path} 
                              alt={doc.file_name}
                              className="w-full h-full object-contain"
                            />
                          )
                        } else if (isPdf) {
                          return (
                            <iframe
                              src={doc.file_path}
                              className="w-full h-full"
                              title={doc.file_name}
                            />
                          )
                        } else {
                          return (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                              <FileText className="h-12 w-12 mr-3" />
                              Preview not available - Click "Open in New Tab" to view
                            </div>
                          )
                        }
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <FileText className="h-16 w-16 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No documents attached</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
