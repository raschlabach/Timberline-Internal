'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails, LumberPackWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search, X, ArrowUpDown, ArrowUp, ArrowDown, Info,
  ChevronLeft, ChevronRight, Scissors, Check, Circle,
  Package, FileText, ExternalLink
} from 'lucide-react'

interface BossViewLoad extends LumberLoadWithDetails {
  status: 'incoming' | 'inventory' | 'needs_docs' | 'needs_invoice' | 'complete'
  total_packs: number
  finished_pack_count: number
  finished_footage: number
}

interface StepperStep {
  label: string
  done: boolean
}

function getLoadSteps(load: BossViewLoad): StepperStep[] {
  const isPickup = load.pickup_or_delivery === 'pickup'
  const hasDocs = Array.isArray(load.documents) && load.documents.length > 0

  const steps: StepperStep[] = [
    { label: 'Created', done: true },
    { label: 'PO Sent', done: !!load.po_generated },
  ]

  if (isPickup) {
    steps.push({ label: 'Assigned', done: !!(load.driver_id && load.assigned_pickup_date) })
  }

  steps.push(
    { label: 'Arrived', done: !!load.actual_arrival_date },
    { label: 'Docs', done: hasDocs },
    { label: 'Invoiced', done: !!(load.invoice_number && load.invoice_total) },
    { label: 'Ripping', done: Number(load.total_packs) > 0 },
    { label: 'Rip Done', done: !!load.all_packs_finished },
    { label: 'In QB', done: !!load.entered_in_quickbooks },
    { label: 'Paid', done: !!load.is_paid },
  )

  return steps
}

function getLoadPriority(load: BossViewLoad): number {
  const hasActual = load.items?.some(i => i.actual_footage)
  const hasStartedRipping = Number(load.total_packs) > 0

  if (!hasActual) return 0                        // unassigned / incoming — not arrived yet
  if (hasActual && !hasStartedRipping) return 1   // in inventory, not started ripping
  if (hasStartedRipping && !load.all_packs_finished) return 2 // ripping in progress
  if (load.all_packs_finished && !load.is_paid) return 3      // ripped, needs payment
  if (load.is_paid && !load.all_packs_finished) return 4      // paid but not ripped
  return 5                                        // done (shouldn't appear)
}

function getRowColor(load: BossViewLoad): { bg: string; hover: string } {
  const priority = getLoadPriority(load)
  switch (priority) {
    case 0: return { bg: 'bg-red-50', hover: 'hover:bg-red-100' }        // incoming / unassigned
    case 1: return { bg: 'bg-amber-50', hover: 'hover:bg-amber-100' }    // in inventory, not ripping
    case 2: return { bg: 'bg-blue-50', hover: 'hover:bg-blue-100' }      // ripping in progress
    case 3: return { bg: 'bg-green-50', hover: 'hover:bg-green-100' }    // ripped, needs payment
    case 4: return { bg: 'bg-purple-50', hover: 'hover:bg-purple-100' }  // paid, not ripped
    default: return { bg: 'bg-white', hover: 'hover:bg-gray-100' }
  }
}

function getLoadFinancials(load: BossViewLoad) {
  const totalActual = load.items?.reduce((s, i) => s + (Number(i.actual_footage) || 0), 0) || 0
  const remainingBF = totalActual - Number(load.finished_footage || 0)
  const itemPrice = load.items?.[0]?.price ? Number(load.items[0].price) : null
  const invoiceTotal = load.invoice_total ? Number(load.invoice_total) : null

  let inventoryPrice: number | null = null
  if (invoiceTotal !== null && totalActual > 0) {
    inventoryPrice = invoiceTotal / totalActual
  } else if (itemPrice !== null && itemPrice >= 0.30) {
    inventoryPrice = itemPrice
  }

  const inventoryValue = inventoryPrice !== null && remainingBF > 0
    ? inventoryPrice * remainingBF
    : null

  return { itemPrice, inventoryPrice, inventoryValue, invoiceTotal, totalActual, remainingBF }
}

export default function BossViewPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [loads, setLoads] = useState<BossViewLoad[]>([])
  const [packs, setPacks] = useState<LumberPackWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [speciesColors, setSpeciesColors] = useState<Record<string, string>>({})

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('all')
  const [selectedSpecies, setSelectedSpecies] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [visibleGroups, setVisibleGroups] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]))

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('priority')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Progress dialog
  const [progressLoad, setProgressLoad] = useState<BossViewLoad | null>(null)
  const [isProgressOpen, setIsProgressOpen] = useState(false)

  // Dates detail dialog
  const [datesLoad, setDatesLoad] = useState<BossViewLoad | null>(null)
  const [isDatesOpen, setIsDatesOpen] = useState(false)

  // Packs list dialog
  const [packsLoad, setPacksLoad] = useState<BossViewLoad | null>(null)
  const [isPacksOpen, setIsPacksOpen] = useState(false)

  // Paperwork dialog
  const [docsLoad, setDocsLoad] = useState<BossViewLoad | null>(null)
  const [isDocsOpen, setIsDocsOpen] = useState(false)
  const [activeDocIndex, setActiveDocIndex] = useState(0)

  // Completed load lookup
  const [lookupResults, setLookupResults] = useState<BossViewLoad[]>([])
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [hasSearchedCompleted, setHasSearchedCompleted] = useState(false)

  // Financials detail dialog
  const [financialsLoad, setFinancialsLoad] = useState<BossViewLoad | null>(null)
  const [isFinancialsOpen, setIsFinancialsOpen] = useState(false)

  // Calendar
  const [calendarDate, setCalendarDate] = useState(() => new Date())

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/boss-view')
    }
  }, [authStatus, router])

  useEffect(() => {
    if (authStatus !== 'authenticated') return

    async function fetchData() {
      try {
        const [loadsRes, speciesRes, packsRes] = await Promise.all([
          fetch('/api/lumber/loads/boss-view'),
          fetch('/api/lumber/species'),
          fetch('/api/lumber/packs/finished'),
        ])

        if (loadsRes.ok) {
          const data = await loadsRes.json()
          setLoads(data)
        }
        if (speciesRes.ok) {
          const speciesData = await speciesRes.json()
          const colorMap: Record<string, string> = {}
          speciesData.forEach((sp: any) => {
            colorMap[sp.name] = sp.color || '#6B7280'
          })
          setSpeciesColors(colorMap)
        }
        if (packsRes.ok) {
          const packsData = await packsRes.json()
          setPacks(packsData)
        }
      } catch (error) {
        console.error('Error fetching boss view data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [authStatus])

  // Derive unique filter values
  const suppliers = useMemo(() =>
    Array.from(new Set(loads.map(l => l.supplier_name))).filter(Boolean).sort() as string[],
    [loads]
  )
  const speciesList = useMemo(() =>
    Array.from(new Set(loads.flatMap(l => (l.items || []).map(i => i.species)))).filter(Boolean).sort() as string[],
    [loads]
  )

  // 3 most recently ripped load IDs (only loads present on this page)
  const recentlyRippedLoadIds = useMemo(() => {
    const loadIdsOnPage = new Set(loads.map(l => l.load_id))
    const seen = new Set<string>()
    const result: string[] = []
    for (const pack of packs) {
      if (pack.pack_type === 'misc') continue
      const loadId = pack.load_load_id
      if (!loadIdsOnPage.has(loadId)) continue
      if (!seen.has(loadId)) {
        seen.add(loadId)
        result.push(loadId)
        if (result.length >= 3) break
      }
    }
    return result
  }, [packs, loads])

  // Filter + sort
  const filteredLoads = useMemo(() => {
    let filtered = loads

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(load =>
        load.load_id?.toLowerCase().includes(search) ||
        load.supplier_name?.toLowerCase().includes(search) ||
        load.invoice_number?.toLowerCase().includes(search) ||
        (load.items && load.items.some(item =>
          item.species?.toLowerCase().includes(search) ||
          item.grade?.toLowerCase().includes(search)
        ))
      )
    }

    if (selectedSupplier !== 'all') {
      filtered = filtered.filter(l => l.supplier_name === selectedSupplier)
    }
    if (selectedSpecies !== 'all') {
      filtered = filtered.filter(l =>
        l.items && l.items.some(i => i.species === selectedSpecies)
      )
    }
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(l => l.status === selectedStatus)
    }

    if (visibleGroups.size < 5) {
      filtered = filtered.filter(l => visibleGroups.has(getLoadPriority(l)))
    }

    filtered = [...filtered].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortColumn) {
        case 'priority':
          aVal = getLoadPriority(a)
          bVal = getLoadPriority(b)
          if (aVal !== bVal) break
          aVal = parseInt(a.load_id) || 0
          bVal = parseInt(b.load_id) || 0
          break
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
        case 'eta':
          aVal = a.estimated_delivery_date ? new Date(a.estimated_delivery_date).getTime() : 0
          bVal = b.estimated_delivery_date ? new Date(b.estimated_delivery_date).getTime() : 0
          break
        case 'invoice_total':
          aVal = Number(a.invoice_total) || 0
          bVal = Number(b.invoice_total) || 0
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [loads, searchTerm, selectedSupplier, selectedSpecies, selectedStatus, visibleGroups, sortColumn, sortDirection])

  // Calendar data
  const calendarPacks = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    return packs.filter(p => {
      if (!p.finished_at) return false
      const d = new Date(p.finished_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [packs, calendarDate])

  const calendarPacksByDay = useMemo(() => {
    const map = new Map<number, LumberPackWithDetails[]>()
    for (const pack of calendarPacks) {
      const day = new Date(pack.finished_at!).getUTCDate()
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(pack)
    }
    return map
  }, [calendarPacks])

  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const weeks: (number | null)[][] = []
    let week: (number | null)[] = Array(firstDay).fill(null)

    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d)
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null)
      weeks.push(week)
    }
    return weeks
  }, [calendarDate])

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function getSortIcon(column: string) {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  function clearAllFilters() {
    setSearchTerm('')
    setSelectedSupplier('all')
    setSelectedSpecies('all')
    setSelectedStatus('all')
    setLookupResults([])
    setHasSearchedCompleted(false)
  }

  async function searchCompletedLoads() {
    if (!searchTerm.trim()) return
    setIsLookingUp(true)
    setHasSearchedCompleted(true)
    try {
      const res = await fetch(`/api/lumber/loads/boss-view?search=${encodeURIComponent(searchTerm.trim())}`)
      if (res.ok) {
        const data = await res.json()
        const activeIds = new Set(loads.map((l: BossViewLoad) => l.id))
        setLookupResults(data.filter((l: BossViewLoad) => !activeIds.has(l.id)))
      }
    } catch (error) {
      console.error('Error searching completed loads:', error)
    } finally {
      setIsLookingUp(false)
    }
  }

  const hasActiveFilters = searchTerm !== '' || selectedSupplier !== 'all' || selectedSpecies !== 'all' || selectedStatus !== 'all'

  if (authStatus === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  const monthLabel = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Master View</h1>
        <p className="text-gray-600 mt-1">
          Unified view of all loads — incoming, inventory, and invoicing
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setLookupResults([]); setHasSearchedCompleted(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchTerm.trim()) searchCompletedLoads() }}
                className="pl-10 h-9 text-sm"
              />
            </div>
            {searchTerm.trim() && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs whitespace-nowrap px-2"
                onClick={searchCompletedLoads}
                disabled={isLookingUp}
                title="Search all loads including completed"
              >
                {isLookingUp ? '...' : 'All Loads'}
              </Button>
            )}
          </div>

          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSpecies} onValueChange={setSelectedSpecies}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Species" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Species</SelectItem>
              {speciesList.map(sp => (
                <SelectItem key={sp} value={sp}>{sp}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="incoming">Incoming</SelectItem>
              <SelectItem value="inventory">In Inventory</SelectItem>
              <SelectItem value="needs_docs">Needs Docs</SelectItem>
              <SelectItem value="needs_invoice">Needs Invoice</SelectItem>
              <SelectItem value="complete">QB Entered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {searchTerm && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                Search: {searchTerm}
                <button onClick={() => setSearchTerm('')} className="hover:text-blue-900"><X className="h-3 w-3" /></button>
              </div>
            )}
            {selectedSupplier !== 'all' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                Supplier: {selectedSupplier}
                <button onClick={() => setSelectedSupplier('all')} className="hover:text-green-900"><X className="h-3 w-3" /></button>
              </div>
            )}
            {selectedSpecies !== 'all' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                Species: {selectedSpecies}
                <button onClick={() => setSelectedSpecies('all')} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </div>
            )}
            {selectedStatus !== 'all' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                Status: {selectedStatus === 'incoming' ? 'Incoming' : selectedStatus === 'inventory' ? 'In Inventory' : selectedStatus === 'needs_docs' ? 'Needs Docs' : selectedStatus === 'needs_invoice' ? 'Needs Invoice' : selectedStatus === 'complete' ? 'QB Entered' : selectedStatus}
                <button onClick={() => setSelectedStatus('all')} className="hover:text-orange-900"><X className="h-3 w-3" /></button>
              </div>
            )}
            <div className="text-xs text-gray-500 self-center ml-auto">
              Showing {filteredLoads.length} of {loads.length} loads
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex items-center gap-5 text-xs flex-wrap">
          {(() => {
            const groups: { id: number; label: string; bg: string; border: string; activeBg: string }[] = [
              { id: 0, label: 'Incoming / Not Arrived', bg: 'bg-red-100', border: 'border-red-300', activeBg: 'bg-red-200' },
              { id: 1, label: 'In Inventory (Not Ripping)', bg: 'bg-amber-100', border: 'border-amber-300', activeBg: 'bg-amber-200' },
              { id: 2, label: 'Ripping In Progress', bg: 'bg-blue-100', border: 'border-blue-300', activeBg: 'bg-blue-200' },
              { id: 3, label: 'Ripped (Needs Payment)', bg: 'bg-green-100', border: 'border-green-300', activeBg: 'bg-green-200' },
            ]
            return groups.map(g => {
              const isActive = visibleGroups.has(g.id)
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setVisibleGroups(prev => {
                      const next = new Set(prev)
                      if (next.has(g.id)) {
                        next.delete(g.id)
                      } else {
                        next.add(g.id)
                      }
                      return next
                    })
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all cursor-pointer ${
                    isActive
                      ? `${g.bg} ${g.border} opacity-100`
                      : 'bg-gray-100 border-gray-200 opacity-40'
                  }`}
                >
                  <div className={`w-3 h-3 rounded ${isActive ? g.activeBg : 'bg-gray-300'}`} />
                  <span className={isActive ? 'text-gray-800' : 'text-gray-400 line-through'}>{g.label}</span>
                </button>
              )
            })
          })()}
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">Steps:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
            <span>Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-amber-400" />
            <span>Next</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-gray-200" />
            <span>Pending</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white">
              <Scissors className="h-2.5 w-2.5" />#1
            </span>
            <span>Recently Ripped</span>
          </div>
        </div>
      </div>

      {/* Super List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-800 text-white sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase min-w-[340px]">Status</th>
                <th
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('load_id')}
                >
                  <div className="flex items-center">Load ID{getSortIcon('load_id')}</div>
                </th>
                <th
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('supplier')}
                >
                  <div className="flex items-center">Supplier{getSortIcon('supplier')}</div>
                </th>
                <th
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('species')}
                >
                  <div className="flex items-center">Items{getSortIcon('species')}</div>
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase">Est. BF</th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase">Act. BF</th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase">Inv BF</th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase">Packs</th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase">Financials</th>
                <th
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('eta')}
                >
                  <div className="flex items-center">Dates{getSortIcon('eta')}</div>
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase">Invoice #</th>
                <th
                  className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleSort('invoice_total')}
                >
                  <div className="flex items-center">Inv Total{getSortIcon('invoice_total')}</div>
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase">Type</th>
                <th className="px-2 py-1 text-left text-xs font-medium uppercase w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLoads.length === 0 && lookupResults.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-center text-sm text-gray-500">
                    <div className="space-y-2">
                      <p>{loads.length === 0 ? 'No loads found' : 'No loads match your filters'}</p>
                      {searchTerm && !hasSearchedCompleted && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={searchCompletedLoads}
                          disabled={isLookingUp}
                          className="text-xs"
                        >
                          {isLookingUp ? 'Searching...' : `Search completed loads for "${searchTerm}"`}
                        </Button>
                      )}
                      {hasSearchedCompleted && (
                        <p className="text-gray-400 text-xs">No completed loads found either</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLoads.map((load) => {
                  const rowColor = getRowColor(load)
                  const steps = getLoadSteps(load)
                  const rippedIdx = recentlyRippedLoadIds.indexOf(load.load_id)
                  const totalActual = load.items?.reduce((s, i) => s + (Number(i.actual_footage) || 0), 0) || 0
                  const inventoryBF = totalActual > 0 ? totalActual - Number(load.finished_footage || 0) : 0

                  const isCurrentlyRipping = rippedIdx === 0 && !load.all_packs_finished

                  return (
                    <tr
                      key={load.id}
                      className={`transition-colors ${rowColor.bg} ${rowColor.hover} ${
                        isCurrentlyRipping ? 'ring-2 ring-inset ring-emerald-500' : ''
                      }`}
                    >
                      {/* Status Stepper */}
                      <td className="px-2 py-1">
                        {(() => {
                          const firstIncomplete = steps.findIndex(s => !s.done)
                          return (
                            <button
                              className="flex items-start gap-0 cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-black/5 transition-colors"
                              onClick={() => { setProgressLoad(load); setIsProgressOpen(true) }}
                              title="Click for detailed progress"
                            >
                              {steps.map((step, i) => {
                                const isNext = i === firstIncomplete
                                return (
                                  <div key={i} className="flex items-start">
                                    <div className="flex flex-col items-center" style={{ width: '28px' }}>
                                      <div
                                        className={`w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] font-bold ${
                                          step.done
                                            ? 'bg-emerald-500 text-white'
                                            : isNext
                                              ? 'bg-white border-2 border-amber-400 animate-pulse text-amber-600'
                                              : 'bg-gray-200 text-gray-400'
                                        }`}
                                      >
                                        {step.done ? '\u2713' : i + 1}
                                      </div>
                                      <span className={`text-[7px] leading-tight mt-0.5 text-center ${
                                        step.done ? 'text-emerald-700 font-semibold' : isNext ? 'text-amber-600 font-semibold' : 'text-gray-400'
                                      }`}>
                                        {step.label}
                                      </span>
                                    </div>
                                    {i < steps.length - 1 && (
                                      <div className={`h-[2px] mt-[6px] flex-shrink-0 ${
                                        step.done && steps[i + 1].done ? 'bg-emerald-400' : 'bg-gray-200'
                                      }`} style={{ width: '6px' }} />
                                    )}
                                  </div>
                                )
                              })}
                            </button>
                          )
                        })()}
                      </td>

                      {/* Load ID + Recently Ripped badge */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-gray-900">{load.load_id}</span>
                          {isCurrentlyRipping && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white animate-pulse">
                              <Scissors className="h-2.5 w-2.5" />
                              Currently Ripping
                            </span>
                          )}
                          {rippedIdx !== -1 && !isCurrentlyRipping && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white">
                              <Scissors className="h-2.5 w-2.5" />
                              #{rippedIdx + 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-900">{load.supplier_name}</span>
                        {load.location_name && (
                          <span className="text-[10px] text-gray-500 ml-1">({load.location_name})</span>
                        )}
                      </td>

                      {/* Items */}
                      <td className="px-2 py-1">
                        <div className="text-xs flex flex-wrap gap-x-2 gap-y-0.5">
                          {load.items?.map((item, idx) => (
                            <span key={idx} className="whitespace-nowrap flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: speciesColors[item.species] || '#6B7280' }}
                              />
                              <span className="font-medium">{item.species}</span>
                              <span className="text-gray-500 mx-0.5">{item.grade}</span>
                              <span className="text-[10px] bg-gray-200 px-1 rounded">{item.thickness}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Est BF */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <span className="text-xs">
                          {load.items?.map((item, idx) => (
                            <span key={idx}>
                              {item.estimated_footage ? Number(item.estimated_footage).toLocaleString() : '-'}
                              {idx < load.items.length - 1 && ', '}
                            </span>
                          ))}
                        </span>
                      </td>

                      {/* Act BF */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <span className={`text-xs ${totalActual > 0 ? 'font-semibold text-green-700' : ''}`}>
                          {load.items?.map((item, idx) => (
                            <span key={idx}>
                              {item.actual_footage ? Number(item.actual_footage).toLocaleString() : '-'}
                              {idx < load.items.length - 1 && ', '}
                            </span>
                          ))}
                        </span>
                      </td>

                      {/* Inv BF */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <span className={`text-xs ${inventoryBF > 0 ? 'font-semibold text-blue-700' : ''}`}>
                          {totalActual > 0 ? inventoryBF.toLocaleString() : '-'}
                        </span>
                      </td>

                      {/* Packs */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        {Number(load.total_packs) > 0 ? (
                          <span className="text-xs">
                            <span className="font-semibold">{load.finished_pack_count}</span>
                            <span className="text-gray-400">/{load.total_packs}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* Financials */}
                      <td className="px-2 py-1">
                        {(() => {
                          const fin = getLoadFinancials(load)
                          return (
                            <button
                              className="flex items-center gap-2 flex-wrap cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-black/5 transition-colors"
                              onClick={() => { setFinancialsLoad(load); setIsFinancialsOpen(true) }}
                              title="Click for financial details"
                            >
                              {fin.itemPrice !== null && (
                                <div className="flex items-center gap-0.5">
                                  <span className="inline-block px-1 rounded text-[8px] font-semibold bg-gray-100 text-gray-700 leading-tight">PRC</span>
                                  <span className="text-[10px] text-gray-700">${fin.itemPrice.toFixed(3)}</span>
                                </div>
                              )}
                              {fin.inventoryPrice !== null && (
                                <div className="flex items-center gap-0.5">
                                  <span className="inline-block px-1 rounded text-[8px] font-semibold bg-violet-100 text-violet-700 leading-tight">INV</span>
                                  <span className="text-[10px] text-gray-700">${fin.inventoryPrice.toFixed(3)}</span>
                                </div>
                              )}
                              {fin.inventoryValue !== null && (
                                <div className="flex items-center gap-0.5">
                                  <span className="inline-block px-1 rounded text-[8px] font-semibold bg-emerald-100 text-emerald-700 leading-tight">VAL</span>
                                  <span className="text-[10px] text-gray-700">${fin.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                              )}
                              {fin.invoiceTotal !== null && (
                                <div className="flex items-center gap-0.5">
                                  <span className="inline-block px-1 rounded text-[8px] font-semibold bg-amber-100 text-amber-700 leading-tight">BILL</span>
                                  <span className="text-[10px] text-gray-700">${fin.invoiceTotal.toLocaleString()}</span>
                                </div>
                              )}
                              {fin.itemPrice === null && fin.invoiceTotal === null && (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </button>
                          )
                        })()}
                      </td>

                      {/* Dates */}
                      <td className="px-2 py-1">
                        <button
                          className="flex items-center gap-2 flex-wrap cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-black/5 transition-colors"
                          onClick={() => { setDatesLoad(load); setIsDatesOpen(true) }}
                          title="Click for date details"
                        >
                          {!load.actual_arrival_date && load.estimated_delivery_date && (
                            <div className="flex items-center gap-0.5">
                              <span className="inline-block px-1 rounded text-[8px] font-semibold bg-orange-100 text-orange-700 leading-tight">ETA</span>
                              <span className="text-[10px] text-gray-700">
                                {new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                          {!load.actual_arrival_date && !load.estimated_delivery_date && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          {load.actual_arrival_date && (
                            <div className="flex items-center gap-0.5">
                              <span className="inline-block px-1 rounded text-[8px] font-semibold bg-blue-100 text-blue-700 leading-tight">ARR</span>
                              <span className="text-[10px] text-gray-700">
                                {new Date(load.actual_arrival_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                          {(() => {
                            const enteredAt = load.items?.find(i => i.actual_footage_entered_at)?.actual_footage_entered_at
                            return enteredAt ? (
                              <div className="flex items-center gap-0.5">
                                <span className="inline-block px-1 rounded text-[8px] font-semibold bg-violet-100 text-violet-700 leading-tight">INV</span>
                                <span className="text-[10px] text-gray-700">
                                  {new Date(enteredAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            ) : null
                          })()}
                          {load.invoice_date && (
                            <div className="flex items-center gap-0.5">
                              <span className="inline-block px-1 rounded text-[8px] font-semibold bg-amber-100 text-amber-700 leading-tight">BILL</span>
                              <span className="text-[10px] text-gray-700">
                                {new Date(load.invoice_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                          {load.paid_at && (
                            <div className="flex items-center gap-0.5">
                              <span className="inline-block px-1 rounded text-[8px] font-semibold bg-emerald-100 text-emerald-700 leading-tight">PAID</span>
                              <span className="text-[10px] text-gray-700">
                                {new Date(load.paid_at).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </button>
                      </td>

                      {/* Invoice # */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <span className="text-xs text-gray-900">{load.invoice_number || '-'}</span>
                      </td>

                      {/* Invoice Total */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-900">
                          {load.invoice_total
                            ? `$${Number(load.invoice_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '-'}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <span className="text-xs capitalize">{load.pickup_or_delivery || '-'}</span>
                        {load.pickup_number && (
                          <span className="text-[10px] text-gray-500 ml-1">#{load.pickup_number}</span>
                        )}
                        {load.plant && (
                          <span className="text-[10px] text-gray-500 ml-1">{load.plant}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => { setPacksLoad(load); setIsPacksOpen(true) }}
                            title="View packs"
                          >
                            <Package className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => { setDocsLoad(load); setIsDocsOpen(true) }}
                            title="View paperwork"
                            disabled={!load.documents || load.documents.length === 0}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)}
                            title="Open load"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
              {lookupResults.length > 0 && (
                <>
                  <tr>
                    <td colSpan={14} className="px-3 py-2 bg-gray-100 text-center">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Completed Loads ({lookupResults.length})
                      </span>
                    </td>
                  </tr>
                  {lookupResults.map((load) => {
                    const steps = getLoadSteps(load)
                    const totalActual = load.items?.reduce((s, i) => s + (Number(i.actual_footage) || 0), 0) || 0
                    const inventoryBF = totalActual > 0 ? totalActual - Number(load.finished_footage || 0) : 0

                    return (
                      <tr
                        key={`completed-${load.id}`}
                        className="transition-colors bg-gray-50/60 hover:bg-gray-100 opacity-75"
                      >
                        {/* Status Stepper */}
                        <td className="px-2 py-1">
                          {(() => {
                            const firstIncomplete = steps.findIndex(s => !s.done)
                            return (
                              <button
                                className="flex items-start gap-0 cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-black/5 transition-colors"
                                onClick={() => { setProgressLoad(load); setIsProgressOpen(true) }}
                                title="Click for detailed progress"
                              >
                                {steps.map((step, i) => {
                                  const isNext = i === firstIncomplete
                                  return (
                                    <div key={i} className="flex items-start">
                                      <div className="flex flex-col items-center" style={{ width: '28px' }}>
                                        <div
                                          className={`w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] font-bold ${
                                            step.done
                                              ? 'bg-emerald-500 text-white'
                                              : isNext
                                                ? 'bg-white border-2 border-amber-400 animate-pulse text-amber-600'
                                                : 'bg-gray-200 text-gray-400'
                                          }`}
                                        >
                                          {step.done ? '\u2713' : i + 1}
                                        </div>
                                        <span className={`text-[7px] leading-tight mt-0.5 text-center ${
                                          step.done ? 'text-emerald-700 font-semibold' : isNext ? 'text-amber-600 font-semibold' : 'text-gray-400'
                                        }`}>
                                          {step.label}
                                        </span>
                                      </div>
                                      {i < steps.length - 1 && (
                                        <div className={`h-[2px] mt-[6px] flex-shrink-0 ${
                                          step.done && steps[i + 1].done ? 'bg-emerald-400' : 'bg-gray-200'
                                        }`} style={{ width: '6px' }} />
                                      )}
                                    </div>
                                  )
                                })}
                              </button>
                            )
                          })()}
                        </td>

                        {/* Load ID */}
                        <td className="px-2 py-1 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-gray-900">{load.load_id}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-200 text-gray-600">
                              COMPLETED
                            </span>
                          </div>
                        </td>

                        {/* Supplier */}
                        <td className="px-2 py-1 whitespace-nowrap">
                          <div className="text-xs font-medium text-gray-900">{load.supplier_name}</div>
                          {load.location_name && <div className="text-[10px] text-gray-500">{load.location_name}</div>}
                        </td>

                        {/* Items */}
                        <td className="px-2 py-1">
                          <div className="flex flex-wrap gap-0.5">
                            {load.items?.map((item, idx) => (
                              <span key={idx} className="inline-block px-1 py-0.5 bg-gray-100 rounded text-[9px] text-gray-700">
                                {item.species} {item.grade} {item.thickness}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Est. BF */}
                        <td className="px-2 py-1 whitespace-nowrap text-right">
                          <span className="text-xs text-gray-600">{(load.items?.reduce((s, i) => s + (Number(i.estimated_footage) || 0), 0) || 0).toLocaleString()}</span>
                        </td>

                        {/* Act. BF */}
                        <td className="px-2 py-1 whitespace-nowrap text-right">
                          <span className="text-xs font-medium text-gray-900">{totalActual.toLocaleString()}</span>
                        </td>

                        {/* Inv BF */}
                        <td className="px-2 py-1 whitespace-nowrap text-right">
                          <span className="text-xs text-gray-600">{inventoryBF > 0 ? inventoryBF.toLocaleString() : '0'}</span>
                        </td>

                        {/* Packs */}
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className="text-xs">{load.finished_pack_count}/{load.total_packs}</span>
                        </td>

                        {/* Financials */}
                        <td className="px-2 py-1">
                          {(() => {
                            const fin = getLoadFinancials(load)
                            return (
                              <button
                                className="flex items-center gap-2 flex-wrap cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-black/5 transition-colors"
                                onClick={() => { setFinancialsLoad(load); setIsFinancialsOpen(true) }}
                                title="Click for financial details"
                              >
                                {fin.itemPrice !== null && (
                                  <div className="flex items-center gap-0.5">
                                    <span className="inline-block px-1 rounded text-[8px] font-semibold bg-gray-100 text-gray-700 leading-tight">PRC</span>
                                    <span className="text-[10px] text-gray-700">${fin.itemPrice.toFixed(3)}</span>
                                  </div>
                                )}
                                {fin.invoiceTotal !== null && (
                                  <div className="flex items-center gap-0.5">
                                    <span className="inline-block px-1 rounded text-[8px] font-semibold bg-amber-100 text-amber-700 leading-tight">BILL</span>
                                    <span className="text-[10px] text-gray-700">${fin.invoiceTotal.toLocaleString()}</span>
                                  </div>
                                )}
                                {fin.itemPrice === null && fin.invoiceTotal === null && (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </button>
                            )
                          })()}
                        </td>

                        {/* Dates */}
                        <td className="px-2 py-1">
                          <button
                            className="flex items-center gap-2 flex-wrap cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-black/5 transition-colors"
                            onClick={() => { setDatesLoad(load); setIsDatesOpen(true) }}
                            title="Click for date details"
                          >
                            {load.actual_arrival_date && (
                              <div className="flex items-center gap-0.5">
                                <span className="inline-block px-1 rounded text-[8px] font-semibold bg-blue-100 text-blue-700 leading-tight">ARR</span>
                                <span className="text-[10px] text-gray-700">
                                  {new Date(load.actual_arrival_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            )}
                            {load.paid_at && (
                              <div className="flex items-center gap-0.5">
                                <span className="inline-block px-1 rounded text-[8px] font-semibold bg-emerald-100 text-emerald-700 leading-tight">PAID</span>
                                <span className="text-[10px] text-gray-700">
                                  {new Date(load.paid_at).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            )}
                          </button>
                        </td>

                        {/* Invoice # */}
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className="text-xs text-gray-900">{load.invoice_number || '-'}</span>
                        </td>

                        {/* Invoice Total */}
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className="text-xs font-medium text-gray-900">
                            {load.invoice_total ? `$${Number(load.invoice_total).toLocaleString()}` : '-'}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className="text-xs text-gray-600 capitalize">{load.pickup_or_delivery || '-'}</span>
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-0.5">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setPacksLoad(load); setIsPacksOpen(true) }} title="View packs">
                              <Package className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setDocsLoad(load); setIsDocsOpen(true) }} title="View paperwork" disabled={!load.documents || load.documents.length === 0}>
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)} title="Open load">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Packs List Dialog */}
      <Dialog open={isPacksOpen} onOpenChange={setIsPacksOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {packsLoad && (() => {
            const load = packsLoad
            const loadPacks = packs.filter(p => p.load_id === load.id)
            const finishedPacks = loadPacks.filter(p => p.is_finished).sort(
              (a, b) => new Date(b.finished_at || 0).getTime() - new Date(a.finished_at || 0).getTime()
            )
            const unfinishedPacks = loadPacks.filter(p => !p.is_finished)
            const totalTally = loadPacks.reduce((s, p) => s + (Number(p.tally_board_feet) || 0), 0)
            const totalActual = finishedPacks.reduce((s, p) => s + (Number(p.actual_board_feet) || 0), 0)

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <Package className="h-5 w-5" />
                    <span className="text-lg font-bold">Load {load.load_id} — Packs</span>
                    <span className="text-sm font-normal text-gray-500">
                      {finishedPacks.length}/{loadPacks.length} finished
                    </span>
                  </DialogTitle>
                </DialogHeader>

                {loadPacks.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No packs created yet for this load.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 uppercase">Total Packs</div>
                        <div className="text-lg font-bold">{loadPacks.length}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 uppercase">Tally BF</div>
                        <div className="text-lg font-bold">{totalTally.toLocaleString()}</div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-emerald-600 uppercase">Ripped BF</div>
                        <div className="text-lg font-bold text-emerald-700">{totalActual.toLocaleString()}</div>
                      </div>
                    </div>

                    {finishedPacks.length > 0 && (
                      <div className="mt-3">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Finished Packs</h3>
                        <div className="bg-gray-50 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-100 text-gray-600">
                                <th className="px-3 py-1.5 text-left font-medium">Pack #</th>
                                <th className="px-3 py-1.5 text-left font-medium">Species</th>
                                <th className="px-3 py-1.5 text-left font-medium">Grade</th>
                                <th className="px-3 py-1.5 text-right font-medium">Length</th>
                                <th className="px-3 py-1.5 text-right font-medium">Tally BF</th>
                                <th className="px-3 py-1.5 text-right font-medium">Actual BF</th>
                                <th className="px-3 py-1.5 text-right font-medium">Yield</th>
                                <th className="px-3 py-1.5 text-right font-medium">Finished</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {finishedPacks.map((pack) => (
                                <tr key={pack.id}>
                                  <td className="px-3 py-1.5 font-medium">#{pack.pack_id}</td>
                                  <td className="px-3 py-1.5">{pack.species}</td>
                                  <td className="px-3 py-1.5">{pack.grade}</td>
                                  <td className="px-3 py-1.5 text-right">{pack.length || '—'}</td>
                                  <td className="px-3 py-1.5 text-right">{Number(pack.tally_board_feet || 0).toLocaleString()}</td>
                                  <td className="px-3 py-1.5 text-right font-medium">{Number(pack.actual_board_feet || 0).toLocaleString()}</td>
                                  <td className="px-3 py-1.5 text-right">
                                    {pack.rip_yield != null ? `${Number(pack.rip_yield).toFixed(1)}%` : '—'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-gray-500">
                                    {pack.finished_at
                                      ? new Date(pack.finished_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {unfinishedPacks.length > 0 && (
                      <div className="mt-3">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Remaining Packs ({unfinishedPacks.length})</h3>
                        <div className="bg-amber-50 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-amber-100 text-amber-700">
                                <th className="px-3 py-1.5 text-left font-medium">Pack #</th>
                                <th className="px-3 py-1.5 text-left font-medium">Species</th>
                                <th className="px-3 py-1.5 text-left font-medium">Grade</th>
                                <th className="px-3 py-1.5 text-right font-medium">Length</th>
                                <th className="px-3 py-1.5 text-right font-medium">Tally BF</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-200">
                              {unfinishedPacks.map((pack) => (
                                <tr key={pack.id}>
                                  <td className="px-3 py-1.5 font-medium">#{pack.pack_id}</td>
                                  <td className="px-3 py-1.5">{pack.species}</td>
                                  <td className="px-3 py-1.5">{pack.grade}</td>
                                  <td className="px-3 py-1.5 text-right">{pack.length || '—'}</td>
                                  <td className="px-3 py-1.5 text-right">{Number(pack.tally_board_feet || 0).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Paperwork Dialog */}
      <Dialog open={isDocsOpen} onOpenChange={(open) => { setIsDocsOpen(open); if (!open) setActiveDocIndex(0) }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          {docsLoad && (() => {
            const load = docsLoad
            const docs = load.documents || []
            const activeDoc = docs[activeDocIndex]

            return (
              <>
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="flex items-center gap-3">
                    <FileText className="h-5 w-5" />
                    <span className="text-lg font-bold">Load {load.load_id} — Paperwork</span>
                    <span className="text-sm font-normal text-gray-500">
                      {docs.length} document{docs.length !== 1 ? 's' : ''}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                {docs.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No paperwork attached to this load.</p>
                ) : (
                  <div className="flex flex-1 gap-3 min-h-0 mt-2">
                    {docs.length > 1 && (
                      <div className="w-48 flex-shrink-0 space-y-1 overflow-y-auto">
                        {docs.map((doc, i) => (
                          <button
                            key={doc.id}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                              i === activeDocIndex
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                            }`}
                            onClick={() => setActiveDocIndex(i)}
                          >
                            <div className="font-medium truncate">{doc.file_name}</div>
                            <div className={`text-[10px] mt-0.5 ${i === activeDocIndex ? 'text-gray-300' : 'text-gray-400'}`}>
                              {doc.document_type && (
                                <span className="capitalize">{doc.document_type.replace(/_/g, ' ')}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 bg-gray-100 rounded-lg overflow-hidden flex flex-col">
                      {activeDoc && (
                        <>
                          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-200 text-xs text-gray-600 flex-shrink-0">
                            <span className="truncate font-medium">{activeDoc.file_name}</span>
                            <a
                              href={activeDoc.file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0 ml-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Open</span>
                            </a>
                          </div>
                          <iframe
                            src={activeDoc.file_path}
                            className="flex-1 w-full border-0"
                            title={activeDoc.file_name}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Financials Detail Dialog */}
      <Dialog open={isFinancialsOpen} onOpenChange={setIsFinancialsOpen}>
        <DialogContent className="max-w-md">
          {financialsLoad && (() => {
            const load = financialsLoad
            const fin = getLoadFinancials(load)
            const hasMultipleItems = (load.items?.length || 0) > 1

            const rows: { tag: string; tagBg: string; tagText: string; label: string; value: string; sub: string | null }[] = []

            load.items?.forEach((item, idx) => {
              rows.push({
                tag: 'PRC', tagBg: 'bg-gray-100', tagText: 'text-gray-700',
                label: hasMultipleItems ? `Item Price — ${item.species} ${item.grade}` : 'Item Price (per BF)',
                value: item.price ? `$${Number(item.price).toFixed(3)}` : 'Not set',
                sub: item.price ? 'Price per board foot set on the load item' : null,
              })
            })

            rows.push({
              tag: 'INV', tagBg: 'bg-violet-100', tagText: 'text-violet-700',
              label: 'Inventory Price (per BF)',
              value: fin.inventoryPrice !== null ? `$${fin.inventoryPrice.toFixed(3)}` : 'Not available',
              sub: fin.invoiceTotal !== null && fin.totalActual > 0
                ? `Calculated from invoice total ($${fin.invoiceTotal.toLocaleString()}) ÷ actual BF (${fin.totalActual.toLocaleString()}) = $${fin.inventoryPrice!.toFixed(3)}/BF`
                : fin.itemPrice !== null && fin.itemPrice >= 0.30
                  ? `Using item price ($${fin.itemPrice.toFixed(3)}/BF) — no invoice total available`
                  : 'No invoice total or valid item price to calculate from',
            })

            rows.push({
              tag: 'VAL', tagBg: 'bg-emerald-100', tagText: 'text-emerald-700',
              label: 'Current Inventory Value',
              value: fin.inventoryValue !== null ? `$${fin.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'Not available',
              sub: fin.inventoryValue !== null && fin.inventoryPrice !== null
                ? `Inventory price ($${fin.inventoryPrice.toFixed(3)}) × remaining BF (${fin.remainingBF.toLocaleString()}) = $${fin.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : fin.remainingBF <= 0
                  ? 'No remaining inventory — load fully ripped'
                  : null,
            })

            rows.push({
              tag: 'BILL', tagBg: 'bg-amber-100', tagText: 'text-amber-700',
              label: 'Invoice Total',
              value: fin.invoiceTotal !== null ? `$${fin.invoiceTotal.toLocaleString()}` : 'Not entered',
              sub: load.invoice_number ? `Invoice #${load.invoice_number}` : null,
            })

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <span className="text-lg font-bold">Load {load.load_id}</span>
                    <span className="text-sm font-normal text-gray-500">Financials</span>
                  </DialogTitle>
                </DialogHeader>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 uppercase">Actual BF</div>
                    <div className="text-lg font-bold">{fin.totalActual.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 uppercase">Remaining BF</div>
                    <div className={`text-lg font-bold ${fin.remainingBF > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                      {fin.remainingBF.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 mt-3">
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg p-3 bg-gray-50"
                    >
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${row.tagBg} ${row.tagText} mt-0.5 flex-shrink-0`}>
                        {row.tag}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500">{row.label}</div>
                        <div className={`text-sm font-medium ${row.value.startsWith('$') ? 'text-gray-900' : 'text-gray-400'}`}>
                          {row.value}
                        </div>
                        {row.sub && (
                          <div className="text-xs text-gray-400 mt-0.5">{row.sub}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Dates Detail Dialog */}
      <Dialog open={isDatesOpen} onOpenChange={setIsDatesOpen}>
        <DialogContent className="max-w-md">
          {datesLoad && (() => {
            const load = datesLoad
            const inventoryEnteredAt = load.items?.find(i => i.actual_footage_entered_at)?.actual_footage_entered_at
            const formatFull = (d: string | null | undefined) => {
              if (!d) return null
              return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
            }
            const daysBetween = (a: string | null | undefined, b: string | null | undefined) => {
              if (!a || !b) return null
              const diff = Math.abs(new Date(b).getTime() - new Date(a).getTime())
              return Math.round(diff / (1000 * 60 * 60 * 24))
            }

            const dateRows: { tag: string; tagBg: string; tagText: string; label: string; value: string | null; sub?: string | null }[] = []

            if (!load.actual_arrival_date) {
              dateRows.push({
                tag: 'ETA', tagBg: 'bg-orange-100', tagText: 'text-orange-700',
                label: 'Estimated Delivery',
                value: formatFull(load.estimated_delivery_date),
                sub: null,
              })
            }

            dateRows.push({
              tag: 'ARR', tagBg: 'bg-blue-100', tagText: 'text-blue-700',
              label: 'Arrived at Warehouse',
              value: formatFull(load.actual_arrival_date),
              sub: load.actual_arrival_date && load.estimated_delivery_date
                ? (() => {
                    const days = daysBetween(load.estimated_delivery_date, load.actual_arrival_date)
                    const estDate = new Date(load.estimated_delivery_date)
                    const actDate = new Date(load.actual_arrival_date)
                    if (!days) return 'Arrived on time'
                    return actDate > estDate ? `${days} day${days > 1 ? 's' : ''} late` : `${days} day${days > 1 ? 's' : ''} early`
                  })()
                : null,
            })

            dateRows.push({
              tag: 'INV', tagBg: 'bg-violet-100', tagText: 'text-violet-700',
              label: 'Entered into Inventory',
              value: formatFull(inventoryEnteredAt),
              sub: inventoryEnteredAt && load.actual_arrival_date
                ? `${daysBetween(load.actual_arrival_date, inventoryEnteredAt)} day${(daysBetween(load.actual_arrival_date, inventoryEnteredAt) || 0) === 1 ? '' : 's'} after arrival`
                : null,
            })

            dateRows.push({
              tag: 'BILL', tagBg: 'bg-amber-100', tagText: 'text-amber-700',
              label: 'Invoice Date',
              value: formatFull(load.invoice_date),
              sub: load.invoice_number ? `Invoice #${load.invoice_number} — $${Number(load.invoice_total || 0).toLocaleString()}` : null,
            })

            dateRows.push({
              tag: 'PAID', tagBg: 'bg-emerald-100', tagText: 'text-emerald-700',
              label: 'Payment Date',
              value: formatFull(load.paid_at),
              sub: load.paid_at && load.invoice_date
                ? `${daysBetween(load.invoice_date, load.paid_at)} day${(daysBetween(load.invoice_date, load.paid_at) || 0) === 1 ? '' : 's'} after invoice`
                : null,
            })

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <span className="text-lg font-bold">Load {load.load_id}</span>
                    <span className="text-sm font-normal text-gray-500">Key Dates</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-1 mt-2">
                  {dateRows.map((row, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 rounded-lg p-3 ${row.value ? 'bg-gray-50' : 'bg-gray-50/50'}`}
                    >
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${row.tagBg} ${row.tagText} mt-0.5 flex-shrink-0`}>
                        {row.tag}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500">{row.label}</div>
                        <div className={`text-sm font-medium ${row.value ? 'text-gray-900' : 'text-gray-400'}`}>
                          {row.value || 'Not yet'}
                        </div>
                        {row.sub && (
                          <div className="text-xs text-gray-400 mt-0.5">{row.sub}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Progress Detail Dialog */}
      <Dialog open={isProgressOpen} onOpenChange={setIsProgressOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {progressLoad && (() => {
            const load = progressLoad
            const isPickup = load.pickup_or_delivery === 'pickup'
            const totalActualBF = load.items?.reduce((s, i) => s + (Number(i.actual_footage) || 0), 0) || 0
            const rippedBF = Number(load.finished_footage || 0)
            const remainingBF = totalActualBF - rippedBF
            const loadPacks = packs.filter(p => p.load_id === load.id)
            const finishedPacks = loadPacks.filter(p => p.is_finished).sort(
              (a, b) => new Date(b.finished_at || 0).getTime() - new Date(a.finished_at || 0).getTime()
            )
            const unfinishedPacks = loadPacks.filter(p => !p.is_finished)

            const formatDate = (d: string | null | undefined) => {
              if (!d) return null
              return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            }
            const formatDateTime = (d: string | null | undefined) => {
              if (!d) return null
              return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
            }

            const stepDetails: { label: string; done: boolean; detail: string | null; date: string | null }[] = [
              {
                label: 'Order Created',
                done: true,
                detail: `Load ${load.load_id}`,
                date: formatDateTime(load.created_at),
              },
              {
                label: 'PO Sent',
                done: !!load.po_generated,
                detail: load.po_generated ? 'Purchase order generated' : 'Awaiting PO generation',
                date: formatDateTime(load.po_generated_at),
              },
            ]

            if (isPickup) {
              stepDetails.push({
                label: 'Driver Assigned',
                done: !!(load.driver_id && load.assigned_pickup_date),
                detail: load.driver_name
                  ? `${load.driver_name} — pickup ${formatDate(load.assigned_pickup_date) || 'date pending'}`
                  : 'No driver assigned yet',
                date: formatDate(load.assigned_pickup_date),
              })
            }

            const inventoryEnteredAt = load.items?.find(i => i.actual_footage_entered_at)?.actual_footage_entered_at
            stepDetails.push(
              {
                label: 'Load Arrived',
                done: !!load.actual_arrival_date,
                detail: load.actual_arrival_date
                  ? `Arrived at warehouse`
                  : `ETA: ${formatDate(load.estimated_delivery_date) || 'unknown'}`,
                date: formatDate(load.actual_arrival_date),
              },
              {
                label: 'Paperwork Attached',
                done: Array.isArray(load.documents) && load.documents.length > 0,
                detail: Array.isArray(load.documents) && load.documents.length > 0
                  ? `${load.documents.length} document${load.documents.length > 1 ? 's' : ''} attached`
                  : 'No documents attached',
                date: load.documents?.length ? formatDateTime(load.documents[0].created_at) : null,
              },
              {
                label: 'Invoiced',
                done: !!(load.invoice_number && load.invoice_total),
                detail: load.invoice_number
                  ? `Invoice #${load.invoice_number} — $${Number(load.invoice_total || 0).toLocaleString()}`
                  : 'Invoice not entered',
                date: formatDate(load.invoice_date),
              },
              {
                label: 'Ripping Started',
                done: Number(load.total_packs) > 0,
                detail: Number(load.total_packs) > 0
                  ? `${load.finished_pack_count} of ${load.total_packs} packs finished`
                  : 'No packs ripped yet',
                date: finishedPacks.length > 0
                  ? formatDateTime(finishedPacks[finishedPacks.length - 1].finished_at)
                  : null,
              },
              {
                label: 'Ripping Complete',
                done: !!load.all_packs_finished,
                detail: load.all_packs_finished
                  ? `All ${load.total_packs} packs finished — ${rippedBF.toLocaleString()} BF`
                  : Number(load.total_packs) > 0
                    ? `${remainingBF.toLocaleString()} BF remaining`
                    : 'Not started',
                date: load.all_packs_finished && finishedPacks.length > 0
                  ? formatDateTime(finishedPacks[0].finished_at)
                  : null,
              },
              {
                label: 'Entered in QuickBooks',
                done: !!load.entered_in_quickbooks,
                detail: load.entered_in_quickbooks ? 'Invoice recorded in QB' : 'Not yet in QB',
                date: null,
              },
              {
                label: 'Paid',
                done: !!load.is_paid,
                detail: load.is_paid ? 'Payment received' : 'Awaiting payment',
                date: formatDate(load.paid_at),
              },
            )

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <span className="text-lg font-bold">Load {load.load_id}</span>
                    <span className="text-sm font-normal text-gray-500">
                      {load.supplier_name}{load.location_name ? ` — ${load.location_name}` : ''}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 uppercase">Total BF</div>
                    <div className="text-lg font-bold">{totalActualBF.toLocaleString()}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-emerald-600 uppercase">Ripped BF</div>
                    <div className="text-lg font-bold text-emerald-700">{rippedBF.toLocaleString()}</div>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${remainingBF > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <div className={`text-xs uppercase ${remainingBF > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Remaining BF</div>
                    <div className={`text-lg font-bold ${remainingBF > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{remainingBF.toLocaleString()}</div>
                  </div>
                </div>

                {/* Progress bar */}
                {totalActualBF > 0 && (
                  <div className="mt-1">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Ripping Progress</span>
                      <span>{totalActualBF > 0 ? Math.round((rippedBF / totalActualBF) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${totalActualBF > 0 ? (rippedBF / totalActualBF) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Detailed timeline */}
                <div className="mt-4 space-y-0">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Progress Timeline</h3>
                  {stepDetails.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      {/* Vertical line + circle */}
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          step.done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {step.done ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                        </div>
                        {i < stepDetails.length - 1 && (
                          <div className={`w-0.5 flex-1 min-h-[20px] ${step.done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="pb-4 -mt-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>
                            {step.label}
                          </span>
                          {step.date && (
                            <span className="text-xs text-gray-400">{step.date}</span>
                          )}
                        </div>
                        {step.detail && (
                          <p className={`text-xs mt-0.5 ${step.done ? 'text-gray-600' : 'text-gray-400'}`}>
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Items breakdown */}
                {load.items && load.items.length > 0 && (
                  <div className="mt-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Inventory Entry</h3>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-100 text-gray-600">
                            <th className="px-3 py-1.5 text-left font-medium">Species</th>
                            <th className="px-3 py-1.5 text-left font-medium">Grade</th>
                            <th className="px-3 py-1.5 text-right font-medium">Est. BF</th>
                            <th className="px-3 py-1.5 text-right font-medium">Actual BF</th>
                            <th className="px-3 py-1.5 text-right font-medium">Entered</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {load.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-1.5">{item.species}</td>
                              <td className="px-3 py-1.5">{item.grade}</td>
                              <td className="px-3 py-1.5 text-right">{Number(item.estimated_footage || 0).toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right font-medium">
                                {item.actual_footage ? Number(item.actual_footage).toLocaleString() : '—'}
                              </td>
                              <td className="px-3 py-1.5 text-right text-gray-400">
                                {formatDate(item.actual_footage_entered_at) || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ripping detail */}
                {finishedPacks.length > 0 && (
                  <div className="mt-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Ripped Packs ({finishedPacks.length} of {loadPacks.length})
                    </h3>
                    <div className="bg-gray-50 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0">
                          <tr className="bg-gray-100 text-gray-600">
                            <th className="px-3 py-1.5 text-left font-medium">Pack #</th>
                            <th className="px-3 py-1.5 text-left font-medium">Species</th>
                            <th className="px-3 py-1.5 text-right font-medium">Tally BF</th>
                            <th className="px-3 py-1.5 text-right font-medium">Actual BF</th>
                            <th className="px-3 py-1.5 text-right font-medium">Yield</th>
                            <th className="px-3 py-1.5 text-right font-medium">Finished</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {finishedPacks.map((pack) => (
                            <tr key={pack.id}>
                              <td className="px-3 py-1.5 font-medium">#{pack.pack_id}</td>
                              <td className="px-3 py-1.5">{pack.species}</td>
                              <td className="px-3 py-1.5 text-right">{Number(pack.tally_board_feet || 0).toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right font-medium">{Number(pack.actual_board_feet || 0).toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right">
                                {pack.rip_yield != null ? `${Number(pack.rip_yield).toFixed(1)}%` : '—'}
                              </td>
                              <td className="px-3 py-1.5 text-right text-gray-400">
                                {formatDateTime(pack.finished_at) || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Unfinished packs */}
                {unfinishedPacks.length > 0 && (
                  <div className="mt-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Remaining Packs ({unfinishedPacks.length})
                    </h3>
                    <div className="bg-amber-50 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0">
                          <tr className="bg-amber-100 text-amber-700">
                            <th className="px-3 py-1.5 text-left font-medium">Pack #</th>
                            <th className="px-3 py-1.5 text-left font-medium">Species</th>
                            <th className="px-3 py-1.5 text-right font-medium">Tally BF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-200">
                          {unfinishedPacks.map((pack) => (
                            <tr key={pack.id}>
                              <td className="px-3 py-1.5 font-medium">#{pack.pack_id}</td>
                              <td className="px-3 py-1.5">{pack.species}</td>
                              <td className="px-3 py-1.5 text-right">{Number(pack.tally_board_feet || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Monthly Rip Calendar */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700 h-7"
            onClick={() => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold">{monthLabel} — Rip Calendar</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700 h-7"
            onClick={() => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-2 py-1 text-center text-xs font-semibold text-gray-500 bg-gray-50 border-r last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {calendarGrid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((day, di) => {
              const dayPacks = day ? calendarPacksByDay.get(day) || [] : []
              const dayTotalBF = dayPacks.reduce((s, p) => s + (Number(p.actual_board_feet) || 0), 0)
              const today = new Date()
              const isToday = day !== null
                && calendarDate.getFullYear() === today.getFullYear()
                && calendarDate.getMonth() === today.getMonth()
                && day === today.getDate()

              return (
                <div
                  key={di}
                  className={`min-h-[80px] border-r last:border-r-0 p-1 ${
                    day === null ? 'bg-gray-50' : isToday ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  {day !== null && (
                    <>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                          {day}
                        </span>
                        {dayPacks.length > 0 && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                            {dayTotalBF.toLocaleString()} BF
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                        {dayPacks.slice(0, 8).map((pack) => (
                          <div
                            key={pack.id}
                            className="text-[9px] leading-tight px-1 py-0.5 rounded bg-gray-100 flex items-center gap-1"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: speciesColors[pack.species] || '#6B7280' }}
                            />
                            <span className="font-medium truncate">{pack.load_load_id}</span>
                            <span className="text-gray-400">P{pack.pack_id}</span>
                            {pack.actual_board_feet && (
                              <span className="ml-auto text-gray-600 flex-shrink-0">
                                {Number(pack.actual_board_feet).toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                        {dayPacks.length > 8 && (
                          <div className="text-[9px] text-gray-400 text-center">
                            +{dayPacks.length - 8} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Calendar Footer Summary */}
        <div className="px-4 py-2 bg-gray-50 border-t flex items-center gap-6 text-xs text-gray-600">
          <span>
            <span className="font-semibold text-gray-900">{calendarPacks.length}</span> packs ripped
          </span>
          <span>
            <span className="font-semibold text-gray-900">
              {calendarPacks.reduce((s, p) => s + (Number(p.actual_board_feet) || 0), 0).toLocaleString()}
            </span> total BF
          </span>
          <span>
            <span className="font-semibold text-gray-900">
              {new Set(calendarPacks.map(p => p.finished_at ? new Date(p.finished_at).getUTCDate() : null).filter(Boolean)).size}
            </span> active days
          </span>
        </div>
      </div>
    </div>
  )
}
