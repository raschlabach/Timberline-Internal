'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MonthlyRipReport, LumberBonusParameter } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Wrench } from 'lucide-react'

export default function RipBonusPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [report, setReport] = useState<MonthlyRipReport | null>(null)
  const [bonusParams, setBonusParams] = useState<LumberBonusParameter[]>([])
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
      const [reportRes, paramsRes] = await Promise.all([
        fetch(`/api/lumber/rip-bonus/report?month=${selectedMonth}&year=${selectedYear}`),
        fetch('/api/lumber/bonus-parameters')
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
                {/* Daily Breakdown */}
                <div className="space-y-4">
                  {report.daily_summaries.map((day, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      {/* Day Header */}
                      <div className="bg-gray-100 px-4 py-2 grid grid-cols-7 gap-4 text-sm font-semibold">
                        <div>{new Date(day.work_date).toLocaleDateString()}</div>
                        <div className="text-right">{(day.total_hours || 0).toFixed(1)} hrs</div>
                        <div className="text-right">{(day.total_bf || 0).toLocaleString()} BF</div>
                        <div className="text-right">{(day.bf_per_hour || 0).toFixed(0)} BF/hr</div>
                        <div className="text-right">${(day.bonus_rate || 0).toFixed(2)}</div>
                        <div className="text-right text-green-600">${(day.bonus_total || 0).toFixed(2)}</div>
                        <div className="text-right">{(day.total_bf || 0).toLocaleString()} BF</div>
                      </div>

                      {/* Operator Breakdowns */}
                      <div className="divide-y">
                        {(day.operator_breakdowns || []).map((op, opIdx) => (
                          <div key={opIdx} className="px-4 py-2 grid grid-cols-7 gap-4 text-sm hover:bg-gray-50">
                            <div className="col-span-2 pl-4 text-gray-700">{op.user_name || '-'}</div>
                            <div className="text-right text-gray-700">{(op.bf_contributed || 0).toLocaleString()} BF</div>
                            <div className="text-right text-gray-700">{(op.percentage || 0).toFixed(2)}%</div>
                            <div></div>
                            <div className="text-right text-green-600">${(op.bonus_amount || 0).toFixed(2)}</div>
                            <div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Footer */}
                <div className="mt-6 pt-4 border-t">
                  <div className="grid grid-cols-7 gap-4 text-sm font-bold">
                    <div>Total Hours {report.total_hours || 0}</div>
                    <div>Total RNR {(report.total_rnr || 0).toLocaleString()}</div>
                    <div>Total Misc {(report.total_misc || 0).toLocaleString()}</div>
                    <div>Total {(report.total_bf || 0).toLocaleString()}</div>
                    <div></div>
                    <div className="text-green-600">Total Bonus ${(report.total_bonus || 0).toFixed(2)}</div>
                    <div></div>
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
                      <td className="px-4 py-2 text-sm text-right">{(op.total_rip_ft || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right text-green-600 font-semibold">
                        ${(op.total_bonus || 0).toFixed(2)}
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
                    <td className="py-2">{(param.bf_min || 0).toLocaleString()}</td>
                    <td className="py-2">{(param.bf_max || 0).toLocaleString()}</td>
                    <td className="py-2 text-right">${(param.bonus_amount || 0).toFixed(2)}</td>
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
    </div>
  )
}
