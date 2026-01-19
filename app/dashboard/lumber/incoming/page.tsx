'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Info, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function IncomingLoadsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [filteredLoads, setFilteredLoads] = useState<LumberLoadWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  
  // Check if user is rip_operator (read-only mode)
  const isRipOperator = session?.user?.role === 'rip_operator'
  
  // Filter states
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [selectedThickness, setSelectedThickness] = useState<string>('all')
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('load_id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Unique values for filters
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [species, setSpecies] = useState<string[]>([])
  const [grades, setGrades] = useState<string[]>([])
  const [thicknesses, setThicknesses] = useState<string[]>([])
  const [speciesColors, setSpeciesColors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/incoming')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const [loadsRes, speciesRes] = await Promise.all([
          fetch('/api/lumber/loads/incoming'),
          fetch('/api/lumber/species')
        ])
        
        if (loadsRes.ok) {
          const data = await loadsRes.json()
          setLoads(data)
          setFilteredLoads(data)
          
          // Extract unique values for filters
          const uniqueSuppliers = Array.from(new Set(data.map((l: any) => l.supplier_name))).sort() as string[]
          const uniqueSpecies = Array.from(new Set(data.flatMap((l: any) => l.items.map((i: any) => i.species)))).sort() as string[]
          const uniqueGrades = Array.from(new Set(data.flatMap((l: any) => l.items.map((i: any) => i.grade)))).sort() as string[]
          const uniqueThicknesses = Array.from(new Set(data.flatMap((l: any) => l.items.map((i: any) => i.thickness)))).sort() as string[]
          
          setSuppliers(uniqueSuppliers)
          setSpecies(uniqueSpecies)
          setGrades(uniqueGrades)
          setThicknesses(uniqueThicknesses)
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
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchData()
    }
  }, [status])

  useEffect(() => {
    let filtered = loads

    // Apply search filter
    if (searchTerm !== '') {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(load =>
        load.load_id?.toLowerCase().includes(search) ||
        load.supplier_name?.toLowerCase().includes(search) ||
        (load.items && load.items.some(item => 
          item.species?.toLowerCase().includes(search) ||
          item.grade?.toLowerCase().includes(search)
        )) ||
        load.pickup_number?.toLowerCase().includes(search) ||
        load.plant?.toLowerCase().includes(search)
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

    // Apply grade filter
    if (selectedGrade !== 'all') {
      filtered = filtered.filter(load =>
        load.items && load.items.some(item => item.grade === selectedGrade)
      )
    }

    // Apply thickness filter
    if (selectedThickness !== 'all') {
      filtered = filtered.filter(load =>
        load.items && load.items.some(item => item.thickness === selectedThickness)
      )
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortColumn) {
        case 'load_id':
          // Parse as number for proper numeric sorting
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
        case 'price':
          aVal = a.items?.[0]?.price || 0
          bVal = b.items?.[0]?.price || 0
          break
        case 'eta':
          aVal = a.estimated_delivery_date ? new Date(a.estimated_delivery_date).getTime() : 0
          bVal = b.estimated_delivery_date ? new Date(b.estimated_delivery_date).getTime() : 0
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    setFilteredLoads(filtered)
  }, [searchTerm, selectedSupplier, selectedSpecies, selectedGrade, selectedThickness, loads, sortColumn, sortDirection])

  function clearAllFilters() {
    setSearchTerm('')
    setSelectedSupplier('all')
    setSelectedSpecies('all')
    setSelectedGrade('all')
    setSelectedThickness('all')
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

  const hasActiveFilters = searchTerm !== '' || selectedSupplier !== 'all' || selectedSpecies !== 'all' || selectedGrade !== 'all' || selectedThickness !== 'all'

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incoming Loads</h1>
          <p className="text-gray-600 mt-1">
            Loads that have been created but have not arrived yet
            {isRipOperator && <span className="text-orange-600 ml-2">(View Only)</span>}
          </p>
        </div>
        {!isRipOperator && (
          <Button onClick={() => router.push('/dashboard/lumber/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Load
          </Button>
        )}
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
        
        <div className="grid grid-cols-5 gap-3">
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

          {/* Grade Filter */}
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map(grade => (
                <SelectItem key={grade} value={grade}>
                  {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Thickness Filter */}
          <Select value={selectedThickness} onValueChange={setSelectedThickness}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Thicknesses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Thicknesses</SelectItem>
              {thicknesses.map(thickness => (
                <SelectItem key={thickness} value={thickness}>
                  {thickness}
                </SelectItem>
              ))}
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
            {selectedGrade !== 'all' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                Grade: {selectedGrade}
                <button onClick={() => setSelectedGrade('all')} className="hover:text-orange-900">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedThickness !== 'all' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded">
                Thickness: {selectedThickness}
                <button onClick={() => setSelectedThickness('all')} className="hover:text-cyan-900">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="text-xs text-gray-500 self-center ml-auto">
              Showing {filteredLoads.length} of {loads.length} loads
            </div>
          </div>
        )}
      </div>

      {/* Color Legend */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex items-center gap-6 text-xs">
          <span className="font-medium text-gray-700">Color Key:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white border border-gray-300"></div>
            <span>Waiting for Arrival</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
            <span>Has Actual Footage (Needs Invoice/Docs)</span>
          </div>
        </div>
      </div>

      {/* Compact Loads Table */}
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
                  Items
                  {getSortIcon('species')}
                </div>
              </th>
              <th className="px-2 py-1 text-left text-xs font-medium uppercase">Est. BF</th>
              <th className="px-2 py-1 text-left text-xs font-medium uppercase">Act. BF</th>
              <th 
                className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center">
                  Price
                  {getSortIcon('price')}
                </div>
              </th>
              <th 
                className="px-2 py-1 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                onClick={() => handleSort('eta')}
              >
                <div className="flex items-center">
                  ETA
                  {getSortIcon('eta')}
                </div>
              </th>
              <th className="px-2 py-1 text-left text-xs font-medium uppercase">Type</th>
              <th className="px-2 py-1 text-left text-xs font-medium uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredLoads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">
                  {loads.length === 0 ? 'No incoming loads found' : 'No loads match your search'}
                </td>
              </tr>
            ) : (
              filteredLoads.map((load, loadIdx) => {
                // Check if any item has actual footage
                const hasActualFootage = load.items?.some(item => item.actual_footage)
                
                return (
                  <tr 
                    key={load.id} 
                    className={`hover:bg-blue-50 transition-colors ${
                      hasActualFootage 
                        ? 'bg-green-50 hover:bg-green-100' 
                        : loadIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs font-semibold text-gray-900" title={`Created: ${new Date(load.created_at).toLocaleDateString()}`}>
                        {load.load_id}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">{load.supplier_name}</span>
                      {load.location_name && (
                        <span className="text-[10px] text-gray-500 ml-1">({load.location_name})</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <div className="text-xs flex flex-wrap gap-x-2 gap-y-0.5">
                        {load.items.map((item, idx) => (
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
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs">
                        {load.items.map((item, idx) => (
                          <span key={idx}>
                            {item.estimated_footage?.toLocaleString() || '-'}
                            {idx < load.items.length - 1 && ', '}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className={`text-xs ${hasActualFootage ? 'font-semibold text-green-700' : ''}`}>
                        {load.items.map((item, idx) => (
                          <span key={idx}>
                            {item.actual_footage?.toLocaleString() || '-'}
                            {idx < load.items.length - 1 && ', '}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs">
                        {load.items.map((item, idx) => (
                          <span key={idx}>
                            ${item.price?.toFixed(3) || '-'}
                            {idx < load.items.length - 1 && ', '}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs">
                        {load.estimated_delivery_date ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="text-xs capitalize">{load.pickup_or_delivery || '-'}</span>
                      {load.pickup_number && (
                        <span className="text-[10px] text-gray-500 ml-1">#{load.pickup_number}</span>
                      )}
                      {load.plant && (
                        <span className="text-[10px] text-gray-500 ml-1">{load.plant}</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        {!isRipOperator && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-1.5"
                            onClick={() => router.push(`/dashboard/lumber/data-entry/${load.id}`)}
                          >
                            Entry
                          </Button>
                        )}
                        {!isRipOperator && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)}
                          >
                            <Info className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
