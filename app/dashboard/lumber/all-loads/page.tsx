'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails } from '@/types/lumber'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Info, CheckCircle, XCircle } from 'lucide-react'

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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/all-loads')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const [loadsRes, speciesRes] = await Promise.all([
          fetch('/api/lumber/loads'),
          fetch('/api/lumber/species')
        ])
        
        if (loadsRes.ok) {
          const data = await loadsRes.json()
          setLoads(data)
          setFilteredLoads(data)
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
    if (searchTerm === '') {
      setFilteredLoads(loads)
    } else {
      const filtered = loads.filter(load => {
        const search = searchTerm.toLowerCase()
        return (
          load.load_id?.toLowerCase().includes(search) ||
          load.supplier_name?.toLowerCase().includes(search) ||
          (load.items && load.items.some(item => 
            item.species?.toLowerCase().includes(search) ||
            item.grade?.toLowerCase().includes(search)
          )) ||
          load.invoice_number?.toLowerCase().includes(search)
        )
      })
      setFilteredLoads(filtered)
    }
  }, [searchTerm, loads])

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
      
      // Refresh the loads
      const loadsRes = await fetch('/api/lumber/loads')
      if (loadsRes.ok) {
        const data = await loadsRes.json()
        setLoads(data)
        setFilteredLoads(searchTerm ? data.filter((load: LumberLoadWithDetails) => {
          const search = searchTerm.toLowerCase()
          return (
            load.load_id?.toLowerCase().includes(search) ||
            load.supplier_name?.toLowerCase().includes(search) ||
            (load.items && load.items.some(item => 
              item.species?.toLowerCase().includes(search) ||
              item.grade?.toLowerCase().includes(search)
            )) ||
            load.invoice_number?.toLowerCase().includes(search)
          )
        }) : data)
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

      {/* Search Bar and Actions */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by Load ID, Supplier, Species, Grade, or Invoice #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)}
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
