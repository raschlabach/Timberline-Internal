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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { RefreshCcw, Save, ArrowLeft, Trash2, Plus, ArrowUpDown, Pencil, Scissors } from 'lucide-react'
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
  const [thicknessFilter, setThicknessFilter] = useState<string>('all')
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('load_id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Pack editing state
  const [packEdits, setPackEdits] = useState<{ [packId: number]: { 
    pack_id: string | number | null,
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
  
  // Edit pack dialog state
  const [editPackDialogOpen, setEditPackDialogOpen] = useState(false)
  const [editingPack, setEditingPack] = useState<LumberPackWithDetails | null>(null)
  const [editPackData, setEditPackData] = useState({
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
    is_finished: false,
    finished_at: ''
  })

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
        
        // Pre-populate operator/stacker from last assigned pack
        if (data.length > 0) {
          // Find the most recent pack with operator assigned (work backwards)
          const lastAssignedPack = [...data].reverse().find((pack: LumberPackWithDetails) => pack.operator_id)
          if (lastAssignedPack) {
            setOperatorId(lastAssignedPack.operator_id?.toString() || '')
            setStacker1Id(lastAssignedPack.stacker_1_id?.toString() || '')
            setStacker2Id(lastAssignedPack.stacker_2_id?.toString() || '')
            setStacker3Id(lastAssignedPack.stacker_3_id?.toString() || '')
            setStacker4Id(lastAssignedPack.stacker_4_id?.toString() || '')
          } else {
            // No packs assigned yet, reset to empty
            setOperatorId('')
            setStacker1Id('')
            setStacker2Id('')
            setStacker3Id('')
            setStacker4Id('')
          }
        } else {
          // No packs, reset to empty
          setOperatorId('')
          setStacker1Id('')
          setStacker2Id('')
          setStacker3Id('')
          setStacker4Id('')
        }
      }
    } catch (error) {
      console.error('Error fetching packs:', error)
    }
    
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

  async function handlePartialFinish(packId: number) {
    const packEdit = packEdits[packId]
    const pack = packs.find(p => p.id === packId)
    
    if (!pack) {
      toast.error('Pack not found')
      return
    }

    if (!operatorId) {
      toast.error('Please select an operator')
      return
    }

    const actualBFRaw = packEdit?.actual_board_feet
    if (!actualBFRaw) {
      toast.error('Please enter Actual Board Feet first')
      return
    }

    // Use edited values if available, otherwise use saved pack values
    // IMPORTANT: Convert to numbers to avoid string comparison issues (DECIMAL comes as string from DB)
    const actualBF = Number(actualBFRaw)
    const tallyBFRaw = packEdit?.tally_board_feet ?? pack.tally_board_feet
    const tallyBF = Number(tallyBFRaw) || 0
    const packIdValue = packEdit?.pack_id ?? pack.pack_id
    const lengthValue = packEdit?.length ?? pack.length

    if (!tallyBF || tallyBF <= 0) {
      toast.error('Please enter Tally Board Feet (Brd Ft) first')
      return
    }

    if (actualBF >= tallyBF) {
      toast.error(`Actual BF (${actualBF}) must be less than Tally BF (${tallyBF}) for partial finish. Use regular finish instead.`)
      return
    }

    try {
      const response = await fetch(`/api/lumber/packs/${packId}/partial-finish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_board_feet: actualBF,
          tally_board_feet: tallyBF,
          pack_id: packIdValue,
          length: lengthValue,
          operator_id: parseInt(operatorId),
          stacker_1_id: stacker1Id ? parseInt(stacker1Id) : null,
          stacker_2_id: stacker2Id ? parseInt(stacker2Id) : null,
          stacker_3_id: stacker3Id ? parseInt(stacker3Id) : null,
          stacker_4_id: stacker4Id ? parseInt(stacker4Id) : null
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Pack split! New pack "${data.newPack.pack_id}" created with ${Math.round(data.newPack.tally_board_feet)} BF remaining`)
        
        // Refresh
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to partial finish pack')
      }
    } catch (error) {
      console.error('Error partial finishing pack:', error)
      toast.error('Error partial finishing pack')
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

  function handleOpenEditPack(pack: LumberPackWithDetails) {
    setEditingPack(pack)
    setEditPackData({
      pack_id: pack.pack_id != null ? String(pack.pack_id) : '',
      length: pack.length != null ? String(pack.length) : '',
      tally_board_feet: pack.tally_board_feet != null ? String(pack.tally_board_feet) : '',
      actual_board_feet: pack.actual_board_feet != null ? String(pack.actual_board_feet) : '',
      rip_yield: pack.rip_yield != null ? String(pack.rip_yield) : '',
      rip_comments: pack.rip_comments || '',
      operator_id: pack.operator_id != null ? String(pack.operator_id) : '',
      stacker_1_id: pack.stacker_1_id != null ? String(pack.stacker_1_id) : '',
      stacker_2_id: pack.stacker_2_id != null ? String(pack.stacker_2_id) : '',
      stacker_3_id: pack.stacker_3_id != null ? String(pack.stacker_3_id) : '',
      stacker_4_id: pack.stacker_4_id != null ? String(pack.stacker_4_id) : '',
      is_finished: pack.is_finished,
      finished_at: pack.finished_at ? pack.finished_at.split('T')[0] : ''
    })
    setEditPackDialogOpen(true)
  }

  async function handleSaveEditPack() {
    if (!editingPack) return

    try {
      const response = await fetch(`/api/lumber/packs/${editingPack.id}/rip-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_id: editPackData.pack_id || null,
          length: editPackData.length !== '' ? parseInt(editPackData.length) : null,
          tally_board_feet: editPackData.tally_board_feet !== '' ? parseInt(editPackData.tally_board_feet) : null,
          actual_board_feet: editPackData.actual_board_feet !== '' ? parseInt(editPackData.actual_board_feet) : null,
          rip_yield: editPackData.rip_yield !== '' ? parseFloat(editPackData.rip_yield) : null,
          rip_comments: editPackData.rip_comments || null,
          operator_id: editPackData.operator_id !== '' ? parseInt(editPackData.operator_id) : null,
          stacker_1_id: editPackData.stacker_1_id !== '' ? parseInt(editPackData.stacker_1_id) : null,
          stacker_2_id: editPackData.stacker_2_id !== '' ? parseInt(editPackData.stacker_2_id) : null,
          stacker_3_id: editPackData.stacker_3_id !== '' ? parseInt(editPackData.stacker_3_id) : null,
          stacker_4_id: editPackData.stacker_4_id !== '' ? parseInt(editPackData.stacker_4_id) : null,
          is_finished: editPackData.is_finished,
          finished_at: editPackData.finished_at || null
        })
      })

      if (response.ok) {
        toast.success('Pack updated')
        setEditPackDialogOpen(false)
        setEditingPack(null)
        // Refresh packs
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
      } else {
        toast.error('Failed to update pack')
      }
    } catch (error) {
      console.error('Error updating pack:', error)
      toast.error('Failed to update pack')
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
          pack_id: null,
          length: null,
          tally_board_feet: null
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
    if (field === 'pack_id') {
      newTallies[index] = { ...newTallies[index], [field]: value }
    } else if (field === 'length') {
      newTallies[index] = { ...newTallies[index], [field]: parseInt(value) || 0 }
    } else {
      newTallies[index] = { ...newTallies[index], [field]: parseFloat(value) || 0 }
    }
    setTallies(newTallies)
  }

  async function handleSaveTallies() {
    if (!selectedLoad || !selectedItemIdForTally) return

    const item = selectedLoad.items?.find(i => i.id === selectedItemIdForTally)
    if (!item || !item.actual_footage) {
      toast.error('No actual footage set for this item')
      return
    }

    // Warn if tallies don't match actual footage, but allow saving
    const totalTallied = tallies.reduce((sum, t) => sum + t.tally_board_feet, 0)
    if (Math.abs(totalTallied - item.actual_footage) > 0.01) {
      const diff = totalTallied - item.actual_footage
      toast.warning(`⚠️ Warning: Pack tallies (${totalTallied.toLocaleString()} BF) don't match actual footage (${item.actual_footage.toLocaleString()} BF). Difference: ${diff.toFixed(2)} BF. Saving anyway...`)
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
      
      // Thickness filter
      const matchesThickness = thicknessFilter === 'all' || 
        load.items?.some(item => item.thickness === thicknessFilter)
      
      return matchesSearch && matchesSupplier && matchesSpecies && matchesGrade && matchesThickness
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
  const totalBF = packs.reduce((sum, p) => sum + Number(p.tally_board_feet || p.actual_board_feet || 0), 0)
  const finishedBF = packs.filter(p => p.is_finished).reduce((sum, p) => sum + Number(p.tally_board_feet || p.actual_board_feet || 0), 0)
  const remainingBF = totalBF - finishedBF
  const avgLength = packs.length > 0 ? packs.reduce((sum, p) => sum + Number(p.length || 0), 0) / packs.length : 0

  // Group packs by length for the remaining display
  const remainingByLength = packs.filter(p => !p.is_finished).reduce((acc, pack) => {
    const len = Number(pack.length || 0)
    acc[len] = (acc[len] || 0) + Number(pack.tally_board_feet || pack.actual_board_feet || 0)
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
          
          {/* Thickness Quick Filter Buttons */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-600">Thickness:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setThicknessFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  thicknessFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setThicknessFilter('4/4')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  thicknessFilter === '4/4'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                4/4
              </button>
              <button
                onClick={() => setThicknessFilter('5/4')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  thicknessFilter === '5/4'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                5/4
              </button>
              <button
                onClick={() => setThicknessFilter('6/4')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  thicknessFilter === '6/4'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                6/4
              </button>
              <button
                onClick={() => setThicknessFilter('8/4')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  thicknessFilter === '8/4'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                8/4
              </button>
            </div>
          </div>

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
                {filteredLoads.map((load: any) => {
                  // Check if load has tallies by comparing total vs current footage
                  const hasTallies = load.total_footage && load.total_footage > 0
                  const bgColor = hasTallies 
                    ? 'bg-green-50 hover:bg-green-100' 
                    : 'bg-gray-100 hover:bg-gray-200'
                  
                  return (
                    <tr
                      key={load.id}
                      className={`cursor-pointer border-t ${bgColor}`}
                      onClick={() => handleSelectLoad(load.id)}
                    >
                      <td className="px-2 py-1">{load.load_id}</td>
                      <td className="px-2 py-1">{load.supplier_name}</td>
                      <td className="px-2 py-1">
                        {load.items?.map((i: any) => i.species).join(', ')}
                      </td>
                      <td className="px-2 py-1">
                        {load.items?.map((i: any) => i.grade).join(', ')}
                      </td>
                      <td className="px-2 py-1">
                        {load.total_footage?.toLocaleString() || '0'}
                      </td>
                      <td className="px-2 py-1 font-bold">
                        {load.current_footage?.toLocaleString() || '0'}
                      </td>
                      <td className="px-2 py-1">
                        {load.actual_arrival_date 
                          ? new Date(load.actual_arrival_date).toLocaleDateString('en-US', { timeZone: 'UTC' })
                          : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Edit Pack Data - Full Width when load selected */
        <div className="bg-white rounded shadow p-4 space-y-4">
          {selectedLoad && (
            <>
              {/* Load Header with Better Organization */}
              <div className="flex justify-between items-start border-b pb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-900">
                      Load {selectedLoad.load_id}
                    </h2>
                    <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {Math.round(remainingBF).toLocaleString()} ft remaining
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Supplier:</span>
                      <span className="ml-2 font-medium">{selectedLoad.supplier_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <span className="ml-2 font-medium">{Math.round(totalBF).toLocaleString()} ft</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Wood:</span>
                      <span className="ml-2 font-medium">
                        {selectedLoad.items.map((item, idx) => (
                          <span key={idx}>{idx > 0 ? ', ' : ''}{item.species} - {item.grade}</span>
                        ))}
                      </span>
                    </div>
                    {selectedLoad.actual_arrival_date && (
                      <div>
                        <span className="text-gray-500">Arrival:</span>
                        <span className="ml-2 font-medium">
                          {new Date(selectedLoad.actual_arrival_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Complete Load Button */}
                <Button
                  onClick={handleMarkLoadComplete}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2"
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

              {/* Operator/Stacker Selection - Compact Layout */}
              <div className="bg-gray-50 p-2 rounded">
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Team Assignment</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs mb-1">Operator</Label>
                    <Select value={operatorId} onValueChange={(val) => setOperatorId(val === '__clear__' ? '' : val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__" className="text-gray-400 italic">
                          Clear selection
                        </SelectItem>
                        {operators.map(operator => (
                          <SelectItem key={operator.id} value={operator.id.toString()}>
                            {operator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Stacker 1</Label>
                    <Select value={stacker1Id} onValueChange={(val) => setStacker1Id(val === '__clear__' ? '' : val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__" className="text-gray-400 italic">
                          Clear selection
                        </SelectItem>
                        {operators.map(operator => (
                          <SelectItem key={operator.id} value={operator.id.toString()}>
                            {operator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Stacker 2</Label>
                    <Select value={stacker2Id} onValueChange={(val) => setStacker2Id(val === '__clear__' ? '' : val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__" className="text-gray-400 italic">
                          Clear selection
                        </SelectItem>
                        {operators.map(operator => (
                          <SelectItem key={operator.id} value={operator.id.toString()}>
                            {operator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Stacker 3</Label>
                    <Select value={stacker3Id} onValueChange={(val) => setStacker3Id(val === '__clear__' ? '' : val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__" className="text-gray-400 italic">
                          Clear selection
                        </SelectItem>
                        {operators.map(operator => (
                          <SelectItem key={operator.id} value={operator.id.toString()}>
                            {operator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Stacker 4</Label>
                    <Select value={stacker4Id} onValueChange={(val) => setStacker4Id(val === '__clear__' ? '' : val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__" className="text-gray-400 italic">
                          Clear selection
                        </SelectItem>
                        {operators.map(operator => (
                          <SelectItem key={operator.id} value={operator.id.toString()}>
                            {operator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Quality (0-100)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={loadQuality}
                      onChange={(e) => setLoadQuality(e.target.value)}
                      onBlur={handleSaveLoadQuality}
                      className="h-8 text-xs"
                      placeholder="0-100"
                    />
                  </div>
                </div>
              </div>

              {/* Pack Tables - Always show, with Add Pack button for creating new tallies */}
              <div className="grid grid-cols-2 gap-3">
                  {/* Pack Info */}
                  <div>
                    <div className="flex justify-between items-center h-6 mb-1">
                      <h3 className="text-xs font-semibold">Pack Information</h3>
                      <Button onClick={handleAddPack} size="sm" className="h-5 px-2 text-xs" variant="outline">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Pack
                      </Button>
                    </div>
                    <div className="border rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1 text-left w-24">Pack ID</th>
                            <th className="px-2 py-1 text-left w-24">Lth</th>
                            <th className="px-2 py-1 text-left w-24">Brd Ft</th>
                            <th className="px-2 py-1 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {packs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-2 py-4 text-center text-gray-500 text-xs">
                                No packs yet. Click "Add Pack" to create tallies.
                              </td>
                            </tr>
                          ) : (
                            packs.map(pack => (
                              <tr key={pack.id} className={pack.is_finished ? 'bg-green-50' : ''}>
                                <td className="px-1 py-1 border-t">
                                  <Input
                                    type="text"
                                    value={pack.is_finished ? (pack.pack_id ?? '') : (packEdits[pack.id]?.pack_id ?? pack.pack_id ?? '')}
                                    onChange={(e) => handlePackEdit(pack.id, 'pack_id', e.target.value || null)}
                                    onBlur={() => handleSavePack(pack.id)}
                                    disabled={pack.is_finished}
                                    className="h-6 text-xs disabled:opacity-100 disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-1 py-1 border-t">
                                  <Input
                                    type="number"
                                    value={pack.is_finished ? (pack.length != null ? Math.round(pack.length) : '') : (packEdits[pack.id]?.length ?? (pack.length != null ? Math.round(pack.length) : ''))}
                                    onChange={(e) => handlePackEdit(pack.id, 'length', e.target.value ? parseInt(e.target.value) : null)}
                                    onBlur={() => handleSavePack(pack.id)}
                                    disabled={pack.is_finished}
                                    className="h-6 text-xs disabled:opacity-100 disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-1 py-1 border-t">
                                  <Input
                                    type="number"
                                    value={pack.is_finished ? (pack.tally_board_feet != null ? Math.round(pack.tally_board_feet) : '') : (packEdits[pack.id]?.tally_board_feet ?? (pack.tally_board_feet != null ? Math.round(pack.tally_board_feet) : ''))}
                                    onChange={(e) => handlePackEdit(pack.id, 'tally_board_feet', e.target.value ? parseInt(e.target.value) : null)}
                                    onBlur={() => handleSavePack(pack.id)}
                                    disabled={pack.is_finished}
                                    className="h-6 text-xs disabled:opacity-100 disabled:cursor-not-allowed"
                                  />
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
                            ))
                          )}
                          <tr className="bg-gray-100 font-semibold">
                            <td className="px-2 py-1">{totalPacks} Packs</td>
                            <td className="px-2 py-1">{Math.round(avgLength)}</td>
                            <td className="px-2 py-1" colSpan={2}>{Math.round(totalBF).toLocaleString()} BF</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                {/* Rip Yield & Comments */}
                <div>
                  <div className="h-6 mb-1 flex items-center">
                    <h3 className="text-xs font-semibold">Rip Yield & Comments</h3>
                  </div>
                  <div className="border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left w-24">Act Ft</th>
                          <th className="px-2 py-1 text-left w-24">Rip Yield</th>
                          <th className="px-2 py-1 text-left w-24">Comments</th>
                          <th className="px-2 py-1 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {packs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-4 text-center text-gray-500 text-xs">
                              No packs yet.
                            </td>
                          </tr>
                        ) : (
                          packs.map(pack => (
                            <tr key={pack.id} className={pack.is_finished ? 'bg-green-50' : ''}>
                              <td className="px-1 py-1 border-t">
                                <Input
                                  type="number"
                                  value={pack.is_finished ? (pack.actual_board_feet || '') : (packEdits[pack.id]?.actual_board_feet || '')}
                                  onChange={(e) => handlePackEdit(pack.id, 'actual_board_feet', parseInt(e.target.value) || null)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  disabled={pack.is_finished}
                                  className="h-6 text-xs px-1 disabled:opacity-100 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-1 py-1 border-t">
                                <Input
                                  type="number"
                                  value={pack.is_finished ? (pack.rip_yield || '') : (packEdits[pack.id]?.rip_yield || '')}
                                  onChange={(e) => handlePackEdit(pack.id, 'rip_yield', parseInt(e.target.value) || null)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  disabled={pack.is_finished}
                                  className="h-6 text-xs px-1 disabled:opacity-100 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-1 py-1 border-t">
                                <Input
                                  value={pack.is_finished ? (pack.rip_comments || '') : (packEdits[pack.id]?.rip_comments || '')}
                                  onChange={(e) => handlePackEdit(pack.id, 'rip_comments', e.target.value)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  disabled={pack.is_finished}
                                  className="h-6 text-xs px-1 disabled:opacity-100 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-1 py-1 border-t">
                                {!pack.is_finished ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleFinishPack(pack.id)}
                                      className="h-6 px-2 text-xs"
                                      disabled={!packEdits[pack.id]?.actual_board_feet || !packEdits[pack.id]?.rip_yield}
                                      title="Finish pack"
                                    >
                                      <RefreshCcw className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handlePartialFinish(pack.id)}
                                      className="h-6 px-2 text-xs"
                                      disabled={!packEdits[pack.id]?.actual_board_feet}
                                      title="Partial finish - split pack"
                                    >
                                      <Scissors className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenEditPack(pack)}
                                    className="h-6 px-2 text-xs"
                                    title="Edit finished pack"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
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

      {/* Edit Pack Dialog */}
      <Dialog open={editPackDialogOpen} onOpenChange={setEditPackDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Pack</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Tally Information */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Pack Information (Tally)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Pack ID</Label>
                  <Input
                    value={editPackData.pack_id}
                    onChange={(e) => setEditPackData(prev => ({ ...prev, pack_id: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Length (ft)</Label>
                  <Input
                    type="number"
                    value={editPackData.length}
                    onChange={(e) => setEditPackData(prev => ({ ...prev, length: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tally BF</Label>
                  <Input
                    type="number"
                    value={editPackData.tally_board_feet}
                    onChange={(e) => setEditPackData(prev => ({ ...prev, tally_board_feet: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Rip Information */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Rip Information</h3>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Actual BF</Label>
                  <Input
                    type="number"
                    value={editPackData.actual_board_feet}
                    onChange={(e) => setEditPackData(prev => ({ ...prev, actual_board_feet: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Rip Yield %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editPackData.rip_yield}
                    onChange={(e) => setEditPackData(prev => ({ ...prev, rip_yield: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Finish Date</Label>
                  <Input
                    type="date"
                    value={editPackData.finished_at}
                    onChange={(e) => setEditPackData(prev => ({ ...prev, finished_at: e.target.value }))}
                  />
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={editPackData.is_finished}
                      onCheckedChange={(checked) => setEditPackData(prev => ({ ...prev, is_finished: checked as boolean }))}
                    />
                    <Label className="text-xs">Finished</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Operator & Stackers */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Operator & Stackers</h3>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select 
                    value={editPackData.operator_id || 'none'} 
                    onValueChange={(val) => setEditPackData(prev => ({ ...prev, operator_id: val === 'none' ? '' : val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {operators.map(op => (
                        <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 1</Label>
                  <Select 
                    value={editPackData.stacker_1_id || 'none'} 
                    onValueChange={(val) => setEditPackData(prev => ({ ...prev, stacker_1_id: val === 'none' ? '' : val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {operators.map(op => (
                        <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 2</Label>
                  <Select 
                    value={editPackData.stacker_2_id || 'none'} 
                    onValueChange={(val) => setEditPackData(prev => ({ ...prev, stacker_2_id: val === 'none' ? '' : val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {operators.map(op => (
                        <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 3</Label>
                  <Select 
                    value={editPackData.stacker_3_id || 'none'} 
                    onValueChange={(val) => setEditPackData(prev => ({ ...prev, stacker_3_id: val === 'none' ? '' : val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {operators.map(op => (
                        <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 4</Label>
                  <Select 
                    value={editPackData.stacker_4_id || 'none'} 
                    onValueChange={(val) => setEditPackData(prev => ({ ...prev, stacker_4_id: val === 'none' ? '' : val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {operators.map(op => (
                        <SelectItem key={op.id} value={op.id.toString()}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Comments */}
            <div>
              <Label className="text-xs">Comments</Label>
              <Textarea
                value={editPackData.rip_comments}
                onChange={(e) => setEditPackData(prev => ({ ...prev, rip_comments: e.target.value }))}
                rows={2}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditPackDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEditPack}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
