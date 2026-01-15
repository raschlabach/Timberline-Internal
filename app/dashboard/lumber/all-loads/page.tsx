'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails, LumberPackWithDetails } from '@/types/lumber'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Search, Info, CheckCircle, XCircle, X, Package, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Operator {
  id: number
  name: string
  is_active: boolean
}

export default function AllLoadsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [filteredLoads, setFilteredLoads] = useState<LumberLoadWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [speciesColors, setSpeciesColors] = useState<Record<string, string>>({})
  const [selectedLoads, setSelectedLoads] = useState<Set<number>>(new Set())
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Filter states
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [selectedThickness, setSelectedThickness] = useState<string>('all')
  
  // Unique values for filters
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [species, setSpecies] = useState<string[]>([])
  const [grades, setGrades] = useState<string[]>([])
  const [thicknesses, setThicknesses] = useState<string[]>([])
  
  // Pack dialog states
  const [packDialogOpen, setPackDialogOpen] = useState(false)
  const [selectedLoadForPacks, setSelectedLoadForPacks] = useState<LumberLoadWithDetails | null>(null)
  const [loadPacks, setLoadPacks] = useState<any[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [packEdits, setPackEdits] = useState<Record<number, any>>({})
  const [isSavingPacks, setIsSavingPacks] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/all-loads')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const [loadsRes, speciesRes, operatorsRes] = await Promise.all([
          fetch('/api/lumber/loads'),
          fetch('/api/lumber/species'),
          fetch('/api/lumber/operators')
        ])
        
        if (loadsRes.ok) {
          const data = await loadsRes.json()
          setLoads(data)
          setFilteredLoads(data)
          
          // Extract unique values for filters
          const uniqueSuppliers = Array.from(new Set(data.map((l: any) => l.supplier_name).filter(Boolean))).sort() as string[]
          const uniqueSpecies = Array.from(new Set(data.flatMap((l: any) => l.items?.map((i: any) => i.species) || []).filter(Boolean))).sort() as string[]
          const uniqueGrades = Array.from(new Set(data.flatMap((l: any) => l.items?.map((i: any) => i.grade) || []).filter(Boolean))).sort() as string[]
          const uniqueThicknesses = Array.from(new Set(data.flatMap((l: any) => l.items?.map((i: any) => i.thickness) || []).filter(Boolean))).sort() as string[]
          
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
        
        if (operatorsRes.ok) {
          setOperators(await operatorsRes.json())
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
        load.invoice_number?.toLowerCase().includes(search)
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

    setFilteredLoads(filtered)
  }, [searchTerm, selectedSupplier, selectedSpecies, selectedGrade, selectedThickness, loads])

  function clearAllFilters() {
    setSearchTerm('')
    setSelectedSupplier('all')
    setSelectedSpecies('all')
    setSelectedGrade('all')
    setSelectedThickness('all')
  }

  const hasActiveFilters = searchTerm !== '' || selectedSupplier !== 'all' || selectedSpecies !== 'all' || selectedGrade !== 'all' || selectedThickness !== 'all'

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLoads(new Set(filteredLoads.map(l => l.id)))
    } else {
      setSelectedLoads(new Set())
    }
  }

  const handleSelectLoad = (loadId: number, checked: boolean) => {
    const newSelected = new Set(selectedLoads)
    if (checked) {
      newSelected.add(loadId)
    } else {
      newSelected.delete(loadId)
    }
    setSelectedLoads(newSelected)
  }

  const isAllSelected = filteredLoads.length > 0 && filteredLoads.every(l => selectedLoads.has(l.id))
  const isSomeSelected = selectedLoads.size > 0

  // Bulk update handler
  const handleBulkUpdate = async (markAsFinished: boolean) => {
    if (selectedLoads.size === 0) return
    
    setIsUpdating(true)
    try {
      const promises = Array.from(selectedLoads).map(loadId =>
        fetch(`/api/lumber/loads/${loadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all_packs_finished: markAsFinished })
        })
      )
      
      await Promise.all(promises)
      
      // Refresh the loads - the useEffect will handle filtering
      const loadsRes = await fetch('/api/lumber/loads')
      if (loadsRes.ok) {
        const data = await loadsRes.json()
        setLoads(data)
      }
      
      // Clear selection
      setSelectedLoads(new Set())
    } catch (error) {
      console.error('Error updating loads:', error)
      alert('Failed to update some loads. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  // Pack dialog functions
  async function openPackDialog(load: LumberLoadWithDetails) {
    setSelectedLoadForPacks(load)
    setPackDialogOpen(true)
    setPackEdits({})
    
    try {
      const response = await fetch(`/api/lumber/loads/${load.id}/packs`)
      if (response.ok) {
        const packs = await response.json()
        setLoadPacks(packs)
        // Initialize edits with current values
        const edits: Record<number, any> = {}
        packs.forEach((pack: any) => {
          edits[pack.id] = {
            pack_id: pack.pack_id || '',
            length: pack.length || '',
            tally_board_feet: pack.tally_board_feet || '',
            actual_board_feet: pack.actual_board_feet || '',
            rip_yield: pack.rip_yield || '',
            rip_comments: pack.rip_comments || '',
            operator_id: pack.operator_id?.toString() || '',
            stacker_1_id: pack.stacker_1_id?.toString() || '',
            stacker_2_id: pack.stacker_2_id?.toString() || '',
            stacker_3_id: pack.stacker_3_id?.toString() || '',
            stacker_4_id: pack.stacker_4_id?.toString() || '',
            load_quality: pack.load_quality || '',
            is_finished: pack.is_finished || false,
            finished_at: pack.finished_at ? pack.finished_at.split('T')[0] : ''
          }
        })
        setPackEdits(edits)
      }
    } catch (error) {
      console.error('Error fetching packs:', error)
      toast.error('Failed to load packs')
    }
  }

  function updatePackEdit(packId: number, field: string, value: any) {
    setPackEdits(prev => ({
      ...prev,
      [packId]: {
        ...prev[packId],
        [field]: value
      }
    }))
  }

  async function savePackChanges(packId: number) {
    const edit = packEdits[packId]
    if (!edit) return

    setIsSavingPacks(true)
    try {
      // Save rip data
      const response = await fetch(`/api/lumber/packs/${packId}/rip-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_id: edit.pack_id || null,
          length: edit.length ? parseInt(edit.length) : null,
          tally_board_feet: edit.tally_board_feet ? parseInt(edit.tally_board_feet) : null,
          actual_board_feet: edit.actual_board_feet ? parseInt(edit.actual_board_feet) : null,
          rip_yield: edit.rip_yield ? parseFloat(edit.rip_yield) : null,
          rip_comments: edit.rip_comments || null,
          operator_id: edit.operator_id ? parseInt(edit.operator_id) : null,
          stacker_1_id: edit.stacker_1_id ? parseInt(edit.stacker_1_id) : null,
          stacker_2_id: edit.stacker_2_id ? parseInt(edit.stacker_2_id) : null,
          stacker_3_id: edit.stacker_3_id ? parseInt(edit.stacker_3_id) : null,
          stacker_4_id: edit.stacker_4_id ? parseInt(edit.stacker_4_id) : null,
          load_quality: edit.load_quality || null,
          is_finished: edit.is_finished,
          finished_at: edit.finished_at || null
        })
      })

      if (response.ok) {
        toast.success('Pack saved')
        // Refresh packs
        if (selectedLoadForPacks) {
          const packsRes = await fetch(`/api/lumber/loads/${selectedLoadForPacks.id}/packs`)
          if (packsRes.ok) {
            setLoadPacks(await packsRes.json())
          }
        }
      } else {
        toast.error('Failed to save pack')
      }
    } catch (error) {
      console.error('Error saving pack:', error)
      toast.error('Failed to save pack')
    } finally {
      setIsSavingPacks(false)
    }
  }

  async function deletePack(packId: number) {
    if (!confirm('Are you sure you want to delete this pack?')) return

    try {
      const response = await fetch(`/api/lumber/packs/${packId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Pack deleted')
        setLoadPacks(prev => prev.filter(p => p.id !== packId))
        const newEdits = { ...packEdits }
        delete newEdits[packId]
        setPackEdits(newEdits)
      } else {
        toast.error('Failed to delete pack')
      }
    } catch (error) {
      console.error('Error deleting pack:', error)
      toast.error('Failed to delete pack')
    }
  }

  async function addNewPack() {
    if (!selectedLoadForPacks) return

    try {
      // Get the first item's id for the pack
      const loadItemId = selectedLoadForPacks.items[0]?.id
      if (!loadItemId) {
        toast.error('No load items found')
        return
      }

      const response = await fetch('/api/lumber/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: selectedLoadForPacks.id,
          load_item_id: loadItemId,
          pack_id: null,
          length: null,
          tally_board_feet: null
        })
      })

      if (response.ok) {
        toast.success('Pack added')
        // Refresh packs
        const packsRes = await fetch(`/api/lumber/loads/${selectedLoadForPacks.id}/packs`)
        if (packsRes.ok) {
          const packs = await packsRes.json()
          setLoadPacks(packs)
          // Initialize edit for new pack
          const newPack = packs[packs.length - 1]
          if (newPack) {
            setPackEdits(prev => ({
              ...prev,
              [newPack.id]: {
                pack_id: '',
                length: '',
                tally_board_feet: '',
                actual_board_feet: '',
                rip_yield: '',
                rip_comments: '',
                operator_id: '',
                stacker_1_id: '',
                stacker_2_id: '',
                stacker_3_id: '',
                stacker_4_id: '',
                load_quality: '',
                is_finished: false,
                finished_at: ''
              }
            }))
          }
        }
      } else {
        toast.error('Failed to add pack')
      }
    } catch (error) {
      console.error('Error adding pack:', error)
      toast.error('Failed to add pack')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Loads</h1>
        <p className="text-sm text-gray-600 mt-1">Complete history of all lumber loads ({filteredLoads.length} {filteredLoads.length === 1 ? 'load' : 'loads'})</p>
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
        
        {/* Bulk Action Buttons - Show when items are selected */}
        {isSomeSelected && (
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
            <span className="text-sm font-medium text-blue-800">
              {selectedLoads.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => handleBulkUpdate(true)}
              disabled={isUpdating}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Finished
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => handleBulkUpdate(false)}
              disabled={isUpdating}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Mark Unfinished
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-gray-500"
              onClick={() => setSelectedLoads(new Set())}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Loads Table - Compact Design */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-800 text-white sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-center w-10">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className="border-white data-[state=checked]:bg-white data-[state=checked]:text-gray-800"
                  />
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Load ID
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Species / Grade
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Actual Footage
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Arrival
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Status
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  
                </th>
              </tr>
            </thead>
            <tbody>
            {filteredLoads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-2 py-8 text-center text-xs text-gray-500">
                  {loads.length === 0 ? 'No loads found' : 'No loads match your search'}
                </td>
              </tr>
            ) : (
              filteredLoads.map((load, loadIdx) => (
                <tr 
                  key={load.id} 
                  className={`hover:bg-gray-100 ${selectedLoads.has(load.id) ? 'bg-blue-50' : loadIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="px-2 py-1.5 text-center">
                    <Checkbox
                      checked={selectedLoads.has(load.id)}
                      onCheckedChange={(checked) => handleSelectLoad(load.id, checked as boolean)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-gray-900">{load.load_id}</div>
                    <div className="text-[10px] text-gray-500">
                      {new Date(load.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs text-gray-900">{load.supplier_name}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs text-gray-900 flex flex-wrap gap-x-2 gap-y-0.5">
                      {load.items.map((item, idx) => (
                        <span key={idx} className="flex items-center gap-1">
                          <span 
                            className="w-2 h-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: speciesColors[item.species] || '#6B7280' }}
                          />
                          {item.species} {item.grade} [{item.thickness}]
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs text-gray-900">
                      {load.items.map((item, idx) => (
                        <span key={idx}>
                          {item.actual_footage ? `${item.actual_footage.toLocaleString()}` : '-'}{idx < load.items.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs text-gray-900">
                      {load.actual_arrival_date 
                        ? new Date(load.actual_arrival_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '-'}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs text-gray-900">{load.invoice_number || '-'}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    {!load.actual_arrival_date && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800">
                        Incoming
                      </span>
                    )}
                    {load.actual_arrival_date && !load.all_packs_tallied && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                        Tally
                      </span>
                    )}
                    {load.all_packs_tallied && !load.all_packs_finished && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                        Ripping
                      </span>
                    )}
                    {load.all_packs_finished && !load.is_paid && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800">
                        Payment
                      </span>
                    )}
                    {load.is_paid && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                        Complete
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)}
                        title="Load Info"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => openPackDialog(load)}
                        title="Edit Packs"
                      >
                        <Package className="h-3 w-3" />
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

      {/* Pack Edit Dialog - Table Layout like Rip Entry */}
      <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Edit Packs - Load {selectedLoadForPacks?.load_id}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({loadPacks.length} packs)
                </span>
              </DialogTitle>
              <Button size="sm" onClick={addNewPack} className="h-7">
                Add Pack
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {loadPacks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No packs found for this load. Click "Add Pack" to create one.
              </div>
            ) : (
              <div className="border rounded mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-1 py-2 text-left w-16">Pack ID</th>
                      <th className="px-1 py-2 text-left w-12">Lth</th>
                      <th className="px-1 py-2 text-left w-16">Tally BF</th>
                      <th className="px-1 py-2 text-left w-16">Act BF</th>
                      <th className="px-1 py-2 text-left w-14">Yield</th>
                      <th className="px-1 py-2 text-left w-24">Operator</th>
                      <th className="px-1 py-2 text-left w-24">Stacker 1</th>
                      <th className="px-1 py-2 text-left w-24">Stacker 2</th>
                      <th className="px-1 py-2 text-left w-24">Stacker 3</th>
                      <th className="px-1 py-2 text-left w-24">Stacker 4</th>
                      <th className="px-1 py-2 text-center w-12">Done</th>
                      <th className="px-1 py-2 text-left w-28">Finish Date</th>
                      <th className="px-1 py-2 text-left">Comments</th>
                      <th className="px-1 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadPacks.map((pack, idx) => (
                      <tr 
                        key={pack.id} 
                        className={`border-t ${packEdits[pack.id]?.is_finished ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-1 py-1">
                          <Input
                            className="h-7 text-xs w-full"
                            value={packEdits[pack.id]?.pack_id || ''}
                            onChange={(e) => updatePackEdit(pack.id, 'pack_id', e.target.value)}
                            onBlur={() => savePackChanges(pack.id)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            className="h-7 text-xs w-full"
                            value={packEdits[pack.id]?.length || ''}
                            onChange={(e) => updatePackEdit(pack.id, 'length', e.target.value)}
                            onBlur={() => savePackChanges(pack.id)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            className="h-7 text-xs w-full"
                            value={packEdits[pack.id]?.tally_board_feet || ''}
                            onChange={(e) => updatePackEdit(pack.id, 'tally_board_feet', e.target.value)}
                            onBlur={() => savePackChanges(pack.id)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            className="h-7 text-xs w-full"
                            value={packEdits[pack.id]?.actual_board_feet || ''}
                            onChange={(e) => updatePackEdit(pack.id, 'actual_board_feet', e.target.value)}
                            onBlur={() => savePackChanges(pack.id)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-7 text-xs w-full"
                            value={packEdits[pack.id]?.rip_yield || ''}
                            onChange={(e) => updatePackEdit(pack.id, 'rip_yield', e.target.value)}
                            onBlur={() => savePackChanges(pack.id)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            value={packEdits[pack.id]?.operator_id || 'none'}
                            onValueChange={(val) => {
                              updatePackEdit(pack.id, 'operator_id', val === 'none' ? '' : val)
                              setTimeout(() => savePackChanges(pack.id), 100)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.filter(o => o.is_active).map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>
                                  {op.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            value={packEdits[pack.id]?.stacker_1_id || 'none'}
                            onValueChange={(val) => {
                              updatePackEdit(pack.id, 'stacker_1_id', val === 'none' ? '' : val)
                              setTimeout(() => savePackChanges(pack.id), 100)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.filter(o => o.is_active).map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>
                                  {op.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            value={packEdits[pack.id]?.stacker_2_id || 'none'}
                            onValueChange={(val) => {
                              updatePackEdit(pack.id, 'stacker_2_id', val === 'none' ? '' : val)
                              setTimeout(() => savePackChanges(pack.id), 100)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.filter(o => o.is_active).map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>
                                  {op.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            value={packEdits[pack.id]?.stacker_3_id || 'none'}
                            onValueChange={(val) => {
                              updatePackEdit(pack.id, 'stacker_3_id', val === 'none' ? '' : val)
                              setTimeout(() => savePackChanges(pack.id), 100)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.filter(o => o.is_active).map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>
                                  {op.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            value={packEdits[pack.id]?.stacker_4_id || 'none'}
                            onValueChange={(val) => {
                              updatePackEdit(pack.id, 'stacker_4_id', val === 'none' ? '' : val)
                              setTimeout(() => savePackChanges(pack.id), 100)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {operators.filter(o => o.is_active).map(op => (
                                <SelectItem key={op.id} value={op.id.toString()}>
                                  {op.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1 text-center">
                          <Checkbox
                            checked={packEdits[pack.id]?.is_finished || false}
                            onCheckedChange={(checked) => {
                              updatePackEdit(pack.id, 'is_finished', checked)
                              setTimeout(() => savePackChanges(pack.id), 100)
                            }}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="date"
                            className="h-7 text-xs w-full"
                            value={packEdits[pack.id]?.finished_at || ''}
                            onChange={(e) => updatePackEdit(pack.id, 'finished_at', e.target.value)}
                            onBlur={() => savePackChanges(pack.id)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            className="h-7 text-xs w-full"
                            value={packEdits[pack.id]?.rip_comments || ''}
                            onChange={(e) => updatePackEdit(pack.id, 'rip_comments', e.target.value)}
                            onBlur={() => savePackChanges(pack.id)}
                            placeholder="Comments..."
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deletePack(pack.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Summary Footer */}
          {loadPacks.length > 0 && (
            <div className="pt-2 border-t mt-2">
              <div className="flex gap-6 text-xs">
                <div>
                  <span className="text-gray-500">Total Packs:</span>
                  <span className="ml-1 font-semibold">{loadPacks.length}</span>
                </div>
                <div>
                  <span className="text-gray-500">Finished:</span>
                  <span className="ml-1 font-semibold text-green-600">
                    {loadPacks.filter(p => packEdits[p.id]?.is_finished).length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Total Tally BF:</span>
                  <span className="ml-1 font-semibold">
                    {loadPacks.reduce((sum, p) => sum + (parseInt(packEdits[p.id]?.tally_board_feet) || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Total Actual BF:</span>
                  <span className="ml-1 font-semibold">
                    {loadPacks.reduce((sum, p) => sum + (parseInt(packEdits[p.id]?.actual_board_feet) || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
