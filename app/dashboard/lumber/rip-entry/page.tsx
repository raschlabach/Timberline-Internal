'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails, LumberPackWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCcw, Save, ArrowLeft, Trash2, Plus, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'

interface Operator {
  id: number
  name: string
  is_active: boolean
}

export default function RipEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [selectedLoad, setSelectedLoad] = useState<LumberLoadWithDetails | null>(null)
  const [packs, setPacks] = useState<LumberPackWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  
  // Filter states
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [speciesFilter, setSpeciesFilter] = useState<string>('all')
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('load_id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Pack editing state
  const [packEdits, setPackEdits] = useState<{ [packId: number]: { 
    pack_id: number | null,
    length: number | null,
    tally_board_feet: number | null,
    actual_board_feet: number | null,
    rip_yield: number | null,
    rip_comments: string | null
  } }>({})
  
  // Load-level operator/stacker assignment
  const [operatorId, setOperatorId] = useState<string>('')
  const [stacker1Id, setStacker1Id] = useState<string>('')
  const [stacker2Id, setStacker2Id] = useState<string>('')
  const [stacker3Id, setStacker3Id] = useState<string>('')
  const [stacker4Id, setStacker4Id] = useState<string>('')
  const [loadQuality, setLoadQuality] = useState<string>('')
  
  // Tally creation state (for loads without tallies)
  const [tallies, setTallies] = useState<{ pack_id: number, length: number, tally_board_feet: number }[]>([
    { pack_id: 0, length: 0, tally_board_feet: 0 }
  ])
  const [selectedItemIdForTally, setSelectedItemIdForTally] = useState<number | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/rip-entry')
    }
  }, [status, router])

  async function fetchLoads() {
    try {
      const [loadsRes, operatorsRes] = await Promise.all([
        fetch('/api/lumber/loads/for-rip'),
        fetch('/api/lumber/operators')
      ])
      
      if (loadsRes.ok) setLoads(await loadsRes.json())
      if (operatorsRes.ok) {
        const allOperators = await operatorsRes.json()
        // Only show active operators
        setOperators(allOperators.filter((op: Operator) => op.is_active))
      }
    } catch (error) {
      console.error('Error fetching rip entry data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLoads()
    }
  }, [status])

  async function handleSelectLoad(loadId: number) {
    const load = loads.find(l => l.id === loadId)
    if (!load) return

    setSelectedLoad(load)
    
    // Fetch packs for this load
    try {
      const response = await fetch(`/api/lumber/packs/by-load/${loadId}`)
      if (response.ok) {
        const data = await response.json()
        setPacks(data)
        
        // Initialize pack edits
        const edits: typeof packEdits = {}
        data.forEach((pack: LumberPackWithDetails) => {
          edits[pack.id] = {
            pack_id: pack.pack_id,
            length: pack.length,
            tally_board_feet: pack.tally_board_feet,
            actual_board_feet: pack.actual_board_feet,
            rip_yield: pack.rip_yield,
            rip_comments: pack.rip_comments
          }
        })
        setPackEdits(edits)
      }
    } catch (error) {
      console.error('Error fetching packs:', error)
    }
    
    // Reset operators/stackers
    setOperatorId('')
    setStacker1Id('')
    setStacker2Id('')
    setStacker3Id('')
    setStacker4Id('')
    setLoadQuality(load.load_quality?.toString() || '')
  }

  function handleBackToList() {
    setSelectedLoad(null)
    setPacks([])
    setPackEdits({})
    setOperatorId('')
    setStacker1Id('')
    setStacker2Id('')
    setStacker3Id('')
    setStacker4Id('')
    setLoadQuality('')
    setTallies([{ pack_id: 0, length: 0, tally_board_feet: 0 }])
    setSelectedItemIdForTally(null)
  }

  function handlePackEdit(packId: number, field: string, value: any) {
    setPackEdits({
      ...packEdits,
      [packId]: {
        ...packEdits[packId],
        [field]: value
      }
    })
  }

  async function handleSavePack(packId: number) {
    const edits = packEdits[packId]
    if (!edits) return

    try {
      const response = await fetch(`/api/lumber/packs/${packId}/rip-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits)
      })

      if (response.ok) {
        toast.success('Pack saved')
        
        // Refresh packs
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
      }
    } catch (error) {
      console.error('Error saving pack:', error)
      toast.success('Error')
    }
  }

  async function handleFinishPack(packId: number) {
    if (!operatorId) {
      toast.success('Missing Operator')
      return
    }

    try {
      const response = await fetch(`/api/lumber/packs/${packId}/finish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: parseInt(operatorId),
          stacker_1_id: stacker1Id ? parseInt(stacker1Id) : null,
          stacker_2_id: stacker2Id ? parseInt(stacker2Id) : null,
          stacker_3_id: stacker3Id ? parseInt(stacker3Id) : null,
          stacker_4_id: stacker4Id ? parseInt(stacker4Id) : null
        })
      })

      if (response.ok) {
        toast.success('Pack finished')
        
        // Refresh
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
      }
    } catch (error) {
      console.error('Error finishing pack:', error)
      toast.success('Error')
    }
  }

  async function handleSaveLoadQuality() {
    if (!selectedLoad) return

    try {
      const response = await fetch(`/api/lumber/loads/${selectedLoad.id}/quality`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_quality: loadQuality ? parseInt(loadQuality) : null
        })
      })

      if (response.ok) {
        toast.success('Load quality saved')
      }
    } catch (error) {
      console.error('Error saving load quality:', error)
    }
  }

  async function handleMarkLoadComplete() {
    if (!selectedLoad) return

    try {
      const response = await fetch(`/api/lumber/loads/${selectedLoad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          all_packs_finished: true
        })
      })

      if (response.ok) {
        toast.success(`Load ${selectedLoad.load_id} marked as complete!`)
        
        // Clear selection and refresh loads
        setSelectedLoad(null)
        setPacks([])
        fetchLoads()
      } else {
        toast.error('Failed to mark load as complete')
      }
    } catch (error) {
      console.error('Error marking load complete:', error)
      toast.error('Error marking load complete')
    }
  }

  async function handleAddPack() {
    if (!selectedLoad || !selectedLoad.items || selectedLoad.items.length === 0) {
      toast.error('No load items found')
      return
    }

    // Use the first item's ID as default
    const loadItemId = selectedLoad.items[0].id

    try {
      const response = await fetch(`/api/lumber/packs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: selectedLoad.id,
          load_item_id: loadItemId,
          pack_id: 0,
          length: 0,
          tally_board_feet: 0
        })
      })

      if (response.ok) {
        toast.success('Pack added')
        
        // Refresh packs
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
      } else {
        toast.error('Failed to add pack')
      }
    } catch (error) {
      console.error('Error adding pack:', error)
      toast.error('Error adding pack')
    }
  }

  async function handleDeletePack(packId: number) {
    if (!confirm('Delete this pack? This cannot be undone.')) return

    try {
      const response = await fetch(`/api/lumber/packs/${packId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Pack deleted')
        
        // Refresh packs
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
      } else {
        toast.error('Failed to delete pack')
      }
    } catch (error) {
      console.error('Error deleting pack:', error)
      toast.error('Error deleting pack')
    }
  }

  // Tally creation functions
  function handleAddTallyRow() {
    setTallies([...tallies, { pack_id: 0, length: 0, tally_board_feet: 0 }])
  }

  function handleTallyChange(index: number, field: string, value: any) {
    const newTallies = [...tallies]
    newTallies[index] = { ...newTallies[index], [field]: field === 'pack_id' || field === 'length' ? parseInt(value) || 0 : parseFloat(value) || 0 }
    setTallies(newTallies)
  }

  async function handleSaveTallies() {
    if (!selectedLoad || !selectedItemIdForTally) return

    const item = selectedLoad.items?.find(i => i.id === selectedItemIdForTally)
    if (!item || !item.actual_footage) {
      toast.error('No actual footage set for this item')
      return
    }

    // Validate that tallies sum to actual footage
    const totalTallied = tallies.reduce((sum, t) => sum + t.tally_board_feet, 0)
    if (Math.abs(totalTallied - item.actual_footage) > 0.01) {
      toast.error(`Pack tallies (${totalTallied.toLocaleString()} BF) must equal actual footage (${item.actual_footage.toLocaleString()} BF)`)
      return
    }

    // Validate pack IDs are unique and non-zero
    const packIds = tallies.map(t => t.pack_id)
    const uniqueIds = new Set(packIds)
    if (uniqueIds.size !== packIds.length || packIds.some(id => id === 0)) {
      toast.error('Pack IDs must be unique and non-zero')
      return
    }

    try {
      const response = await fetch(`/api/lumber/packs/create-tallies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_item_id: selectedItemIdForTally,
          tallies
        })
      })

      if (response.ok) {
        toast.success('Tallies saved successfully')
        
        // Refresh packs for this load
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
        
        // Reset tally state
        setTallies([{ pack_id: 0, length: 0, tally_board_feet: 0 }])
        setSelectedItemIdForTally(null)
      } else {
        toast.error('Failed to save tallies')
      }
    } catch (error) {
      console.error('Error saving tallies:', error)
      toast.error('Error saving tallies')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Sorting function
  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Filter and sort loads
  const filteredLoads: LumberLoadWithDetails[] = loads
    .filter(load => {
      // Search filter
      const matchesSearch = searchTerm === '' ||
        load.load_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.items?.some(item =>
          item.species?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.grade?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      
      // Supplier filter
      const matchesSupplier = supplierFilter === 'all' || load.supplier_name === supplierFilter
      
      // Species filter
      const matchesSpecies = speciesFilter === 'all' || 
        load.items?.some(item => item.species === speciesFilter)
      
      // Grade filter
      const matchesGrade = gradeFilter === 'all' || 
        load.items?.some(item => item.grade === gradeFilter)
      
      return matchesSearch && matchesSupplier && matchesSpecies && matchesGrade
    })
    .sort((a, b) => {
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
        case 'grade':
          aVal = a.items?.[0]?.grade?.toLowerCase() || ''
          bVal = b.items?.[0]?.grade?.toLowerCase() || ''
          break
        case 'footage':
          aVal = (a as any).total_footage || 0
          bVal = (b as any).total_footage || 0
          break
        case 'current':
          aVal = (a as any).current_footage || 0
          bVal = (b as any).current_footage || 0
          break
        case 'arrival':
          aVal = a.actual_arrival_date ? new Date(a.actual_arrival_date).getTime() : 0
          bVal = b.actual_arrival_date ? new Date(b.actual_arrival_date).getTime() : 0
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  // Extract unique values for filters
  const uniqueSuppliers = ['all', ...Array.from(new Set(loads.map(l => l.supplier_name).filter(Boolean)))]
  const uniqueSpecies = ['all', ...Array.from(new Set(loads.flatMap(l => l.items?.map(i => i.species) || []).filter(Boolean)))]
  const uniqueGrades = ['all', ...Array.from(new Set(loads.flatMap(l => l.items?.map(i => i.grade) || []).filter(Boolean)))]

  const totalPacks = packs.length
  const finishedPacks = packs.filter(p => p.is_finished).length
  const totalBF = packs.reduce((sum, p) => sum + p.tally_board_feet, 0)
  const finishedBF = packs.filter(p => p.is_finished).reduce((sum, p) => sum + (p.actual_board_feet || 0), 0)
  const remainingBF = totalBF - finishedBF
  const avgLength = packs.length > 0 ? packs.reduce((sum, p) => sum + p.length, 0) / packs.length : 0

  // Group packs by length for the remaining display
  const remainingByLength = packs.filter(p => !p.is_finished).reduce((acc, pack) => {
    const len = pack.length
    acc[len] = (acc[len] || 0) + pack.tally_board_feet
    return acc
  }, {} as { [key: number]: number })

  return (
    <div className="p-3 space-y-4 max-w-7xl mx-auto">
      {/* Compact Header */}
      <div className="bg-white rounded shadow p-3 flex items-center gap-3">
        {selectedLoad && (
          <Button
            onClick={handleBackToList}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        )}
        <h1 className="text-xl font-bold">Rip Entry</h1>
      </div>

      {!selectedLoad ? (
        /* Load Selector - Full Width when no load selected */
        <div className="bg-white rounded shadow p-3">
          <h2 className="font-semibold mb-2 text-sm">Inventory Loads</h2>
          <p className="text-xs text-gray-600 mb-2">Select a load from inventory to rip</p>
          
          {/* Search and Filters */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm h-8"
            />
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                {uniqueSuppliers.map((supplier) => (
                  <SelectItem key={supplier} value={supplier}>
                    {supplier === 'all' ? 'All Suppliers' : supplier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Species" />
              </SelectTrigger>
              <SelectContent>
                {uniqueSpecies.map((species) => (
                  <SelectItem key={species} value={species}>
                    {species === 'all' ? 'All Species' : species}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                {uniqueGrades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade === 'all' ? 'All Grades' : grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded overflow-auto" style={{ maxHeight: '500px' }}>
            <table className="w-full text-xs">
              <thead className="bg-gray-800 text-white sticky top-0">
                <tr>
                  <th 
                    className="px-2 py-2 text-left cursor-pointer hover:bg-gray-700"
                    onClick={() => handleSort('load_id')}
                  >
                    <div className="flex items-center gap-1">
                      Load ID
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    className="px-2 py-2 text-left cursor-pointer hover:bg-gray-700"
                    onClick={() => handleSort('supplier')}
                  >
                    <div className="flex items-center gap-1">
                      Supplier
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    className="px-2 py-2 text-left cursor-pointer hover:bg-gray-700"
                    onClick={() => handleSort('species')}
                  >
                    <div className="flex items-center gap-1">
                      Species
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    className="px-2 py-2 text-left cursor-pointer hover:bg-gray-700"
                    onClick={() => handleSort('grade')}
                  >
                    <div className="flex items-center gap-1">
                      Grade
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    className="px-2 py-2 text-left cursor-pointer hover:bg-gray-700"
                    onClick={() => handleSort('footage')}
                  >
                    <div className="flex items-center gap-1">
                      Total BF
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    className="px-2 py-2 text-left cursor-pointer hover:bg-gray-700"
                    onClick={() => handleSort('current')}
                  >
                    <div className="flex items-center gap-1">
                      Current BF
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    className="px-2 py-2 text-left cursor-pointer hover:bg-gray-700"
                    onClick={() => handleSort('arrival')}
                  >
                    <div className="flex items-center gap-1">
                      Arrival
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLoads.map((load: any) => (
                  <tr
                    key={load.id}
                    className="cursor-pointer hover:bg-blue-50"
                    onClick={() => handleSelectLoad(load.id)}
                  >
                    <td className="px-2 py-1 border-t">{load.load_id}</td>
                    <td className="px-2 py-1 border-t">{load.supplier_name}</td>
                    <td className="px-2 py-1 border-t">
                      {load.items?.map((i: any) => i.species).join(', ')}
                    </td>
                    <td className="px-2 py-1 border-t">
                      {load.items?.map((i: any) => i.grade).join(', ')}
                    </td>
                    <td className="px-2 py-1 border-t">
                      {load.total_footage?.toLocaleString() || '0'}
                    </td>
                    <td className="px-2 py-1 border-t">
                      {load.current_footage?.toLocaleString() || '0'}
                    </td>
                    <td className="px-2 py-1 border-t">
                      {load.actual_arrival_date 
                        ? new Date(load.actual_arrival_date).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Edit Pack Data - Full Width when load selected */
        <div className="bg-white rounded shadow p-3 space-y-3">
          {selectedLoad && (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-sm mb-2">
                    Edit {selectedLoad.load_id} Data
                  </h2>
                  <div className="text-xs text-gray-700 flex gap-3 items-center flex-wrap mb-2">
                    <span className="font-semibold">{selectedLoad.load_id}</span>
                    <span>{selectedLoad.supplier_name}</span>
                    {selectedLoad.items.map((item, idx) => (
                      <span key={idx}>{item.species} - {item.grade}</span>
                    ))}
                    <span>{totalBF.toLocaleString()} ft</span>
                    <span>{selectedLoad.actual_arrival_date && new Date(selectedLoad.actual_arrival_date).toLocaleDateString()}</span>
                  </div>
                </div>
                
                {/* Complete Load Button - Always Visible */}
                <Button
                  onClick={handleMarkLoadComplete}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 text-sm"
                >
                  Complete Load
                </Button>
              </div>

              {/* All Packs Finished Notification */}
              {packs.length > 0 && packs.every(p => p.is_finished) && (
                <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                  <p className="text-sm text-green-900 font-medium flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    All {packs.length} packs finished! Click "Complete Load" button to finalize.
                  </p>
                </div>
              )}

              {/* Operator/Stacker Selection - Compact Row */}
              <div className="grid grid-cols-7 gap-2">
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select value={operatorId} onValueChange={setOperatorId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map(operator => (
                        <SelectItem key={operator.id} value={operator.id.toString()}>
                          {operator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 1</Label>
                  <Select value={stacker1Id} onValueChange={setStacker1Id}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map(operator => (
                        <SelectItem key={operator.id} value={operator.id.toString()}>
                          {operator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 2</Label>
                  <Select value={stacker2Id} onValueChange={setStacker2Id}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map(operator => (
                        <SelectItem key={operator.id} value={operator.id.toString()}>
                          {operator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 3</Label>
                  <Select value={stacker3Id} onValueChange={setStacker3Id}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map(operator => (
                        <SelectItem key={operator.id} value={operator.id.toString()}>
                          {operator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 4</Label>
                  <Select value={stacker4Id} onValueChange={setStacker4Id}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map(operator => (
                        <SelectItem key={operator.id} value={operator.id.toString()}>
                          {operator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Load Quality</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={loadQuality}
                    onChange={(e) => setLoadQuality(e.target.value)}
                    onBlur={handleSaveLoadQuality}
                    className="h-7 text-xs"
                    placeholder="0-100"
                  />
                </div>
              </div>

              {/* Current Load Status */}
              <div className="text-xs text-gray-700 flex gap-3 py-1 border-t border-b">
                <span>{remainingBF.toLocaleString()} Ft Left</span>
                {selectedLoad.items.map((item, idx) => (
                  <span key={idx}>{item.species} - {item.grade}</span>
                ))}
                <span>{totalBF.toLocaleString()} ft</span>
              </div>

              {/* Conditional: Show Tally Entry if no packs exist, otherwise show pack tables */}
              {packs.length === 0 ? (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-sm font-semibold mb-3 text-blue-900">No Tallies Entered Yet - Create Pack Tallies</h3>
                  
                  {/* Item Selection */}
                  <div className="mb-4">
                    <Label className="text-sm">Select Item to Tally</Label>
                    <Select value={selectedItemIdForTally?.toString() || ''} onValueChange={(val) => setSelectedItemIdForTally(parseInt(val))}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Choose species/grade/thickness" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedLoad?.items?.map(item => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.species} - {item.grade} - {item.thickness}" - {item.actual_footage?.toLocaleString()} BF
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tally Input Table */}
                  {selectedItemIdForTally && (
                    <>
                      <div className="border rounded overflow-auto mb-3" style={{ maxHeight: '300px' }}>
                        <table className="w-full text-xs">
                          <thead className="bg-gray-800 text-white sticky top-0">
                            <tr>
                              <th className="px-2 py-1 text-left">Pack ID</th>
                              <th className="px-2 py-1 text-left">Length (ft)</th>
                              <th className="px-2 py-1 text-left">Board Feet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tallies.map((tally, index) => (
                              <tr key={index}>
                                <td className="px-1 py-1 border-t">
                                  <Input
                                    type="number"
                                    value={tally.pack_id || ''}
                                    onChange={(e) => handleTallyChange(index, 'pack_id', e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                </td>
                                <td className="px-1 py-1 border-t">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={tally.length || ''}
                                    onChange={(e) => handleTallyChange(index, 'length', e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                </td>
                                <td className="px-1 py-1 border-t">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={tally.tally_board_feet || ''}
                                    onChange={(e) => handleTallyChange(index, 'tally_board_feet', e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleAddTallyRow} size="sm" variant="outline">
                          Add Row
                        </Button>
                        <Button onClick={handleSaveTallies} size="sm" className="bg-blue-600 text-white">
                          Save Tallies
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Pack Info */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-xs font-semibold">Pack Information</h3>
                      <Button onClick={handleAddPack} size="sm" className="h-6 px-2 text-xs" variant="outline">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Pack
                      </Button>
                    </div>
                    <div className="border rounded overflow-auto" style={{ maxHeight: '350px' }}>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left w-24">Pack ID</th>
                            <th className="px-2 py-1 text-left w-24">Lth</th>
                            <th className="px-2 py-1 text-left w-24">Brd Ft</th>
                            <th className="px-2 py-1 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {packs.map(pack => (
                            <tr key={pack.id} className={pack.is_finished ? 'bg-green-50' : ''}>
                              <td className="px-1 py-1 border-t">
                                {pack.is_finished ? (
                                  <span className="px-1">{pack.pack_id}</span>
                                ) : (
                                  <Input
                                    type="number"
                                    value={packEdits[pack.id]?.pack_id ?? pack.pack_id}
                                    onChange={(e) => handlePackEdit(pack.id, 'pack_id', parseInt(e.target.value) || 0)}
                                    onBlur={() => handleSavePack(pack.id)}
                                    className="h-6 text-xs"
                                  />
                                )}
                              </td>
                              <td className="px-1 py-1 border-t">
                                {pack.is_finished ? (
                                  <span className="px-1">{pack.length}</span>
                                ) : (
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={packEdits[pack.id]?.length ?? pack.length}
                                    onChange={(e) => handlePackEdit(pack.id, 'length', parseFloat(e.target.value) || 0)}
                                    onBlur={() => handleSavePack(pack.id)}
                                    className="h-6 text-xs"
                                  />
                                )}
                              </td>
                              <td className="px-1 py-1 border-t">
                                {pack.is_finished ? (
                                  <span className="px-1">{pack.tally_board_feet}</span>
                                ) : (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={packEdits[pack.id]?.tally_board_feet ?? pack.tally_board_feet}
                                    onChange={(e) => handlePackEdit(pack.id, 'tally_board_feet', parseFloat(e.target.value) || 0)}
                                    onBlur={() => handleSavePack(pack.id)}
                                    className="h-6 text-xs"
                                  />
                                )}
                              </td>
                              <td className="px-1 py-1 border-t">
                                {!pack.is_finished && (
                                  <Button
                                    onClick={() => handleDeletePack(pack.id)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-semibold">
                            <td className="px-2 py-1">{totalPacks} Packs</td>
                            <td className="px-2 py-1">{avgLength.toFixed(2)}</td>
                            <td className="px-2 py-1" colSpan={2}>{totalBF.toLocaleString()} BF</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                {/* Rip Yield & Comments */}
                <div>
                  <h3 className="text-xs font-semibold mb-1">Rip Yield & Comments</h3>
                  <div className="border rounded overflow-auto" style={{ maxHeight: '350px' }}>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left w-24">Act Brd Ft</th>
                          <th className="px-2 py-1 text-left w-24">Rip Yield</th>
                          <th className="px-2 py-1 text-left w-24">Comments</th>
                          <th className="px-2 py-1 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {packs.map(pack => (
                          <tr key={pack.id} className={pack.is_finished ? 'bg-green-50' : ''}>
                            <td className="px-1 py-1 border-t">
                              {pack.is_finished ? (
                                <span className="text-xs">{pack.actual_board_feet}</span>
                              ) : (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={packEdits[pack.id]?.actual_board_feet || ''}
                                  onChange={(e) => handlePackEdit(pack.id, 'actual_board_feet', parseFloat(e.target.value) || null)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  className="h-6 text-xs px-1"
                                />
                              )}
                            </td>
                            <td className="px-1 py-1 border-t">
                              {pack.is_finished ? (
                                <span className="text-xs">{pack.rip_yield}</span>
                              ) : (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={packEdits[pack.id]?.rip_yield || ''}
                                  onChange={(e) => handlePackEdit(pack.id, 'rip_yield', parseFloat(e.target.value) || null)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  className="h-6 text-xs px-1"
                                />
                              )}
                            </td>
                            <td className="px-1 py-1 border-t">
                              {pack.is_finished ? (
                                <span className="text-xs">{pack.rip_comments || '-'}</span>
                              ) : (
                                <Input
                                  value={packEdits[pack.id]?.rip_comments || ''}
                                  onChange={(e) => handlePackEdit(pack.id, 'rip_comments', e.target.value)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  className="h-6 text-xs px-1"
                                />
                              )}
                            </td>
                            <td className="px-1 py-1 border-t">
                              {!pack.is_finished && (
                                <Button
                                  size="sm"
                                  onClick={() => handleFinishPack(pack.id)}
                                  className="h-6 px-2 text-xs"
                                  disabled={!packEdits[pack.id]?.actual_board_feet || !packEdits[pack.id]?.rip_yield}
                                >
                                  <RefreshCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 font-semibold">
                          <td className="px-2 py-1">{finishedBF.toLocaleString()} BF</td>
                          <td className="px-2 py-1">
                            {packs.length > 0 
                              ? (packs.filter(p => p.rip_yield).reduce((sum, p) => sum + (p.rip_yield || 0), 0) / packs.filter(p => p.rip_yield).length).toFixed(2)
                              : '0.00'} Avg
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                </div>
              )}

              {/* Remaining Board Feet by Length - Only show if packs exist */}
              {packs.length > 0 && (
              <div className="border-t pt-2">
                <h3 className="text-xs font-semibold mb-1">Board Feet Remaining</h3>
                <div className="flex gap-4">
                  {Object.entries(remainingByLength).map(([length, bf]) => (
                    <div key={length} className="text-xs">
                      <span className="font-semibold">{length} ft:</span>{' '}
                      <span>{Number(bf).toLocaleString()} brd ft</span>
                    </div>
                  ))}
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
