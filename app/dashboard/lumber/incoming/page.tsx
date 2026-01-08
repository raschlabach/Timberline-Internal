'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Info, X } from 'lucide-react'
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
  
  // Filter states
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  
  // Unique values for filters
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [species, setSpecies] = useState<string[]>([])
  const [grades, setGrades] = useState<string[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/incoming')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchLoads() {
      try {
        const response = await fetch('/api/lumber/loads/incoming')
        if (response.ok) {
          const data = await response.json()
          setLoads(data)
          setFilteredLoads(data)
          
          // Extract unique values for filters
          const uniqueSuppliers = Array.from(new Set(data.map((l: any) => l.supplier_name))).sort() as string[]
          const uniqueSpecies = Array.from(new Set(data.flatMap((l: any) => l.items.map((i: any) => i.species)))).sort() as string[]
          const uniqueGrades = Array.from(new Set(data.flatMap((l: any) => l.items.map((i: any) => i.grade)))).sort() as string[]
          
          setSuppliers(uniqueSuppliers)
          setSpecies(uniqueSpecies)
          setGrades(uniqueGrades)
        }
      } catch (error) {
        console.error('Error fetching incoming loads:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchLoads()
    }
  }, [status])

  useEffect(() => {
    let filtered = loads

    // Apply search filter
    if (searchTerm !== '') {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(load =>
        load.load_id.toLowerCase().includes(search) ||
        load.supplier_name.toLowerCase().includes(search) ||
        load.items.some(item => 
          item.species.toLowerCase().includes(search) ||
          item.grade.toLowerCase().includes(search)
        ) ||
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
        load.items.some(item => item.species === selectedSpecies)
      )
    }

    // Apply grade filter
    if (selectedGrade !== 'all') {
      filtered = filtered.filter(load =>
        load.items.some(item => item.grade === selectedGrade)
      )
    }

    setFilteredLoads(filtered)
  }, [searchTerm, selectedSupplier, selectedSpecies, selectedGrade, loads])

  function clearAllFilters() {
    setSearchTerm('')
    setSelectedSupplier('all')
    setSelectedSpecies('all')
    setSelectedGrade('all')
  }

  const hasActiveFilters = searchTerm !== '' || selectedSupplier !== 'all' || selectedSpecies !== 'all' || selectedGrade !== 'all'

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
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/lumber/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Load
        </Button>
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
            <div className="text-xs text-gray-500 self-center ml-auto">
              Showing {filteredLoads.length} of {loads.length} loads
            </div>
          </div>
        )}
      </div>

      {/* Compact Loads Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-800 text-white sticky top-0">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-medium uppercase">Load ID</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium uppercase">Supplier</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium uppercase">Items</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium uppercase">Est. Footage</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium uppercase">Price</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium uppercase">ETA</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium uppercase">Type</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredLoads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                  {loads.length === 0 ? 'No incoming loads found' : 'No loads match your search'}
                </td>
              </tr>
            ) : (
              filteredLoads.map((load, loadIdx) => (
                <tr 
                  key={load.id} 
                  className={`hover:bg-blue-50 transition-colors ${
                    loadIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="text-xs font-semibold text-gray-900" title={`Created: ${new Date(load.created_at).toLocaleDateString()}`}>
                      {load.load_id}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs font-medium text-gray-900">{load.supplier_name}</div>
                    {load.location_name && (
                      <div className="text-[10px] text-gray-500 truncate max-w-[150px]">{load.location_name}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs space-y-0.5">
                      {load.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="font-medium">{item.species}</span>
                          <span className="text-gray-500">{item.grade}</span>
                          <span className="text-[10px] bg-gray-200 px-1 rounded">{item.thickness}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs space-y-0.5">
                      {load.items.map((item, idx) => (
                        <div key={idx}>
                          {item.estimated_footage?.toLocaleString() || '-'}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs space-y-0.5">
                      {load.items.map((item, idx) => (
                        <div key={idx}>
                          ${item.price?.toFixed(2) || '-'}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="text-xs">
                      {load.estimated_delivery_date ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs capitalize">{load.pickup_or_delivery || '-'}</div>
                    {load.pickup_number && (
                      <div className="text-[10px] text-gray-500">#{load.pickup_number}</div>
                    )}
                    {load.plant && (
                      <div className="text-[10px] text-gray-500 truncate max-w-[80px]">{load.plant}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => router.push(`/dashboard/lumber/data-entry/${load.id}`)}
                      >
                        Entry
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)}
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
