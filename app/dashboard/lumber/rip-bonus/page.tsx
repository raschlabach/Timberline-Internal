'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MonthlyRipReport, LumberBonusParameter, LumberPackWithDetails } from '@/types/lumber'

interface Operator {
  id: number
  name: string
  is_active: boolean
}
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar, Wrench, Package, Search, X, Pencil } from 'lucide-react'

export default function RipBonusPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [report, setReport] = useState<MonthlyRipReport | null>(null)
  const [bonusParams, setBonusParams] = useState<LumberBonusParameter[]>([])
  const [packs, setPacks] = useState<LumberPackWithDetails[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isLoading, setIsLoading] = useState(true)
  
  // Ripped packs filters
  const [packsSearch, setPacksSearch] = useState('')
  const [packsSpecies, setPacksSpecies] = useState('all')
  const [packsGrade, setPacksGrade] = useState('all')
  const [packsOperator, setPacksOperator] = useState('all')
  const [packsStacker, setPacksStacker] = useState('all')
  const [packsType, setPacksType] = useState('all')
  
  // Operators for edit dialog
  const [operators, setOperators] = useState<Operator[]>([])
  
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
    is_finished: true,
    finished_at: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/rip-bonus')
    }
  }, [status, router])

  async function fetchData() {
    try {
      const [reportRes, paramsRes, packsRes] = await Promise.all([
        fetch(`/api/lumber/rip-bonus/report?month=${selectedMonth}&year=${selectedYear}`),
        fetch('/api/lumber/bonus-parameters'),
        fetch(`/api/lumber/packs/finished?month=${selectedMonth}&year=${selectedYear}`)
      ])

      if (reportRes.ok) {
        const reportData = await reportRes.json()
        // Ensure the response has the expected structure
        if (reportData && !reportData.error) {
          setReport({
            ...reportData,
            daily_summaries: reportData.daily_summaries || [],
            operator_totals: reportData.operator_totals || [],
            total_hours: reportData.total_hours || 0,
            total_bf: reportData.total_bf || 0,
            total_bonus: reportData.total_bonus || 0,
            total_rnr: reportData.total_rnr || 0,
            total_misc: reportData.total_misc || 0
          })
        }
      }
      if (paramsRes.ok) {
        const paramsData = await paramsRes.json()
        if (Array.isArray(paramsData)) {
          setBonusParams(paramsData)
        }
      }
      if (packsRes.ok) {
        const packsData = await packsRes.json()
        if (Array.isArray(packsData)) {
          setPacks(packsData)
        }
      }
    } catch (error) {
      console.error('Error fetching rip bonus data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, selectedMonth, selectedYear])
  
  // Fetch operators once on mount
  useEffect(() => {
    async function fetchOperators() {
      try {
        const res = await fetch('/api/lumber/operators')
        if (res.ok) {
          const data = await res.json()
          setOperators(data)
        }
      } catch (error) {
        console.error('Error fetching operators:', error)
      }
    }
    fetchOperators()
  }, [])
  
  // Edit pack functions
  function handleOpenEditPack(pack: LumberPackWithDetails) {
    setEditingPack(pack)
    setEditPackData({
      pack_id: String(pack.pack_id || ''),
      length: pack.length != null ? String(pack.length) : '',
      tally_board_feet: pack.tally_board_feet != null ? String(Math.round(Number(pack.tally_board_feet))) : '',
      actual_board_feet: pack.actual_board_feet != null ? String(Math.round(Number(pack.actual_board_feet))) : '',
      rip_yield: pack.rip_yield != null ? String(pack.rip_yield) : '',
      rip_comments: pack.rip_comments || '',
      operator_id: pack.operator_id != null ? String(pack.operator_id) : '',
      stacker_1_id: pack.stacker_1_id != null ? String(pack.stacker_1_id) : '',
      stacker_2_id: pack.stacker_2_id != null ? String(pack.stacker_2_id) : '',
      stacker_3_id: pack.stacker_3_id != null ? String(pack.stacker_3_id) : '',
      stacker_4_id: pack.stacker_4_id != null ? String(pack.stacker_4_id) : '',
      is_finished: pack.is_finished || false,
      finished_at: pack.finished_at ? new Date(pack.finished_at).toISOString().split('T')[0] : ''
    })
    setEditPackDialogOpen(true)
  }
  
  async function handleSaveEditPack() {
    if (!editingPack) return
    
    try {
      // Determine if this is a misc pack or regular pack
      const isMiscPack = editingPack.pack_type === 'misc'
      const endpoint = isMiscPack 
        ? `/api/lumber/misc-packs/${editingPack.id}`
        : `/api/lumber/packs/${editingPack.id}/rip-data`
      
      const response = await fetch(endpoint, {
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
        setEditPackDialogOpen(false)
        setEditingPack(null)
        fetchData() // Refresh data
      } else {
        const error = await response.json()
        alert(`Error saving pack: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving pack:', error)
      alert('Error saving pack')
    }
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
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Rip Bonus</h1>
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <Select 
            value={`${selectedMonth}-${selectedYear}`} 
            onValueChange={(val) => {
              const [month, year] = val.split('-')
              setSelectedMonth(parseInt(month))
              setSelectedYear(parseInt(year))
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.flatMap(year =>
                months.map((month, idx) => (
                  <SelectItem key={`${idx + 1}-${year}`} value={`${idx + 1}-${year}`}>
                    {month} {year}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Daily Rips - Main Content */}
        <div className="col-span-3">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-2xl font-bold mb-4">Daily Rips</h2>
            
            {report && report.daily_summaries && report.daily_summaries.length > 0 ? (
              <>
                {/* Column Headers */}
                <div className="bg-gray-200 px-4 py-2 grid grid-cols-8 gap-2 text-xs font-semibold text-gray-600 uppercase rounded-t-lg">
                  <div>Date</div>
                  <div className="text-right">Hours</div>
                  <div className="text-right">Total BF</div>
                  <div className="text-right">BF/Hr</div>
                  <div className="text-right">Rate</div>
                  <div className="text-right">Qual.</div>
                  <div className="text-right">Pool</div>
                  <div></div>
                </div>

                {/* Daily Breakdown */}
                <div className="space-y-4 mt-2">
                  {report.daily_summaries.map((day, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      {/* Day Header */}
                      <div className="bg-gray-100 px-4 py-2 grid grid-cols-8 gap-2 text-sm font-semibold">
                        <div>{new Date(day.work_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}</div>
                        <div className="text-right">{Number(day.total_hours || 0).toFixed(1)}</div>
                        <div className="text-right">{Number(day.total_bf || 0).toLocaleString()}</div>
                        <div className="text-right">{Number(day.bf_per_hour || 0).toFixed(0)}</div>
                        <div className="text-right">${Number(day.bonus_rate || 0).toFixed(2)}</div>
                        <div className="text-right">{day.qualifying_people || 0}</div>
                        <div className="text-right text-green-600 font-bold">${Number(day.bonus_total || 0).toFixed(2)}</div>
                        <div></div>
                      </div>

                      {/* Operator Breakdowns */}
                      <div className="divide-y">
                        <div className="px-4 py-1 grid grid-cols-8 gap-2 text-xs font-medium text-gray-500 bg-gray-50">
                          <div className="col-span-2 pl-4">Contributor</div>
                          <div className="text-right">Split BF</div>
                          <div className="text-right">Split %</div>
                          <div className="text-right">Touched %</div>
                          <div></div>
                          <div className="text-right">Bonus</div>
                          <div></div>
                        </div>
                        {(day.operator_breakdowns || []).map((op, opIdx) => {
                          // Qualification is based on touched percentage (packs they worked on)
                          const touchedPct = Number(op.touched_percentage || 0)
                          const isQualified = touchedPct >= 30
                          return (
                            <div key={opIdx} className="px-4 py-2 grid grid-cols-8 gap-2 text-sm hover:bg-gray-50">
                              <div className="col-span-2 pl-4 text-gray-700">{op.user_name || '-'}</div>
                              <div className="text-right text-gray-700">{Number(op.bf_contributed || 0).toLocaleString()}</div>
                              <div className="text-right text-gray-700">{Number(op.percentage || 0).toFixed(1)}%</div>
                              <div className="text-right">
                                {isQualified ? (
                                  <span className="text-green-600 font-medium">{touchedPct.toFixed(0)}%</span>
                                ) : (
                                  <span className="text-gray-400">{touchedPct.toFixed(0)}%</span>
                                )}
                              </div>
                              <div></div>
                              <div className="text-right text-green-600 font-medium">${Number(op.bonus_amount || 0).toFixed(2)}</div>
                              <div></div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Footer */}
                <div className="mt-6 pt-4 border-t">
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-100 rounded p-3">
                      <div className="text-gray-500 text-xs uppercase">Total Hours</div>
                      <div className="font-bold text-lg">{Number(report.total_hours || 0).toFixed(1)}</div>
                    </div>
                    <div className="bg-gray-100 rounded p-3">
                      <div className="text-gray-500 text-xs uppercase">RNR BF</div>
                      <div className="font-bold text-lg">{Number(report.total_rnr || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-gray-100 rounded p-3">
                      <div className="text-gray-500 text-xs uppercase">Misc BF</div>
                      <div className="font-bold text-lg">{Number(report.total_misc || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-green-100 rounded p-3">
                      <div className="text-green-700 text-xs uppercase">Total Bonus Pool</div>
                      <div className="font-bold text-lg text-green-700">${Number(report.total_bonus || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-12">
                No rip data for {months[selectedMonth - 1]} {selectedYear}
              </div>
            )}
          </div>

          {/* Operator Totals */}
          <div className="bg-white rounded-lg shadow p-4 mt-6">
            <h2 className="text-2xl font-bold mb-4">Rip Bonus</h2>
            {report && report.operator_totals && report.operator_totals.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Person</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold">Rip Ft</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold">Bonus</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.operator_totals.map((op, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{op.user_name || '-'}</td>
                      <td className="px-4 py-2 text-sm text-right">{Number(op.total_rip_ft || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right text-green-600 font-semibold">
                        ${Number(op.total_bonus || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No bonus data available
              </div>
            )}
          </div>
        </div>

        {/* Rip Bonus Parameters - Sidebar */}
        <div>
          <div className="bg-blue-900 rounded-lg shadow p-4 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="h-5 w-5" />
              <h3 className="font-semibold">Rip Bonus Parameters</h3>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-700">
                  <th className="py-2 text-left">BF Min</th>
                  <th className="py-2 text-left">BF Max</th>
                  <th className="py-2 text-right">Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-700">
                {bonusParams.length > 0 ? bonusParams.map((param) => (
                  <tr key={param.id}>
                    <td className="py-2">{Number(param.bf_min || 0).toLocaleString()}</td>
                    <td className="py-2">{Number(param.bf_max || 0).toLocaleString()}</td>
                    <td className="py-2 text-right">${Number(param.bonus_amount || 0).toFixed(2)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-blue-300 text-xs">
                      No parameters configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ripped Packs List */}
      {(() => {
        // Get unique filter options from packs
        const uniqueSpecies: string[] = ['all', ...Array.from(new Set(packs.map(p => p.species).filter((s): s is string => !!s))).sort()]
        const uniqueGrades: string[] = ['all', ...Array.from(new Set(packs.map(p => p.grade).filter((g): g is string => !!g))).sort()]
        const uniqueOperators: string[] = ['all', ...Array.from(new Set(packs.map(p => p.operator_name).filter((o): o is string => !!o))).sort()]
        const uniqueStackers: string[] = ['all', ...Array.from(new Set(packs.flatMap(p => [
          p.stacker_1_name, p.stacker_2_name, p.stacker_3_name, p.stacker_4_name
        ].filter((s): s is string => !!s)))).sort()]
        
        // Filter packs
        const filteredPacks = packs.filter(pack => {
          // Search filter (pack ID or load ID)
          if (packsSearch) {
            const search = packsSearch.toLowerCase()
            const matchesPackId = String(pack.pack_id || '').toLowerCase().includes(search)
            const matchesLoadId = String(pack.load_load_id || '').toLowerCase().includes(search)
            if (!matchesPackId && !matchesLoadId) return false
          }
          
          // Species filter
          if (packsSpecies !== 'all' && pack.species !== packsSpecies) return false
          
          // Grade filter
          if (packsGrade !== 'all' && pack.grade !== packsGrade) return false
          
          // Operator filter
          if (packsOperator !== 'all' && pack.operator_name !== packsOperator) return false
          
          // Stacker filter
          if (packsStacker !== 'all') {
            const stackers = [pack.stacker_1_name, pack.stacker_2_name, pack.stacker_3_name, pack.stacker_4_name]
            if (!stackers.includes(packsStacker)) return false
          }
          
          // Pack type filter
          if (packsType !== 'all' && (pack.pack_type || 'rnr') !== packsType) return false
          
          return true
        })
        
        const hasFilters = packsSearch || packsSpecies !== 'all' || packsGrade !== 'all' || packsOperator !== 'all' || packsStacker !== 'all' || packsType !== 'all'
        
        const clearFilters = () => {
          setPacksSearch('')
          setPacksSpecies('all')
          setPacksGrade('all')
          setPacksOperator('all')
          setPacksStacker('all')
          setPacksType('all')
        }
        
        return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 bg-gray-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h2 className="font-semibold">Ripped Packs - {months[selectedMonth - 1]} {selectedYear}</h2>
          </div>
          <div className="text-sm">
            {filteredPacks.length} packs · {filteredPacks.reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0).toLocaleString()} BF
            {hasFilters && ` (filtered from ${packs.length})`}
          </div>
        </div>
        
        {/* Filters */}
        <div className="p-3 bg-gray-50 border-b flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search Pack/Load ID..."
              value={packsSearch}
              onChange={(e) => setPacksSearch(e.target.value)}
              className="pl-8 w-48 h-9"
            />
          </div>
          
          <Select value={packsSpecies} onValueChange={setPacksSpecies}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Species" />
            </SelectTrigger>
            <SelectContent>
              {uniqueSpecies.map(s => (
                <SelectItem key={s} value={s}>{s === 'all' ? 'All Species' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={packsGrade} onValueChange={setPacksGrade}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              {uniqueGrades.map(g => (
                <SelectItem key={g} value={g}>{g === 'all' ? 'All Grades' : g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={packsOperator} onValueChange={setPacksOperator}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              {uniqueOperators.map(o => (
                <SelectItem key={o} value={o}>{o === 'all' ? 'All Operators' : o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={packsStacker} onValueChange={setPacksStacker}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Stacker" />
            </SelectTrigger>
            <SelectContent>
              {uniqueStackers.map(s => (
                <SelectItem key={s} value={s}>{s === 'all' ? 'All Stackers' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={packsType} onValueChange={setPacksType}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="rnr">RNR</SelectItem>
              <SelectItem value="misc">Misc</SelectItem>
            </SelectContent>
          </Select>
          
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        <div className="overflow-x-auto" style={{ maxHeight: '600px' }}>
          <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1400px' }}>
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pack ID</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Load/Customer</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Species</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Thickness</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Length</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tally BF</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual BF</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Yield</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stackers</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Finished</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPacks.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                    {packs.length === 0 
                      ? `No packs ripped in ${months[selectedMonth - 1]} ${selectedYear}`
                      : 'No packs match the current filters'
                    }
                  </td>
                </tr>
              ) : (
                filteredPacks.map((pack) => (
                  <tr key={`${pack.pack_type || 'rnr'}-${pack.id}`} className={`hover:bg-gray-50 text-sm ${pack.pack_type === 'misc' ? 'bg-amber-50' : ''}`}>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditPack(pack)}
                        className="h-7 w-7 p-0"
                        title="Edit Pack"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {pack.pack_type === 'misc' ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">MISC</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">RNR</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-medium text-gray-900">
                      {pack.pack_id || '-'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">
                      {pack.pack_type === 'misc' ? (
                        <span className="text-amber-700">{pack.load_load_id?.replace('MISC: ', '')}</span>
                      ) : pack.load_load_id}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">
                      {pack.species}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">
                      {pack.grade}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">
                      {pack.thickness}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">
                      {pack.length ? `${pack.length} ft` : '-'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-900 text-right">
                      {Number(pack.tally_board_feet || 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-blue-600 font-medium text-right">
                      {Number(pack.actual_board_feet || 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-900 text-right">
                      {pack.rip_yield ? `${Number(pack.rip_yield).toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-900 text-xs">
                      {pack.operator_name || '-'}
                    </td>
                    <td className="px-2 py-1.5 text-gray-900 text-xs">
                      {[
                        pack.stacker_1_name,
                        pack.stacker_2_name,
                        pack.stacker_3_name,
                        pack.stacker_4_name
                      ].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">
                      {pack.finished_at 
                        ? new Date(pack.finished_at).toLocaleDateString('en-US', { timeZone: 'UTC' })
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
      })()}
      
      {/* Edit Pack Dialog */}
      <Dialog open={editPackDialogOpen} onOpenChange={setEditPackDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Pack {editingPack?.pack_type === 'misc' ? '(Misc)' : ''}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <div>
              <Label>Pack ID</Label>
              <Input
                value={editPackData.pack_id}
                onChange={(e) => setEditPackData(prev => ({ ...prev, pack_id: e.target.value }))}
              />
            </div>
            {editingPack?.pack_type !== 'misc' && (
              <>
                <div>
                  <Label>Length (ft)</Label>
                  <Input
                    type="number"
                    value={editPackData.length}
                    onChange={(e) => setEditPackData(prev => ({ ...prev, length: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Tally BF</Label>
                  <Input
                    type="number"
                    value={editPackData.tally_board_feet}
                    onChange={(e) => setEditPackData(prev => ({ ...prev, tally_board_feet: e.target.value }))}
                  />
                </div>
              </>
            )}
            <div>
              <Label>Actual BF</Label>
              <Input
                type="number"
                value={editPackData.actual_board_feet}
                onChange={(e) => setEditPackData(prev => ({ ...prev, actual_board_feet: e.target.value }))}
              />
            </div>
            <div>
              <Label>Rip Yield %</Label>
              <Input
                type="number"
                value={editPackData.rip_yield}
                onChange={(e) => setEditPackData(prev => ({ ...prev, rip_yield: e.target.value }))}
              />
            </div>
            <div>
              <Label>Finished Date</Label>
              <Input
                type="date"
                value={editPackData.finished_at}
                onChange={(e) => setEditPackData(prev => ({ ...prev, finished_at: e.target.value }))}
              />
            </div>
            <div>
              <Label>Operator</Label>
              <Select 
                value={editPackData.operator_id || 'none'} 
                onValueChange={(val) => setEditPackData(prev => ({ ...prev, operator_id: val === 'none' ? '' : val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- None --</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stacker 1</Label>
              <Select 
                value={editPackData.stacker_1_id || 'none'} 
                onValueChange={(val) => setEditPackData(prev => ({ ...prev, stacker_1_id: val === 'none' ? '' : val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stacker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- None --</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stacker 2</Label>
              <Select 
                value={editPackData.stacker_2_id || 'none'} 
                onValueChange={(val) => setEditPackData(prev => ({ ...prev, stacker_2_id: val === 'none' ? '' : val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stacker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- None --</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stacker 3</Label>
              <Select 
                value={editPackData.stacker_3_id || 'none'} 
                onValueChange={(val) => setEditPackData(prev => ({ ...prev, stacker_3_id: val === 'none' ? '' : val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stacker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- None --</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stacker 4</Label>
              <Select 
                value={editPackData.stacker_4_id || 'none'} 
                onValueChange={(val) => setEditPackData(prev => ({ ...prev, stacker_4_id: val === 'none' ? '' : val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stacker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- None --</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3">
              <Label>Comments</Label>
              <Textarea
                value={editPackData.rip_comments}
                onChange={(e) => setEditPackData(prev => ({ ...prev, rip_comments: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="col-span-3 flex items-center gap-2">
              <Checkbox
                id="is_finished"
                checked={editPackData.is_finished}
                onCheckedChange={(checked) => setEditPackData(prev => ({ ...prev, is_finished: checked as boolean }))}
              />
              <Label htmlFor="is_finished">Finished</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditPackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditPack}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
