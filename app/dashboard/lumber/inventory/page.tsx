'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { InventoryGroup, LumberPackWithDetails } from '@/types/lumber'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronDown, ChevronRight } from 'lucide-react'

export default function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([])
  const [recentPacks, setRecentPacks] = useState<LumberPackWithDetails[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [monthlyRipped, setMonthlyRipped] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/inventory')
    }
  }, [status, router])

  async function fetchInventoryData() {
    try {
      const [inventoryRes, packsRes, monthlyRes] = await Promise.all([
        fetch('/api/lumber/inventory'),
        fetch('/api/lumber/packs/recent?limit=50'),
        fetch(`/api/lumber/inventory/monthly?month=${selectedMonth}&year=${selectedYear}`)
      ])

      if (inventoryRes.ok) setInventoryGroups(await inventoryRes.json())
      if (packsRes.ok) setRecentPacks(await packsRes.json())
      if (monthlyRes.ok) setMonthlyRipped(await monthlyRes.json())
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchInventoryData()
    }
  }, [status, selectedMonth, selectedYear])

  function toggleGroup(groupKey: string) {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey)
    } else {
      newExpanded.add(groupKey)
    }
    setExpandedGroups(newExpanded)
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-600 mt-1">
          Current inventory levels and monthly rip tracking
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Current Inventory */}
        <div className="col-span-2">
          <h2 className="text-xl font-semibold mb-4">Current Inventory</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Thickness
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Species
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total Footage
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Finished
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Inventory
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventoryGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No inventory data available
                    </td>
                  </tr>
                ) : (
                  inventoryGroups.map((group, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {group.thickness}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {group.species}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {group.grade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {group.total_actual_footage?.toLocaleString() || '0'} BF
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {group.total_finished_footage?.toLocaleString() || '0'} BF
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
                        {group.current_inventory?.toLocaleString() || '0'} BF
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Ripped */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Monthly Ripped Footage</h2>
          <div className="bg-white rounded-lg shadow p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Month</Label>
                <Select 
                  value={selectedMonth.toString()} 
                  onValueChange={(val) => setSelectedMonth(parseInt(val))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month, idx) => (
                      <SelectItem key={idx} value={(idx + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Year</Label>
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(val) => setSelectedYear(parseInt(val))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {monthlyRipped && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-700">
                  Total Ripped: {monthlyRipped.total_ripped?.toLocaleString() || '0'} BF
                </div>
                {monthlyRipped.by_species && monthlyRipped.by_species.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-500">By Species:</div>
                    {monthlyRipped.by_species.map((item: any, idx: number) => (
                      <div key={idx} className="text-xs text-gray-700 pl-2">
                        {item.species} ({item.thickness}): {item.total?.toLocaleString() || '0'} BF
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Ripped Packs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">50 Most Recent Ripped Packs</h2>
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
                    Finished
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentPacks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      No ripped packs yet
                    </td>
                  </tr>
                ) : (
                  recentPacks.map((pack) => (
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
                        {pack.tally_board_feet.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 text-right">
                        {pack.actual_board_feet?.toLocaleString() || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 text-right">
                        {pack.rip_yield || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 text-xs">
                        {pack.operator_name || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
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
    </div>
  )
}
