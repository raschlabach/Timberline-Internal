'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MonthlyRipReport, LumberBonusParameter, LumberPackWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Wrench, Package } from 'lucide-react'

export default function RipBonusPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [report, setReport] = useState<MonthlyRipReport | null>(null)
  const [bonusParams, setBonusParams] = useState<LumberBonusParameter[]>([])
  const [packs, setPacks] = useState<LumberPackWithDetails[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isLoading, setIsLoading] = useState(true)

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
                          <div className="text-right">BF</div>
                          <div className="text-right">%</div>
                          <div className="text-right">Qualified</div>
                          <div></div>
                          <div className="text-right">Bonus</div>
                          <div></div>
                        </div>
                        {(day.operator_breakdowns || []).map((op, opIdx) => {
                          const isQualified = Number(op.percentage || 0) >= 30
                          return (
                            <div key={opIdx} className="px-4 py-2 grid grid-cols-8 gap-2 text-sm hover:bg-gray-50">
                              <div className="col-span-2 pl-4 text-gray-700">{op.user_name || '-'}</div>
                              <div className="text-right text-gray-700">{Number(op.bf_contributed || 0).toLocaleString()}</div>
                              <div className="text-right text-gray-700">{Number(op.percentage || 0).toFixed(1)}%</div>
                              <div className="text-right">
                                {isQualified ? (
                                  <span className="text-green-600 font-medium">Yes</span>
                                ) : (
                                  <span className="text-gray-400">No</span>
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
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 bg-gray-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h2 className="font-semibold">Ripped Packs - {months[selectedMonth - 1]} {selectedYear}</h2>
          </div>
          <div className="text-sm">
            {packs.length} packs · {packs.reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0).toLocaleString()} BF
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pack ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Load ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Species</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Thickness</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Length</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tally BF</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual BF</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Yield</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stackers</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Finished</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {packs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    No packs ripped in {months[selectedMonth - 1]} {selectedYear}
                  </td>
                </tr>
              ) : (
                packs.map((pack) => (
                  <tr key={pack.id} className="hover:bg-gray-50 text-sm">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                      {pack.pack_id || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {pack.load_load_id}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {pack.species}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {pack.grade}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {pack.thickness}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {pack.length ? `${pack.length} ft` : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 text-right">
                      {Number(pack.tally_board_feet || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-blue-600 font-medium text-right">
                      {Number(pack.actual_board_feet || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 text-right">
                      {pack.rip_yield ? `${Number(pack.rip_yield).toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 text-xs">
                      {pack.operator_name || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-900 text-xs max-w-[150px] truncate">
                      {[
                        pack.stacker_1_name,
                        pack.stacker_2_name,
                        pack.stacker_3_name,
                        pack.stacker_4_name
                      ].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
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
    </div>
  )
}
