'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { InventoryGroup, InventoryLoadDetail, LumberLoadWithDetails, LumberPackWithDetails } from '@/types/lumber'
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
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Truck, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'

export default function OverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([])
  const [allInventoryLoads, setAllInventoryLoads] = useState<InventoryLoadDetail[]>([])
  const [incomingLoads, setIncomingLoads] = useState<any[]>([])
  const [assignedLoads, setAssignedLoads] = useState<LumberLoadWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [speciesColors, setSpeciesColors] = useState<Record<string, string>>({})
  
  // Inventory expansion state (thickness → species → grade → loads)
  const [expandedInventoryThicknesses, setExpandedInventoryThicknesses] = useState<Set<string>>(new Set(['4/4']))
  const [expandedInventorySpecies, setExpandedInventorySpecies] = useState<Set<string>>(new Set())
  const [expandedInventoryGrades, setExpandedInventoryGrades] = useState<Set<string>>(new Set())
  
  // Incoming expansion state (thickness → species → grade)
  const [expandedIncomingThicknesses, setExpandedIncomingThicknesses] = useState<Set<string>>(new Set(['4/4']))
  const [expandedIncomingSpecies, setExpandedIncomingSpecies] = useState<Set<string>>(new Set())
  
  // Inventory Loads List state
  const [inventoryLoadsSearch, setInventoryLoadsSearch] = useState('')
  const [inventoryLoadsSpecies, setInventoryLoadsSpecies] = useState('all')
  const [inventoryLoadsGrade, setInventoryLoadsGrade] = useState('all')
  const [inventoryLoadsThickness, setInventoryLoadsThickness] = useState('all')
  const [inventoryLoadsSortColumn, setInventoryLoadsSortColumn] = useState<string>('load_id')
  const [inventoryLoadsSortDirection, setInventoryLoadsSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Incoming Loads Dialog state
  const [incomingLoadsDialogOpen, setIncomingLoadsDialogOpen] = useState(false)
  const [selectedIncomingGrade, setSelectedIncomingGrade] = useState<{
    thickness: string
    species: string
    grade: string
    loads: any[]
  } | null>(null)
  
  // Rip Entry Dialog state
  const [ripEntryDialogOpen, setRipEntryDialogOpen] = useState(false)
  const [selectedLoadForRip, setSelectedLoadForRip] = useState<any>(null)
  const [ripEntryPacks, setRipEntryPacks] = useState<LumberPackWithDetails[]>([])
  const [isLoadingPacks, setIsLoadingPacks] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/overview')
    }
  }, [status, router])

  async function fetchData() {
    try {
      const [inventoryRes, incomingRes, truckingRes, speciesRes] = await Promise.all([
        fetch('/api/lumber/inventory'),
        fetch('/api/lumber/loads/incoming'),
        fetch('/api/lumber/loads/for-trucking'),
        fetch('/api/lumber/species')
      ])

      // Process inventory data - group by species, grade, thickness
      if (inventoryRes.ok) {
        const loadDetails: InventoryLoadDetail[] = await inventoryRes.json()
        
        // Store raw loads for the Inventory Loads list
        setAllInventoryLoads(loadDetails)
        
        const grouped: Record<string, InventoryGroup> = {}
        
        loadDetails.forEach(load => {
          const key = `${load.species}|${load.grade}|${load.thickness}`
          
          if (!grouped[key]) {
            grouped[key] = {
              species: load.species,
              grade: load.grade,
              thickness: load.thickness,
              total_actual_footage: 0,
              total_finished_footage: 0,
              current_inventory: 0,
              load_count: 0,
              loads: [],
              average_price: null,
              total_price_weighted: 0,
              total_footage_with_price: 0,
              total_value: 0
            }
          }
          
          const actualFootage = Number(load.actual_footage) || 0
          const loadInventory = Number(load.load_inventory) || 0
          const invoiceTotal = load.invoice_total ? Number(load.invoice_total) : null
          const price = load.price ? Number(load.price) : null
          
          grouped[key].total_actual_footage += actualFootage
          grouped[key].total_finished_footage += Number(load.finished_footage) || 0
          grouped[key].current_inventory += loadInventory
          grouped[key].load_count += 1
          grouped[key].loads.push(load)
          
          // Calculate value contribution for this load (same logic as inventory page)
          if (loadInventory > 0) {
            let effectivePrice: number | null = null
            
            if (invoiceTotal !== null && actualFootage > 0) {
              effectivePrice = invoiceTotal / actualFootage
              grouped[key].total_value += effectivePrice * loadInventory
            } else if (price !== null && price >= 0.30) {
              effectivePrice = price
              grouped[key].total_value += price * loadInventory
            }
            
            if (effectivePrice !== null && effectivePrice >= 0.30) {
              grouped[key].total_price_weighted += effectivePrice * actualFootage
              grouped[key].total_footage_with_price += actualFootage
            }
          }
        })
        
        // Calculate average prices for each group
        Object.values(grouped).forEach(group => {
          if (group.total_footage_with_price > 0) {
            group.average_price = group.total_price_weighted / group.total_footage_with_price
          }
        })
        
        setInventoryGroups(Object.values(grouped))
      }

      // Process incoming loads data
      if (incomingRes.ok) {
        const data = await incomingRes.json()
        setIncomingLoads(data)
      }

      // Get assigned loads (have driver AND pickup date)
      if (truckingRes.ok) {
        const truckingLoads = await truckingRes.json()
        const assigned = truckingLoads.filter((load: any) => load.driver_id && load.assigned_pickup_date)
        setAssignedLoads(assigned)
      }
      
      // Get species colors
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

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status])

  // Helper function to get thickness border color
  const getThicknessBorderColor = (thickness: string): string => {
    const colorMap: Record<string, string> = {
      '4/4': 'border-l-blue-500',
      '5/4': 'border-l-green-500',
      '6/4': 'border-l-purple-500',
      '7/4': 'border-l-orange-500',
      '8/4': 'border-l-red-500',
    }
    return colorMap[thickness] || 'border-l-gray-400'
  }

  // Process inventory data into thickness → species → grade hierarchy
  const inventoryByThickness = useMemo(() => {
    const thicknessGroups: Record<string, Record<string, Record<string, InventoryGroup[]>>> = {}
    
    inventoryGroups.forEach(group => {
      const thickness = group.thickness || 'Unknown'
      if (!thicknessGroups[thickness]) {
        thicknessGroups[thickness] = {}
      }
      if (!thicknessGroups[thickness][group.species]) {
        thicknessGroups[thickness][group.species] = {}
      }
      if (!thicknessGroups[thickness][group.species][group.grade]) {
        thicknessGroups[thickness][group.species][group.grade] = []
      }
      thicknessGroups[thickness][group.species][group.grade].push(group)
    })
    
    // Order thicknesses: 4/4, 5/4, 6/4, 7/4, 8/4, then others
    const thicknessOrder = ['4/4', '5/4', '6/4', '7/4', '8/4']
    const orderedThicknesses = Object.keys(thicknessGroups).sort((a, b) => {
      const aIndex = thicknessOrder.indexOf(a)
      const bIndex = thicknessOrder.indexOf(b)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.localeCompare(b)
    })
    
    return orderedThicknesses.map(thickness => {
      const speciesGroups = thicknessGroups[thickness]
      
      const speciesList = Object.entries(speciesGroups).map(([species, gradeGroups]) => {
        const grades = Object.entries(gradeGroups).map(([grade, groups]) => {
          const totals = groups.reduce((sum, g) => ({
            current_inventory: sum.current_inventory + g.current_inventory,
            load_count: sum.load_count + g.load_count,
            total_value: sum.total_value + g.total_value,
            total_price_weighted: sum.total_price_weighted + g.total_price_weighted,
            total_footage_with_price: sum.total_footage_with_price + g.total_footage_with_price,
          }), { current_inventory: 0, load_count: 0, total_value: 0, total_price_weighted: 0, total_footage_with_price: 0 })
          
          // Calculate pack count and loads with inventory
          let pack_count = 0
          let loads_with_inventory = 0
          const loadsWithInventory: InventoryLoadDetail[] = []
          groups.forEach(g => {
            g.loads.forEach(load => {
              if (load.load_inventory > 0) {
                loads_with_inventory += 1
                pack_count += Number(load.pack_count) || 0
                loadsWithInventory.push(load)
              }
            })
          })
          
          const average_price = totals.total_footage_with_price > 0
            ? totals.total_price_weighted / totals.total_footage_with_price
            : null
          
          return {
            grade,
            ...totals,
            average_price,
            pack_count,
            loads_with_inventory,
            loads: loadsWithInventory
          }
        }).sort((a, b) => a.grade.localeCompare(b.grade))
        
        // Calculate species totals
        const speciesTotals = grades.reduce((sum, g) => ({
          current_inventory: sum.current_inventory + g.current_inventory,
          load_count: sum.load_count + g.load_count,
          total_value: sum.total_value + g.total_value,
          pack_count: sum.pack_count + g.pack_count,
          loads_with_inventory: sum.loads_with_inventory + g.loads_with_inventory,
          total_price_weighted: sum.total_price_weighted + g.total_price_weighted,
          total_footage_with_price: sum.total_footage_with_price + g.total_footage_with_price,
        }), { current_inventory: 0, load_count: 0, total_value: 0, pack_count: 0, loads_with_inventory: 0, total_price_weighted: 0, total_footage_with_price: 0 })
        
        const speciesAvgPrice = speciesTotals.total_footage_with_price > 0
          ? speciesTotals.total_price_weighted / speciesTotals.total_footage_with_price
          : null
        
        return {
          species,
          grades,
          ...speciesTotals,
          average_price: speciesAvgPrice
        }
      }).sort((a, b) => a.species.localeCompare(b.species))
      
      // Calculate thickness totals
      const thicknessTotals = speciesList.reduce((sum, s) => ({
        current_inventory: sum.current_inventory + s.current_inventory,
        load_count: sum.load_count + s.load_count,
        total_value: sum.total_value + s.total_value,
        pack_count: sum.pack_count + s.pack_count,
        loads_with_inventory: sum.loads_with_inventory + s.loads_with_inventory,
        total_price_weighted: sum.total_price_weighted + s.total_price_weighted,
        total_footage_with_price: sum.total_footage_with_price + s.total_footage_with_price,
      }), { current_inventory: 0, load_count: 0, total_value: 0, pack_count: 0, loads_with_inventory: 0, total_price_weighted: 0, total_footage_with_price: 0 })
      
      const thicknessAvgPrice = thicknessTotals.total_footage_with_price > 0
        ? thicknessTotals.total_price_weighted / thicknessTotals.total_footage_with_price
        : null
      
      return {
        thickness,
        species: speciesList,
        ...thicknessTotals,
        average_price: thicknessAvgPrice
      }
    })
  }, [inventoryGroups])

  // Process incoming loads into thickness → species → grade hierarchy
  const incomingByThickness = useMemo(() => {
    const thicknessGroups: Record<string, Record<string, Record<string, any[]>>> = {}
    
    incomingLoads.forEach((load: any) => {
      load.items?.forEach((item: any) => {
        // Only count items that don't have actual footage yet (truly incoming)
        if (item.actual_footage) return
        
        const thickness = item.thickness || 'Unknown'
        const species = item.species || 'Unknown'
        const grade = item.grade || 'Unknown'
        
        if (!thicknessGroups[thickness]) {
          thicknessGroups[thickness] = {}
        }
        if (!thicknessGroups[thickness][species]) {
          thicknessGroups[thickness][species] = {}
        }
        if (!thicknessGroups[thickness][species][grade]) {
          thicknessGroups[thickness][species][grade] = []
        }
        
        thicknessGroups[thickness][species][grade].push({
          load_id: load.load_id,
          load_db_id: load.id,
          supplier_name: load.supplier_name,
          estimated_footage: item.estimated_footage,
          estimated_delivery_date: load.estimated_delivery_date,
          driver_name: load.driver_name,
          assigned_pickup_date: load.assigned_pickup_date,
          pickup_number: load.pickup_number,
          species: item.species,
          grade: item.grade,
          thickness: item.thickness
        })
      })
    })
    
    // Order thicknesses: 4/4, 5/4, 6/4, 7/4, 8/4, then others
    const thicknessOrder = ['4/4', '5/4', '6/4', '7/4', '8/4']
    const orderedThicknesses = Object.keys(thicknessGroups).sort((a, b) => {
      const aIndex = thicknessOrder.indexOf(a)
      const bIndex = thicknessOrder.indexOf(b)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.localeCompare(b)
    })
    
    return orderedThicknesses.map(thickness => {
      const speciesGroups = thicknessGroups[thickness]
      
      const speciesList = Object.entries(speciesGroups).map(([species, gradeGroups]) => {
        const grades = Object.entries(gradeGroups).map(([grade, loads]) => {
          const totalEstBF = loads.reduce((sum, l) => sum + (Number(l.estimated_footage) || 0), 0)
          return {
            grade,
            loads,
            load_count: loads.length,
            estimated_bf: totalEstBF
          }
        }).sort((a, b) => a.grade.localeCompare(b.grade))
        
        const speciesTotals = grades.reduce((sum, g) => ({
          load_count: sum.load_count + g.load_count,
          estimated_bf: sum.estimated_bf + g.estimated_bf
        }), { load_count: 0, estimated_bf: 0 })
        
        return {
          species,
          grades,
          ...speciesTotals
        }
      }).sort((a, b) => a.species.localeCompare(b.species))
      
      const thicknessTotals = speciesList.reduce((sum, s) => ({
        load_count: sum.load_count + s.load_count,
        estimated_bf: sum.estimated_bf + s.estimated_bf
      }), { load_count: 0, estimated_bf: 0 })
      
      return {
        thickness,
        species: speciesList,
        ...thicknessTotals
      }
    })
  }, [incomingLoads])

  // Calculate totals
  const totalIncoming = incomingByThickness.reduce((sum, t) => sum + t.estimated_bf, 0)
  const totalInventory = inventoryByThickness.reduce((sum, t) => sum + t.current_inventory, 0)
  const totalIncomingLoads = incomingByThickness.reduce((sum, t) => sum + t.load_count, 0)
  const totalInventoryLoads = inventoryByThickness.reduce((sum, t) => sum + t.loads_with_inventory, 0)

  // Get unique values for inventory loads filters
  const inventoryLoadsFilterOptions = useMemo(() => {
    const species = Array.from(new Set(allInventoryLoads.map(l => l.species))).sort()
    const grades = Array.from(new Set(allInventoryLoads.map(l => l.grade))).sort()
    const thicknesses = Array.from(new Set(allInventoryLoads.map(l => l.thickness))).sort()
    return { species, grades, thicknesses }
  }, [allInventoryLoads])

  // Filter and sort inventory loads
  const filteredInventoryLoads = useMemo(() => {
    let filtered = [...allInventoryLoads]

    // Apply search filter
    if (inventoryLoadsSearch) {
      const search = inventoryLoadsSearch.toLowerCase()
      filtered = filtered.filter(load =>
        load.load_id?.toLowerCase().includes(search) ||
        load.species?.toLowerCase().includes(search) ||
        load.grade?.toLowerCase().includes(search) ||
        load.thickness?.toLowerCase().includes(search)
      )
    }

    // Apply species filter
    if (inventoryLoadsSpecies !== 'all') {
      filtered = filtered.filter(load => load.species === inventoryLoadsSpecies)
    }

    // Apply grade filter
    if (inventoryLoadsGrade !== 'all') {
      filtered = filtered.filter(load => load.grade === inventoryLoadsGrade)
    }

    // Apply thickness filter
    if (inventoryLoadsThickness !== 'all') {
      filtered = filtered.filter(load => load.thickness === inventoryLoadsThickness)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (inventoryLoadsSortColumn) {
        case 'load_id':
          aVal = parseInt(a.load_id) || 0
          bVal = parseInt(b.load_id) || 0
          break
        case 'species':
          aVal = a.species || ''
          bVal = b.species || ''
          break
        case 'grade':
          aVal = a.grade || ''
          bVal = b.grade || ''
          break
        case 'thickness':
          aVal = a.thickness || ''
          bVal = b.thickness || ''
          break
        case 'actual_footage':
          aVal = Number(a.actual_footage) || 0
          bVal = Number(b.actual_footage) || 0
          break
        case 'load_inventory':
          aVal = Number(a.load_inventory) || 0
          bVal = Number(b.load_inventory) || 0
          break
        case 'price':
          aVal = Number(a.price) || 0
          bVal = Number(b.price) || 0
          break
        default:
          aVal = a.load_id
          bVal = b.load_id
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return inventoryLoadsSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return inventoryLoadsSortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })

    return filtered
  }, [allInventoryLoads, inventoryLoadsSearch, inventoryLoadsSpecies, inventoryLoadsGrade, inventoryLoadsThickness, inventoryLoadsSortColumn, inventoryLoadsSortDirection])

  // Inventory loads helper functions
  function handleInventoryLoadsSort(column: string) {
    if (inventoryLoadsSortColumn === column) {
      setInventoryLoadsSortDirection(inventoryLoadsSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setInventoryLoadsSortColumn(column)
      setInventoryLoadsSortDirection('asc')
    }
  }

  function getInventoryLoadsSortIcon(column: string) {
    if (inventoryLoadsSortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    return inventoryLoadsSortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  function clearInventoryLoadsFilters() {
    setInventoryLoadsSearch('')
    setInventoryLoadsSpecies('all')
    setInventoryLoadsGrade('all')
    setInventoryLoadsThickness('all')
  }

  const hasInventoryLoadsFilters = inventoryLoadsSearch || inventoryLoadsSpecies !== 'all' || inventoryLoadsGrade !== 'all' || inventoryLoadsThickness !== 'all'

  // Toggle functions for inventory
  function toggleInventoryThickness(thickness: string) {
    const newExpanded = new Set(expandedInventoryThicknesses)
    if (newExpanded.has(thickness)) {
      newExpanded.delete(thickness)
    } else {
      newExpanded.add(thickness)
    }
    setExpandedInventoryThicknesses(newExpanded)
  }

  function toggleInventorySpecies(key: string) {
    const newExpanded = new Set(expandedInventorySpecies)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedInventorySpecies(newExpanded)
  }

  function toggleInventoryGrade(key: string) {
    const newExpanded = new Set(expandedInventoryGrades)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedInventoryGrades(newExpanded)
  }

  // Toggle functions for incoming
  function toggleIncomingThickness(thickness: string) {
    const newExpanded = new Set(expandedIncomingThicknesses)
    if (newExpanded.has(thickness)) {
      newExpanded.delete(thickness)
    } else {
      newExpanded.add(thickness)
    }
    setExpandedIncomingThicknesses(newExpanded)
  }

  function toggleIncomingSpecies(key: string) {
    const newExpanded = new Set(expandedIncomingSpecies)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedIncomingSpecies(newExpanded)
  }

  // Open incoming loads dialog
  function openIncomingLoadsDialog(thickness: string, species: string, grade: string, loads: any[]) {
    setSelectedIncomingGrade({ thickness, species, grade, loads })
    setIncomingLoadsDialogOpen(true)
  }

  // View rip entry for a load
  async function handleViewRipEntry(load: any) {
    setSelectedLoadForRip(load)
    setRipEntryDialogOpen(true)
    setIsLoadingPacks(true)
    
    try {
      const loadDbId = load.load_db_id || load.id
      if (loadDbId) {
        const packsRes = await fetch(`/api/lumber/packs/by-load/${loadDbId}`)
        if (packsRes.ok) {
          const packsData = await packsRes.json()
          setRipEntryPacks(packsData)
        }
      } else {
        // Try to find by load_id string
        const loadRes = await fetch(`/api/lumber/loads/by-load-id/${load.load_id}`)
        if (loadRes.ok) {
          const loadData = await loadRes.json()
          if (loadData && loadData.id) {
            const packsRes = await fetch(`/api/lumber/packs/by-load/${loadData.id}`)
            if (packsRes.ok) {
              const packsData = await packsRes.json()
              setRipEntryPacks(packsData)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching rip entry data:', error)
    } finally {
      setIsLoadingPacks(false)
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
        <h1 className="text-3xl font-bold text-gray-900">Lumber Overview</h1>
        <p className="text-gray-600 mt-1">Incoming footage, current inventory, and scheduled pickups</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-800 font-medium">Incoming (Estimated)</div>
          <div className="text-2xl font-bold text-yellow-900">{totalIncoming.toLocaleString()} BF</div>
          <div className="text-xs text-yellow-600">{totalIncomingLoads} loads</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800 font-medium">Current Inventory</div>
          <div className="text-2xl font-bold text-blue-900">{totalInventory.toLocaleString()} BF</div>
          <div className="text-xs text-blue-600">{totalInventoryLoads} loads</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-800 font-medium">Scheduled Pickups</div>
          <div className="text-2xl font-bold text-green-900">{assignedLoads.length} loads</div>
          <div className="text-xs text-green-600">Assigned to drivers</div>
        </div>
      </div>

      {/* Row 1: Incoming Footage and Scheduled Pickups */}
      <div className="grid grid-cols-2 gap-4">
        {/* Incoming Footage Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 bg-yellow-600 text-white">
            <h2 className="text-sm font-semibold">Incoming Footage (Estimated)</h2>
            <p className="text-[10px] text-yellow-100 mt-0.5">
              Loads not yet arrived - by thickness, species, grade
            </p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Thick</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Species / Grade</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Loads</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Est. BF</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {incomingByThickness.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                      No incoming loads
                    </td>
                  </tr>
                ) : (
                  incomingByThickness.map((thicknessData) => {
                    const isThicknessExpanded = expandedIncomingThicknesses.has(thicknessData.thickness)
                    
                    return (
                      <React.Fragment key={`incoming-${thicknessData.thickness}`}>
                        {/* Thickness Row */}
                        <tr 
                          className="bg-yellow-100 hover:bg-yellow-200 cursor-pointer"
                          onClick={() => toggleIncomingThickness(thicknessData.thickness)}
                        >
                          <td className="px-2 py-2">
                            <button className="text-yellow-700 hover:text-yellow-900">
                              {isThicknessExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-yellow-900">
                            {thicknessData.thickness}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-yellow-700 italic">
                            All Species
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-yellow-900 text-right">
                            {thicknessData.load_count}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-yellow-900 text-right">
                            {thicknessData.estimated_bf.toLocaleString()}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-yellow-700">
                            -
                          </td>
                        </tr>
                        
                        {/* Species Rows */}
                        {isThicknessExpanded && thicknessData.species.map((speciesData) => {
                          const speciesKey = `incoming-${thicknessData.thickness}-${speciesData.species}`
                          const isSpeciesExpanded = expandedIncomingSpecies.has(speciesKey)
                          
                          return (
                            <React.Fragment key={speciesKey}>
                              {/* Species Row */}
                              <tr 
                                className="bg-yellow-50 hover:bg-yellow-100 cursor-pointer"
                                onClick={() => toggleIncomingSpecies(speciesKey)}
                              >
                                <td className="px-2 py-1.5 pl-6">
                                  <button className="text-yellow-600 hover:text-yellow-800">
                                    {isSpeciesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  </button>
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-500">
                                  {thicknessData.thickness}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-gray-400">└</span>
                                    <span 
                                      className="w-2.5 h-2.5 rounded flex-shrink-0" 
                                      style={{ backgroundColor: speciesColors[speciesData.species] || '#6B7280' }}
                                    />
                                    <span className="font-semibold">{speciesData.species}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-yellow-700 text-right">
                                  {speciesData.load_count}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-yellow-700 text-right">
                                  {speciesData.estimated_bf.toLocaleString()}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-yellow-600">
                                  -
                                </td>
                              </tr>
                              
                              {/* Grade Rows */}
                              {isSpeciesExpanded && speciesData.grades.map((gradeData) => {
                                // Find earliest ETA from loads in this grade
                                const earliestEta = gradeData.loads
                                  .filter((l: any) => l.estimated_delivery_date)
                                  .map((l: any) => new Date(l.estimated_delivery_date))
                                  .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0]
                                
                                return (
                                  <tr 
                                    key={`${speciesKey}-${gradeData.grade}`}
                                    className="bg-white hover:bg-yellow-50 cursor-pointer"
                                    onClick={() => openIncomingLoadsDialog(thicknessData.thickness, speciesData.species, gradeData.grade, gradeData.loads)}
                                  >
                                    <td className="px-2 py-1.5 pl-10"></td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-400">
                                      {thicknessData.thickness}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                                      <div className="flex items-center gap-1.5 pl-4">
                                        <span className="text-gray-300">└</span>
                                        <span className="font-medium">{gradeData.grade}</span>
                                        <Eye className="h-3 w-3 text-gray-400" />
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-yellow-600 text-right">
                                      {gradeData.load_count}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-yellow-600 text-right">
                                      {gradeData.estimated_bf.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-yellow-600">
                                      {earliestEta 
                                        ? earliestEta.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
                                        : '-'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scheduled Pickups Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 bg-green-600 text-white flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold">Scheduled Pickups</h2>
              <p className="text-[10px] text-green-100 mt-0.5">
                Loads assigned to a driver with pickup date
              </p>
            </div>
            <div className="flex items-center gap-1 text-green-100">
              <Truck className="h-4 w-4" />
              <span className="text-sm font-semibold">{assignedLoads.length}</span>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Load</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Supplier</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Est. BF</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Driver</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Pickup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignedLoads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                      No loads currently assigned to drivers
                    </td>
                  </tr>
                ) : (
                  assignedLoads.map((load, idx) => (
                    <tr key={load.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold">{load.load_id}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        <div>{load.supplier_name}</div>
                        <div className="text-[10px] text-gray-500">
                          {load.items?.map((item: any) => `${item.species} ${item.grade}`).join(', ') || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-right">
                        {load.items?.reduce((sum: number, item: any) => sum + (item.estimated_footage || 0), 0).toLocaleString() || '-'}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium text-green-700">
                        {load.driver_name || '-'}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        {load.assigned_pickup_date 
                          ? new Date(load.assigned_pickup_date).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 2: Current Inventory and Inventory Loads */}
      <div className="grid grid-cols-2 gap-4">
        {/* Inventory Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 bg-gray-800 text-white">
            <h2 className="text-sm font-semibold">Current Inventory</h2>
            <p className="text-[10px] text-gray-300 mt-0.5">
              Actual BF arrived - by thickness, species, grade
            </p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Thick</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Species / Grade</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Loads</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Packs</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Avg $</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Inv BF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventoryByThickness.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                      No inventory data
                    </td>
                  </tr>
                ) : (
                  inventoryByThickness.map((thicknessData) => {
                    const isThicknessExpanded = expandedInventoryThicknesses.has(thicknessData.thickness)
                    
                    return (
                      <React.Fragment key={`inventory-${thicknessData.thickness}`}>
                        {/* Thickness Row */}
                        <tr 
                          className={`bg-gray-100 hover:bg-gray-200 cursor-pointer border-l-4 ${getThicknessBorderColor(thicknessData.thickness)}`}
                          onClick={() => toggleInventoryThickness(thicknessData.thickness)}
                        >
                          <td className="px-2 py-2">
                            <button className="text-gray-600 hover:text-gray-900">
                              {isThicknessExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-gray-900">
                            {thicknessData.thickness}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 italic">
                            All Species
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-gray-700 text-right">
                            {thicknessData.loads_with_inventory}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-gray-700 text-right">
                            {thicknessData.pack_count}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-semibold text-green-600 text-right">
                            {thicknessData.average_price ? `$${thicknessData.average_price.toFixed(3)}` : '-'}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-blue-600 text-right">
                            {thicknessData.current_inventory.toLocaleString()}
                          </td>
                        </tr>
                        
                        {/* Species Rows */}
                        {isThicknessExpanded && thicknessData.species.map((speciesData) => {
                          const speciesKey = `inventory-${thicknessData.thickness}-${speciesData.species}`
                          const isSpeciesExpanded = expandedInventorySpecies.has(speciesKey)
                          
                          return (
                            <React.Fragment key={speciesKey}>
                              {/* Species Row */}
                              <tr 
                                className={`bg-gray-50 hover:bg-gray-100 cursor-pointer border-l-4 ${getThicknessBorderColor(thicknessData.thickness)}`}
                                onClick={() => toggleInventorySpecies(speciesKey)}
                              >
                                <td className="px-2 py-1.5 pl-6">
                                  <button className="text-gray-500 hover:text-gray-700">
                                    {isSpeciesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  </button>
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-500">
                                  {thicknessData.thickness}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-gray-400">└</span>
                                    <span 
                                      className="w-2.5 h-2.5 rounded flex-shrink-0" 
                                      style={{ backgroundColor: speciesColors[speciesData.species] || '#6B7280' }}
                                    />
                                    <span className="font-semibold">{speciesData.species}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-gray-700 text-right">
                                  {speciesData.loads_with_inventory}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-gray-700 text-right">
                                  {speciesData.pack_count}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-green-600 text-right">
                                  {speciesData.average_price ? `$${speciesData.average_price.toFixed(3)}` : '-'}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 text-right">
                                  {speciesData.current_inventory.toLocaleString()}
                                </td>
                              </tr>
                              
                              {/* Grade Rows */}
                              {isSpeciesExpanded && speciesData.grades.map((gradeData) => {
                                const gradeKey = `${speciesKey}-${gradeData.grade}`
                                const isGradeExpanded = expandedInventoryGrades.has(gradeKey)
                                
                                return (
                                  <React.Fragment key={gradeKey}>
                                    {/* Grade Row */}
                                    <tr 
                                      className={`bg-white hover:bg-gray-50 cursor-pointer border-l-4 ${getThicknessBorderColor(thicknessData.thickness)}`}
                                      onClick={() => toggleInventoryGrade(gradeKey)}
                                    >
                                      <td className="px-2 py-1.5 pl-10">
                                        <button className="text-gray-400 hover:text-gray-600">
                                          {isGradeExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </button>
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-400">
                                        {thicknessData.thickness}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                                        <div className="flex items-center gap-1.5 pl-4">
                                          <span className="text-gray-300">└</span>
                                          <span className="font-medium">{gradeData.grade}</span>
                                        </div>
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 text-right">
                                        {gradeData.loads_with_inventory}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 text-right">
                                        {gradeData.pack_count}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-green-600 text-right">
                                        {gradeData.average_price ? `$${gradeData.average_price.toFixed(3)}` : '-'}
                                      </td>
                                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-blue-600 text-right">
                                        {gradeData.current_inventory.toLocaleString()}
                                      </td>
                                    </tr>
                                    
                                    {/* Load Rows */}
                                    {isGradeExpanded && gradeData.loads.map((load, loadIdx) => (
                                      <tr 
                                        key={`${gradeKey}-${load.load_id}-${loadIdx}`}
                                        className={`bg-gray-50/50 border-t border-gray-100 border-l-4 ${getThicknessBorderColor(thicknessData.thickness)}`}
                                      >
                                        <td className="px-2 py-1.5"></td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-300">
                                          {thicknessData.thickness}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs pl-12">
                                          <div className="flex items-center gap-2">
                                            <span className="text-gray-300">└</span>
                                            <span className="text-gray-900 font-semibold">{load.load_id}</span>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleViewRipEntry(load); }}
                                              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                              title="View Rip Entry"
                                            >
                                              <Eye className="h-3 w-3" />
                                            </button>
                                          </div>
                                          <div className="text-[10px] text-gray-500 ml-5">
                                            {load.supplier_name}
                                          </div>
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-500 text-right">
                                          -
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600 text-right">
                                          {load.finished_pack_count}/{load.pack_count}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-green-600 text-right">
                                          {load.price ? `$${Number(load.price).toFixed(3)}` : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 text-right">
                                          {Number(load.load_inventory || 0).toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Loads Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 bg-blue-800 text-white">
            <h2 className="text-sm font-semibold">Inventory Loads</h2>
            <p className="text-[10px] text-blue-200 mt-0.5">
              All loads currently contributing to inventory
            </p>
          </div>
          
          {/* Filters */}
          <div className="p-3 border-b bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-700">Filters</h3>
              {hasInventoryLoadsFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearInventoryLoadsFilters}
                  className="h-6 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={inventoryLoadsSearch}
                  onChange={(e) => setInventoryLoadsSearch(e.target.value)}
                  className="pl-7 h-7 text-xs"
                />
              </div>

              {/* Species Filter */}
              <Select value={inventoryLoadsSpecies} onValueChange={setInventoryLoadsSpecies}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Species" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Species</SelectItem>
                  {inventoryLoadsFilterOptions.species.map(sp => (
                    <SelectItem key={sp} value={sp}>{sp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Grade Filter */}
              <Select value={inventoryLoadsGrade} onValueChange={setInventoryLoadsGrade}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {inventoryLoadsFilterOptions.grades.map(grade => (
                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Thickness Filter */}
              <Select value={inventoryLoadsThickness} onValueChange={setInventoryLoadsThickness}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Thick" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {inventoryLoadsFilterOptions.thicknesses.map(thickness => (
                    <SelectItem key={thickness} value={thickness}>{thickness}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasInventoryLoadsFilters && (
              <div className="text-xs text-gray-500">
                Showing {filteredInventoryLoads.length} of {allInventoryLoads.length} loads
              </div>
            )}
          </div>
          
          {/* Loads Table */}
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '400px' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-800 text-white sticky top-0 z-10">
                <tr>
                  <th 
                    className="px-2 py-1.5 text-left text-[10px] font-medium uppercase cursor-pointer hover:bg-gray-700"
                    onClick={() => handleInventoryLoadsSort('load_id')}
                  >
                    <div className="flex items-center">
                      Load {getInventoryLoadsSortIcon('load_id')}
                    </div>
                  </th>
                  <th 
                    className="px-2 py-1.5 text-left text-[10px] font-medium uppercase cursor-pointer hover:bg-gray-700"
                    onClick={() => handleInventoryLoadsSort('species')}
                  >
                    <div className="flex items-center">
                      Species {getInventoryLoadsSortIcon('species')}
                    </div>
                  </th>
                  <th 
                    className="px-2 py-1.5 text-left text-[10px] font-medium uppercase cursor-pointer hover:bg-gray-700"
                    onClick={() => handleInventoryLoadsSort('grade')}
                  >
                    <div className="flex items-center">
                      Grade {getInventoryLoadsSortIcon('grade')}
                    </div>
                  </th>
                  <th 
                    className="px-2 py-1.5 text-left text-[10px] font-medium uppercase cursor-pointer hover:bg-gray-700"
                    onClick={() => handleInventoryLoadsSort('thickness')}
                  >
                    <div className="flex items-center">
                      Thick {getInventoryLoadsSortIcon('thickness')}
                    </div>
                  </th>
                  <th 
                    className="px-2 py-1.5 text-right text-[10px] font-medium uppercase cursor-pointer hover:bg-gray-700"
                    onClick={() => handleInventoryLoadsSort('load_inventory')}
                  >
                    <div className="flex items-center justify-end">
                      Inv BF {getInventoryLoadsSortIcon('load_inventory')}
                    </div>
                  </th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase">
                    Packs
                  </th>
                  <th 
                    className="px-2 py-1.5 text-right text-[10px] font-medium uppercase cursor-pointer hover:bg-gray-700"
                    onClick={() => handleInventoryLoadsSort('price')}
                  >
                    <div className="flex items-center justify-end">
                      Price {getInventoryLoadsSortIcon('price')}
                    </div>
                  </th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase w-10">
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventoryLoads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-xs">
                      No loads found
                    </td>
                  </tr>
                ) : (
                  filteredInventoryLoads.map((load, idx) => (
                    <tr 
                      key={`${load.load_id}-${idx}`}
                      className={idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-gray-900">
                        {load.load_id}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1">
                          <span 
                            className="w-2 h-2 rounded flex-shrink-0" 
                            style={{ backgroundColor: speciesColors[load.species] || '#6B7280' }}
                          />
                          {load.species}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        {load.grade}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                        {load.thickness}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-right font-semibold text-blue-600">
                        {Number(load.load_inventory || 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center">
                        {load.finished_pack_count}/{load.pack_count}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-right text-green-600">
                        {load.price ? `$${Number(load.price).toFixed(3)}` : '-'}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewRipEntry(load)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                          title="View Rip Entry"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer with totals */}
          {filteredInventoryLoads.length > 0 && (
            <div className="px-3 py-2 bg-gray-100 border-t text-xs">
              <div className="flex justify-between">
                <span className="font-semibold">{filteredInventoryLoads.length} loads</span>
                <span className="font-semibold text-blue-600">
                  {filteredInventoryLoads.reduce((sum, l) => sum + (Number(l.load_inventory) || 0), 0).toLocaleString()} BF
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Loads Dialog */}
      <Dialog open={incomingLoadsDialogOpen} onOpenChange={setIncomingLoadsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Incoming Loads - {selectedIncomingGrade?.thickness} {selectedIncomingGrade?.species} {selectedIncomingGrade?.grade}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {selectedIncomingGrade && (
              <table className="w-full divide-y divide-gray-200 border rounded-lg">
                <thead className="bg-yellow-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Load #</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Supplier</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Est. BF</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Est. Delivery</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Driver</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Pickup Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {selectedIncomingGrade.loads.map((load, idx) => (
                    <tr key={`${load.load_id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{load.load_id}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">{load.supplier_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-yellow-700">
                        {Number(load.estimated_footage || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                        {load.estimated_delivery_date 
                          ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
                          : '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                        {load.driver_name || '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                        {load.assigned_pickup_date 
                          ? new Date(load.assigned_pickup_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-yellow-100">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-sm font-semibold text-gray-700">
                      Total ({selectedIncomingGrade.loads.length} load{selectedIncomingGrade.loads.length !== 1 ? 's' : ''})
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-yellow-800">
                      {selectedIncomingGrade.loads.reduce((sum, l) => sum + (Number(l.estimated_footage) || 0), 0).toLocaleString()}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rip Entry View Dialog */}
      <Dialog open={ripEntryDialogOpen} onOpenChange={setRipEntryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Rip Entry View - Load {selectedLoadForRip?.load_id}
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingPacks ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Load Info */}
              <div className="bg-gray-50 p-3 rounded">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Load ID:</span>
                    <span className="ml-2 font-medium">{selectedLoadForRip?.load_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Supplier:</span>
                    <span className="ml-2 font-medium">{selectedLoadForRip?.supplier_name}</span>
                  </div>
                </div>
              </div>

              {/* Pack Tables */}
              {ripEntryPacks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No pack data available for this load
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* Pack Information */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Pack Information</h3>
                    <div className="border rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Pack ID</th>
                            <th className="px-2 py-1.5 text-left">Length</th>
                            <th className="px-2 py-1.5 text-right">Tally BF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ripEntryPacks.map((pack, idx) => (
                            <tr key={pack.id} className={`${pack.is_finished ? 'bg-green-50' : ''} ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                              <td className="px-2 py-1.5 border-t">{pack.pack_id || '-'}</td>
                              <td className="px-2 py-1.5 border-t">{pack.length ? `${pack.length} ft` : '-'}</td>
                              <td className="px-2 py-1.5 border-t text-right">{pack.tally_board_feet?.toLocaleString() || '-'}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-200 font-semibold">
                            <td className="px-2 py-1.5" colSpan={2}>{ripEntryPacks.length} Packs</td>
                            <td className="px-2 py-1.5 text-right">
                              {ripEntryPacks.reduce((sum, p) => sum + (Number(p.tally_board_feet) || 0), 0).toLocaleString()} BF
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Rip Yield & Comments */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Rip Yield & Comments</h3>
                    <div className="border rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1.5 text-right">Actual BF</th>
                            <th className="px-2 py-1.5 text-right">Yield</th>
                            <th className="px-2 py-1.5 text-left">Comments</th>
                            <th className="px-2 py-1.5 text-center">Done</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ripEntryPacks.map((pack, idx) => (
                            <tr key={pack.id} className={`${pack.is_finished ? 'bg-green-50' : ''} ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                              <td className="px-2 py-1.5 border-t text-right">{pack.actual_board_feet?.toLocaleString() || '-'}</td>
                              <td className="px-2 py-1.5 border-t text-right">{pack.rip_yield || '-'}</td>
                              <td className="px-2 py-1.5 border-t truncate max-w-[100px]">{pack.rip_comments || '-'}</td>
                              <td className="px-2 py-1.5 border-t text-center">
                                {pack.is_finished ? (
                                  <span className="text-green-600">✓</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-200 font-semibold">
                            <td className="px-2 py-1.5 text-right">
                              {ripEntryPacks.filter(p => p.is_finished).reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0).toLocaleString()} BF
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              {ripEntryPacks.filter(p => p.rip_yield).length > 0
                                ? (ripEntryPacks.filter(p => p.rip_yield).reduce((sum, p) => sum + (p.rip_yield || 0), 0) / ripEntryPacks.filter(p => p.rip_yield).length).toFixed(1)
                                : '-'} Avg
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {ripEntryPacks.length > 0 && (
                <div className="bg-blue-50 p-3 rounded text-sm">
                  <div className="flex justify-between">
                    <span>
                      <strong>{ripEntryPacks.filter(p => p.is_finished).length}</strong> of <strong>{ripEntryPacks.length}</strong> packs finished
                    </span>
                    <span>
                      <strong>{ripEntryPacks.filter(p => p.is_finished).reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0).toLocaleString()}</strong> BF ripped of{' '}
                      <strong>{ripEntryPacks.reduce((sum, p) => sum + (Number(p.tally_board_feet) || 0), 0).toLocaleString()}</strong> BF total
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
