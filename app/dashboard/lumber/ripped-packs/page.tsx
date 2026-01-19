'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberPackWithDetails } from '@/types/lumber'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'

export default function RippedPacksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [packs, setPacks] = useState<LumberPackWithDetails[]>([])
  const [filteredPacks, setFilteredPacks] = useState<LumberPackWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/ripped-packs')
    }
  }, [status, router])

  async function fetchPacks() {
    try {
      let url = '/api/lumber/packs/finished'
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (params.toString()) url += '?' + params.toString()

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPacks(data)
        setFilteredPacks(data)
      }
    } catch (error) {
      console.error('Error fetching ripped packs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPacks()
    }
  }, [status, startDate, endDate])

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredPacks(packs)
    } else {
      const filtered = packs.filter(pack => {
        const search = searchTerm.toLowerCase()
        // Get all stacker names for searching
        const stackerNames = [
          pack.stacker_1_name,
          pack.stacker_2_name,
          pack.stacker_3_name,
          pack.stacker_4_name
        ].filter(Boolean).join(' ').toLowerCase()
        
        return (
          pack.pack_id.toString().includes(search) ||
          pack.load_load_id.toLowerCase().includes(search) ||
          pack.species.toLowerCase().includes(search) ||
          pack.grade.toLowerCase().includes(search) ||
          pack.operator_name?.toLowerCase().includes(search) ||
          stackerNames.includes(search)
        )
      })
      setFilteredPacks(filtered)
    }
  }, [searchTerm, packs])

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const totalPacks = filteredPacks.length
  // Convert DECIMAL strings from PostgreSQL to numbers before summing
  const totalTallyBF = filteredPacks.reduce((sum, p) => sum + (Number(p.tally_board_feet) || 0), 0)
  const totalActualBF = filteredPacks.reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0)
  // Calculate average yield only from packs that have a yield value
  const packsWithYield = filteredPacks.filter(p => p.rip_yield !== null && p.rip_yield !== undefined)
  const avgYield = packsWithYield.length > 0 
    ? packsWithYield.reduce((sum, p) => sum + (Number(p.rip_yield) || 0), 0) / packsWithYield.length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ripped Packs</h1>
        <p className="text-gray-600 mt-1">
          History of all finished pack ripping
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2 relative">
            <Label>Search</Label>
            <Search className="absolute left-3 top-9 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by Pack ID, Load ID, Species, Operator, Stacker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Packs</div>
          <div className="text-2xl font-bold text-gray-900">{totalPacks.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Tally BF</div>
          <div className="text-2xl font-bold text-gray-900">{totalTallyBF.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Actual BF</div>
          <div className="text-2xl font-bold text-blue-600">{totalActualBF.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Average Yield</div>
          <div className="text-2xl font-bold text-green-600">{avgYield.toFixed(2)}%</div>
        </div>
      </div>

      {/* Packs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pack ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Load ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Species / Grade
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Thickness
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Length
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Tally BF
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actual BF
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Yield
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Operator
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Stackers
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Comments
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Finished
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPacks.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                    {packs.length === 0 ? 'No ripped packs found' : 'No packs match your search'}
                  </td>
                </tr>
              ) : (
                filteredPacks.map((pack) => (
                  <tr key={pack.id} className="hover:bg-gray-50 text-sm">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                      {pack.pack_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                      {pack.load_load_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                      {pack.species} - {pack.grade}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                      {pack.thickness}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                      {pack.length} ft
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900 text-right">
                      {Number(pack.tally_board_feet).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900 text-right">
                      {pack.actual_board_feet ? Number(pack.actual_board_feet).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900 text-right">
                      {pack.rip_yield ? `${Number(pack.rip_yield).toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900 text-xs">
                      {pack.operator_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 text-xs">
                      {[
                        pack.stacker_1_name,
                        pack.stacker_2_name,
                        pack.stacker_3_name,
                        pack.stacker_4_name
                      ].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 text-xs max-w-xs truncate">
                      {pack.rip_comments || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-900">
                      {pack.finished_at 
                        ? new Date(pack.finished_at).toLocaleDateString()
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
  )
}
