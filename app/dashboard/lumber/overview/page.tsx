'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { InventoryGroup, InventoryLoadDetail, LumberLoadWithDetails, LumberPackWithDetails } from '@/types/lumber'
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
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronDown, ChevronRight, Truck, Eye } from 'lucide-react'

export default function OverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([])
  const [incomingGroups, setIncomingGroups] = useState<any[]>([])
  const [assignedLoads, setAssignedLoads] = useState<LumberLoadWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedInventoryRows, setExpandedInventoryRows] = useState<Set<string>>(new Set())
  const [expandedIncomingRows, setExpandedIncomingRows] = useState<Set<string>>(new Set())
  const [chartView, setChartView] = useState<'species' | 'species-grade'>('species')
  const [speciesColors, setSpeciesColors] = useState<Record<string, string>>({})
  
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

      // Process inventory data
      if (inventoryRes.ok) {
        const loadDetails: InventoryLoadDetail[] = await inventoryRes.json()
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
              loads: []
            }
          }
          
          grouped[key].total_actual_footage += Number(load.actual_footage) || 0
          grouped[key].total_finished_footage += Number(load.finished_footage) || 0
          grouped[key].current_inventory += Number(load.load_inventory) || 0
          grouped[key].load_count += 1
          grouped[key].loads.push(load)
        })
        
        setInventoryGroups(Object.values(grouped))
      }

      // Process incoming loads data
      if (incomingRes.ok) {
        const incomingLoads = await incomingRes.json()
        const grouped: Record<string, any> = {}
        
        incomingLoads.forEach((load: any) => {
          load.items?.forEach((item: any) => {
            const key = `${item.species}|${item.grade}|${item.thickness}`
            
            if (!grouped[key]) {
              grouped[key] = {
                species: item.species,
                grade: item.grade,
                thickness: item.thickness,
                total_estimated_footage: 0,
                load_count: 0,
                loads: []
              }
            }
            
            grouped[key].total_estimated_footage += Number(item.estimated_footage) || 0
            grouped[key].load_count += 1
            grouped[key].loads.push({
              load_id: load.load_id,
              supplier_name: load.supplier_name,
              estimated_footage: item.estimated_footage,
              estimated_delivery_date: load.estimated_delivery_date,
              pickup_number: load.pickup_number
            })
          })
        })
        
        setIncomingGroups(Object.values(grouped))
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

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Prepare chart data - combine incoming and inventory
  const combinedChartData = chartView === 'species' 
    ? (() => {
        const data: Record<string, { name: string, incoming: number, inventory: number, color: string }> = {}
        
        // Add incoming
        incomingGroups.forEach(group => {
          if (!data[group.species]) {
            data[group.species] = { name: group.species, incoming: 0, inventory: 0, color: speciesColors[group.species] || '#6B7280' }
          }
          data[group.species].incoming += Number(group.total_estimated_footage) || 0
        })
        
        // Add inventory
        inventoryGroups.forEach(group => {
          if (!data[group.species]) {
            data[group.species] = { name: group.species, incoming: 0, inventory: 0, color: speciesColors[group.species] || '#6B7280' }
          }
          data[group.species].inventory += Number(group.current_inventory) || 0
        })
        
        return Object.values(data).sort((a, b) => (b.incoming + b.inventory) - (a.incoming + a.inventory))
      })()
    : (() => {
        const data: Record<string, { name: string, incoming: number, inventory: number, color: string }> = {}
        
        incomingGroups.forEach(group => {
          const key = `${group.species} ${group.grade}`
          if (!data[key]) {
            data[key] = { name: key, incoming: 0, inventory: 0, color: speciesColors[group.species] || '#6B7280' }
          }
          data[key].incoming += Number(group.total_estimated_footage) || 0
        })
        
        inventoryGroups.forEach(group => {
          const key = `${group.species} ${group.grade}`
          if (!data[key]) {
            data[key] = { name: key, incoming: 0, inventory: 0, color: speciesColors[group.species] || '#6B7280' }
          }
          data[key].inventory += Number(group.current_inventory) || 0
        })
        
        return Object.values(data).sort((a, b) => (b.incoming + b.inventory) - (a.incoming + a.inventory))
      })()

  function toggleInventoryRow(key: string) {
    const newExpanded = new Set(expandedInventoryRows)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedInventoryRows(newExpanded)
  }

  function toggleIncomingRow(key: string) {
    const newExpanded = new Set(expandedIncomingRows)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedIncomingRows(newExpanded)
  }

  async function handleViewRipEntry(load: any) {
    setSelectedLoadForRip(load)
    setRipEntryDialogOpen(true)
    setIsLoadingPacks(true)
    
    try {
      // We need to find the actual load ID from the database
      // First fetch the load details
      const loadRes = await fetch(`/api/lumber/loads/by-load-id/${load.load_id}`)
      if (loadRes.ok) {
        const loadData = await loadRes.json()
        if (loadData && loadData.id) {
          // Fetch packs for this load
          const packsRes = await fetch(`/api/lumber/packs/by-load/${loadData.id}`)
          if (packsRes.ok) {
            const packsData = await packsRes.json()
            setRipEntryPacks(packsData)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching rip entry data:', error)
    } finally {
      setIsLoadingPacks(false)
    }
  }

  // Sort groups by species alphabetically so same species are together
  const sortedIncomingGroups = [...incomingGroups].sort((a, b) => {
    const speciesCompare = (a.species || '').localeCompare(b.species || '')
    if (speciesCompare !== 0) return speciesCompare
    return (a.grade || '').localeCompare(b.grade || '')
  })
  
  const sortedInventoryGroups = [...inventoryGroups].sort((a, b) => {
    const speciesCompare = (a.species || '').localeCompare(b.species || '')
    if (speciesCompare !== 0) return speciesCompare
    return (a.grade || '').localeCompare(b.grade || '')
  })

  const totalIncoming = incomingGroups.reduce((sum, g) => sum + (Number(g.total_estimated_footage) || 0), 0)
  const totalInventory = inventoryGroups.reduce((sum, g) => sum + (Number(g.current_inventory) || 0), 0)

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
          <div className="text-xs text-yellow-600">{incomingGroups.reduce((sum, g) => sum + g.load_count, 0)} loads</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800 font-medium">Current Inventory</div>
          <div className="text-2xl font-bold text-blue-900">{totalInventory.toLocaleString()} BF</div>
          <div className="text-xs text-blue-600">{inventoryGroups.reduce((sum, g) => sum + g.load_count, 0)} loads</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-800 font-medium">Scheduled Pickups</div>
          <div className="text-2xl font-bold text-green-900">{assignedLoads.length} loads</div>
          <div className="text-xs text-green-600">Assigned to drivers</div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">Incoming vs Inventory</h3>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-yellow-400"></div>
              <span>Incoming</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span>Inventory</span>
            </div>
            <div className="border-l pl-2 ml-2">
              <button
                onClick={() => setChartView('species')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  chartView === 'species'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                By Species
              </button>
              <button
                onClick={() => setChartView('species-grade')}
                className={`px-3 py-1 text-xs rounded transition-colors ml-1 ${
                  chartView === 'species-grade'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                By Species & Grade
              </button>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={combinedChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 10 }} 
              angle={chartView === 'species-grade' ? -45 : 0}
              textAnchor={chartView === 'species-grade' ? 'end' : 'middle'}
              height={chartView === 'species-grade' ? 80 : 30}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => `${Number(value).toLocaleString()} BF`} />
            <Bar dataKey="incoming" name="Incoming" fill="#FBBF24" />
            <Bar dataKey="inventory" name="Inventory" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column Layout: Incoming and Inventory */}
      <div className="grid grid-cols-2 gap-4">
        {/* Incoming Footage Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 bg-yellow-600 text-white">
            <h2 className="text-sm font-semibold">Incoming Footage (Estimated)</h2>
            <p className="text-[10px] text-yellow-100 mt-0.5">
              Loads not yet arrived - grouped by species/grade/thickness
            </p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Species</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Grade</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Thick</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Est. BF</th>
                  <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-600 uppercase">Loads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedIncomingGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                      No incoming loads
                    </td>
                  </tr>
                ) : (
                  sortedIncomingGroups.map((group, idx) => {
                    const rowKey = `incoming-${group.species}-${group.grade}-${group.thickness}`
                    const isExpanded = expandedIncomingRows.has(rowKey)
                    const prevGroup = idx > 0 ? sortedIncomingGroups[idx - 1] : null
                    const isNewSpecies = !prevGroup || prevGroup.species !== group.species
                    
                    return (
                      <>
                        <tr key={idx} className={`${isNewSpecies && idx > 0 ? 'border-t-2 border-gray-300' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => toggleIncomingRow(rowKey)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <span 
                                className="w-3 h-3 rounded flex-shrink-0" 
                                style={{ backgroundColor: speciesColors[group.species] || '#6B7280' }}
                              />
                              {group.species}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs">{group.grade}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs">{group.thickness}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-yellow-600 text-right">
                            {Number(group.total_estimated_footage || 0).toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center">
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              {group.load_count}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && group.loads && group.loads.map((load: any, loadIdx: number) => (
                          <tr key={`${idx}-${loadIdx}`} className="bg-yellow-50 border-t border-yellow-200">
                            <td className="px-2 py-1.5"></td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-700 font-semibold">└ {load.load_id}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleViewRipEntry(load); }}
                                  className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded"
                                  title="View Rip Entry"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600" colSpan={2}>
                              {load.supplier_name}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-right text-gray-700">
                              {Number(load.estimated_footage || 0).toLocaleString()}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center text-gray-600">
                              {load.estimated_delivery_date 
                                ? new Date(load.estimated_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 bg-blue-600 text-white">
            <h2 className="text-sm font-semibold">Current Inventory</h2>
            <p className="text-[10px] text-blue-100 mt-0.5">
              Actual BF arrived - Finished BF ripped
            </p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Species</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Grade</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Thick</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Inventory</th>
                  <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-600 uppercase">Loads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedInventoryGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                      No inventory data
                    </td>
                  </tr>
                ) : (
                  sortedInventoryGroups.map((group, idx) => {
                    const rowKey = `inventory-${group.species}-${group.grade}-${group.thickness}`
                    const isExpanded = expandedInventoryRows.has(rowKey)
                    const prevGroup = idx > 0 ? sortedInventoryGroups[idx - 1] : null
                    const isNewSpecies = !prevGroup || prevGroup.species !== group.species
                    
                    return (
                      <>
                        <tr key={idx} className={`${isNewSpecies && idx > 0 ? 'border-t-2 border-gray-300' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => toggleInventoryRow(rowKey)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <span 
                                className="w-3 h-3 rounded flex-shrink-0" 
                                style={{ backgroundColor: speciesColors[group.species] || '#6B7280' }}
                              />
                              {group.species}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs">{group.grade}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs">{group.thickness}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 text-right">
                            {Number(group.current_inventory || 0).toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center">
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              {group.load_count}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && group.loads && group.loads.map((load, loadIdx) => (
                          <tr key={`${idx}-${loadIdx}`} className="bg-blue-50 border-t border-blue-200">
                            <td className="px-2 py-1.5"></td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-blue-700 font-semibold">└ {load.load_id}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleViewRipEntry(load); }}
                                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                                  title="View Rip Entry"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">{load.grade}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">{load.thickness}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-right font-semibold text-blue-700">
                              {Number(load.load_inventory || 0).toLocaleString()}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center">
                              <span className="text-gray-600">
                                {load.finished_pack_count}/{load.pack_count}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assigned Loads Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-2 bg-green-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold">Scheduled Pickups</h2>
            <p className="text-[10px] text-green-100 mt-0.5">
              Loads assigned to a driver with pickup date scheduled
            </p>
          </div>
          <div className="flex items-center gap-1 text-green-100">
            <Truck className="h-4 w-4" />
            <span className="text-sm font-semibold">{assignedLoads.length} loads</span>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Load ID</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Supplier</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Species</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Grade</th>
              <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Est. Footage</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Driver</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Pickup Date</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Pickup #</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {assignedLoads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                  No loads currently assigned to drivers
                </td>
              </tr>
            ) : (
              assignedLoads.map((load, idx) => (
                <tr key={load.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs font-semibold">{load.load_id}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                    {load.supplier_name}
                    {load.location_name && (
                      <span className="text-gray-500 text-[10px] ml-1">({load.location_name})</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                    {load.items?.map((item: any) => item.species).filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                    {load.items?.map((item: any) => item.grade).filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs text-right">
                    {load.items?.reduce((sum: number, item: any) => sum + (item.estimated_footage || 0), 0).toLocaleString() || '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs font-medium text-green-700">
                    {load.driver_name || '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                    {load.assigned_pickup_date 
                      ? new Date(load.assigned_pickup_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      : '-'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                    {load.pickup_number || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
