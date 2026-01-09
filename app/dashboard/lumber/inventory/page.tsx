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
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChevronDown, ChevronRight } from 'lucide-react'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#d084d0', '#a4de6c']

export default function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([])
  const [recentPacks, setRecentPacks] = useState<LumberPackWithDetails[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [monthlyRipped, setMonthlyRipped] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [chartView, setChartView] = useState<'species' | 'species-grade'>('species')
  const [speciesColors, setSpeciesColors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/inventory')
    }
  }, [status, router])

  async function fetchInventoryData() {
    try {
      const [inventoryRes, packsRes, monthlyRes, speciesRes] = await Promise.all([
        fetch('/api/lumber/inventory'),
        fetch('/api/lumber/packs/recent?limit=50'),
        fetch(`/api/lumber/inventory/monthly?month=${selectedMonth}&year=${selectedYear}`),
        fetch('/api/lumber/species')
      ])

      if (inventoryRes.ok) setInventoryGroups(await inventoryRes.json())
      if (packsRes.ok) setRecentPacks(await packsRes.json())
      if (monthlyRes.ok) setMonthlyRipped(await monthlyRes.json())
      
      if (speciesRes.ok) {
        const speciesData = await speciesRes.json()
        const colorMap: Record<string, string> = {}
        speciesData.forEach((sp: any) => {
          colorMap[sp.name] = sp.color || '#6B7280'
        })
        setSpeciesColors(colorMap)
      }
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

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Prepare chart data based on toggle
  const chartData = chartView === 'species' 
    ? inventoryGroups.reduce((acc: any[], group) => {
        const existing = acc.find(item => item.name === group.species)
        if (existing) {
          existing.value += Number(group.current_inventory) || 0
        } else {
          acc.push({
            name: group.species,
            value: Number(group.current_inventory) || 0,
            color: speciesColors[group.species] || '#6B7280'
          })
        }
        return acc
      }, []).sort((a, b) => b.value - a.value)
    : inventoryGroups.map(group => ({
        name: `${group.species} ${group.grade}`,
        value: Number(group.current_inventory) || 0,
        color: speciesColors[group.species] || '#6B7280'
      })).sort((a, b) => b.value - a.value)

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  function toggleRow(key: string) {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedRows(newExpanded)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-600 mt-1">Current inventory levels and tracking</p>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">Inventory Chart</h3>
          <div className="flex gap-2">
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
              className={`px-3 py-1 text-xs rounded transition-colors ${
                chartView === 'species-grade'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              By Species & Grade
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
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
            <Bar dataKey="value">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Compact Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-2 bg-gray-800 text-white">
          <h2 className="text-sm font-semibold">Current Inventory Detail</h2>
          <p className="text-[10px] text-gray-300 mt-0.5">
            Inventory = Actual BF (arrived) - Finished BF (ripped). Excludes loads marked as completely finished.
          </p>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Species</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Grade</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Thick</th>
              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Total BF</th>
              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Finished</th>
              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Inventory</th>
              <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-600 uppercase">Loads</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {inventoryGroups.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                  No inventory data available
                </td>
              </tr>
            ) : (
              inventoryGroups.map((group, idx) => {
                const rowKey = `${group.species}-${group.grade}-${group.thickness}`
                const isExpanded = expandedRows.has(rowKey)
                return (
                  <>
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => toggleRow(rowKey)}
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
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-right">
                        {Number(group.total_actual_footage || 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-right">
                        {Number(group.total_finished_footage || 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 text-right">
                        {Number(group.current_inventory || 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                          {group.load_count}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className={idx % 2 === 0 ? 'bg-blue-50' : 'bg-blue-100'}>
                        <td></td>
                        <td colSpan={7} className="px-4 py-2">
                          <div className="text-xs">
                            <span className="font-semibold text-gray-700">Load IDs: </span>
                            <span className="text-gray-600">
                              {group.load_ids.join(', ')}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Compact Recent Packs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-2 bg-gray-800 text-white flex justify-between items-center">
          <h2 className="text-sm font-semibold">50 Most Recent Ripped Packs</h2>
          <div className="flex gap-2 items-center">
            <Label className="text-xs text-gray-300">Month:</Label>
            <Select 
              value={selectedMonth.toString()} 
              onValueChange={(val) => setSelectedMonth(parseInt(val))}
            >
              <SelectTrigger className="h-7 text-xs w-24 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, idx) => (
                  <SelectItem key={idx} value={(idx + 1).toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-xs text-gray-300">Year:</Label>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(val) => setSelectedYear(parseInt(val))}
            >
              <SelectTrigger className="h-7 text-xs w-20 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Pack ID</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Load</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Species/Grade</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Thick</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Len</th>
              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Tally</th>
              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Actual</th>
              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Yield</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Operator</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Finished</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recentPacks.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">
                  No ripped packs yet
                </td>
              </tr>
            ) : (
              recentPacks.map((pack, idx) => (
                <tr key={pack.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold">{pack.pack_id}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs">{pack.load_load_id}</td>
                  <td className="px-2 py-1 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{pack.species}</span>
                      <span className="text-gray-500">{pack.grade}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs">{pack.thickness}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs">{pack.length}ft</td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-right">
                    {pack.tally_board_feet.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-right">
                    {pack.actual_board_feet?.toLocaleString() || '-'}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-right">
                    {pack.rip_yield || '-'}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-[10px] truncate max-w-[80px]">
                    {pack.operator_name || '-'}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-[10px]">
                    {pack.finished_at 
                      ? new Date(pack.finished_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '-'}
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
