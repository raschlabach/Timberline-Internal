'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Calendar, BarChart3, Users, Clock, Award, TrendingUp } from 'lucide-react'

interface ReportData {
  dateRange: { startDate: string; endDate: string }
  regularData: Record<string, Record<string, Record<string, {
    totalBF: number
    packCount: number
    loadCount: number
  }>>>
  miscData: Record<string, Record<string, Record<string, {
    totalBF: number
    packCount: number
  }>>>
  totals: {
    regularBF: number
    regularPacks: number
    regularLoads: number
    miscBF: number
    miscPacks: number
    grandTotalBF: number
    grandTotalPacks: number
  }
  statistics: {
    totalHours: number
    bfPerHour: number
    averageStackers: number
    operatorStats: {
      id: string
      name: string
      totalBF: number
      packCount: number
      totalHours: number
      bfPerHour: number
    }[]
    mostRippedSpecies: { species: string; totalBF: number }[]
    workDays: number
  }
}

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

// Order thicknesses consistently
const orderThicknesses = (thicknesses: string[]): string[] => {
  const order = ['4/4', '5/4', '6/4', '7/4', '8/4']
  return thicknesses.sort((a, b) => {
    const aIdx = order.indexOf(a)
    const bIdx = order.indexOf(b)
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
    if (aIdx !== -1) return -1
    if (bIdx !== -1) return 1
    return a.localeCompare(b)
  })
}

export default function RipReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // Date state - default to current month
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
  
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Expansion state
  const [expandedThicknesses, setExpandedThicknesses] = useState<Set<string>>(new Set(['4/4']))
  const [expandedSpecies, setExpandedSpecies] = useState<Set<string>>(new Set())
  const [expandedMiscThicknesses, setExpandedMiscThicknesses] = useState<Set<string>>(new Set())
  const [expandedMiscSpecies, setExpandedMiscSpecies] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  async function fetchReport() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/lumber/rip-report?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) {
        const data = await res.json()
        setReportData(data)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-fetch when dates change or on initial load
  useEffect(() => {
    if (status === 'authenticated' && startDate && endDate) {
      fetchReport()
    }
  }, [status, startDate, endDate])

  const toggleThickness = (thickness: string) => {
    setExpandedThicknesses(prev => {
      const next = new Set(prev)
      if (next.has(thickness)) {
        next.delete(thickness)
      } else {
        next.add(thickness)
      }
      return next
    })
  }

  const toggleSpecies = (key: string) => {
    setExpandedSpecies(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleMiscThickness = (thickness: string) => {
    setExpandedMiscThicknesses(prev => {
      const next = new Set(prev)
      if (next.has(thickness)) {
        next.delete(thickness)
      } else {
        next.add(thickness)
      }
      return next
    })
  }

  const toggleMiscSpecies = (key: string) => {
    setExpandedMiscSpecies(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Quick date presets
  const setThisMonth = () => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    setStartDate(first.toISOString().split('T')[0])
    setEndDate(now.toISOString().split('T')[0])
  }

  const setLastMonth = () => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    setStartDate(first.toISOString().split('T')[0])
    setEndDate(last.toISOString().split('T')[0])
  }

  const setThisYear = () => {
    const now = new Date()
    const first = new Date(now.getFullYear(), 0, 1)
    setStartDate(first.toISOString().split('T')[0])
    setEndDate(now.toISOString().split('T')[0])
  }

  const setLastYear = () => {
    const now = new Date()
    const first = new Date(now.getFullYear() - 1, 0, 1)
    const last = new Date(now.getFullYear() - 1, 11, 31)
    setStartDate(first.toISOString().split('T')[0])
    setEndDate(last.toISOString().split('T')[0])
  }

  // Calculate thickness totals for regular data - MUST be before any early returns
  const thicknessTotals = useMemo(() => {
    if (!reportData) return {}
    const totals: Record<string, { totalBF: number; packCount: number; loadCount: number }> = {}
    
    for (const [thickness, speciesData] of Object.entries(reportData.regularData)) {
      totals[thickness] = { totalBF: 0, packCount: 0, loadCount: 0 }
      
      for (const [, gradeData] of Object.entries(speciesData)) {
        for (const [, data] of Object.entries(gradeData)) {
          totals[thickness].totalBF += data.totalBF
          totals[thickness].packCount += data.packCount
          totals[thickness].loadCount += data.loadCount
        }
      }
    }
    return totals
  }, [reportData])

  // Calculate species totals for regular data
  const speciesTotals = useMemo(() => {
    if (!reportData) return {}
    const totals: Record<string, { totalBF: number; packCount: number; loadCount: number }> = {}
    
    for (const [thickness, speciesData] of Object.entries(reportData.regularData)) {
      for (const [species, gradeData] of Object.entries(speciesData)) {
        const key = `${thickness}-${species}`
        totals[key] = { totalBF: 0, packCount: 0, loadCount: 0 }
        
        for (const [, data] of Object.entries(gradeData)) {
          totals[key].totalBF += data.totalBF
          totals[key].packCount += data.packCount
          totals[key].loadCount += data.loadCount
        }
      }
    }
    return totals
  }, [reportData])

  // Calculate misc thickness totals
  const miscThicknessTotals = useMemo(() => {
    if (!reportData) return {}
    const totals: Record<string, { totalBF: number; packCount: number }> = {}
    
    for (const [thickness, speciesData] of Object.entries(reportData.miscData)) {
      totals[thickness] = { totalBF: 0, packCount: 0 }
      
      for (const [, gradeData] of Object.entries(speciesData)) {
        for (const [, data] of Object.entries(gradeData)) {
          totals[thickness].totalBF += data.totalBF
          totals[thickness].packCount += data.packCount
        }
      }
    }
    return totals
  }, [reportData])

  // Calculate misc species totals
  const miscSpeciesTotals = useMemo(() => {
    if (!reportData) return {}
    const totals: Record<string, { totalBF: number; packCount: number }> = {}
    
    for (const [thickness, speciesData] of Object.entries(reportData.miscData)) {
      for (const [species, gradeData] of Object.entries(speciesData)) {
        const key = `${thickness}-${species}`
        totals[key] = { totalBF: 0, packCount: 0 }
        
        for (const [, data] of Object.entries(gradeData)) {
          totals[key].totalBF += data.totalBF
          totals[key].packCount += data.packCount
        }
      }
    }
    return totals
  }, [reportData])

  // Loading state - AFTER all hooks
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
        <h1 className="text-3xl font-bold text-gray-900">Rip Production Report</h1>
        <p className="text-gray-600 mt-1">View rip production statistics by date range</p>
      </div>

      {/* Date Range Selection */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-sm">Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
            <span className="text-gray-500">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={setThisMonth}>This Month</Button>
            <Button variant="outline" size="sm" onClick={setLastMonth}>Last Month</Button>
            <Button variant="outline" size="sm" onClick={setThisYear}>This Year</Button>
            <Button variant="outline" size="sm" onClick={setLastYear}>Last Year</Button>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              Loading...
            </div>
          )}
        </div>
      </div>

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-800 font-medium">Total Board Feet</span>
              </div>
              <div className="text-2xl font-bold text-blue-900 mt-1">
                {reportData.totals.grandTotalBF.toLocaleString()}
              </div>
              <div className="text-xs text-blue-600 mt-0.5">
                {reportData.totals.grandTotalPacks} packs ripped
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-800 font-medium">BF Per Hour</span>
              </div>
              <div className="text-2xl font-bold text-green-900 mt-1">
                {reportData.statistics.bfPerHour.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-green-600 mt-0.5">
                {reportData.statistics.totalHours.toFixed(1)} total hours
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                <span className="text-sm text-purple-800 font-medium">Avg Stackers</span>
              </div>
              <div className="text-2xl font-bold text-purple-900 mt-1">
                {reportData.statistics.averageStackers.toFixed(1)}
              </div>
              <div className="text-xs text-purple-600 mt-0.5">
                per pack
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-orange-600" />
                <span className="text-sm text-orange-800 font-medium">Work Days</span>
              </div>
              <div className="text-2xl font-bold text-orange-900 mt-1">
                {reportData.statistics.workDays}
              </div>
              <div className="text-xs text-orange-600 mt-0.5">
                days with hours logged
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Regular Packs Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-gray-800 text-white">
                <h2 className="text-sm font-semibold">R&R Packs Ripped</h2>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  {reportData.totals.regularPacks} packs • {reportData.totals.regularLoads} loads • {reportData.totals.regularBF.toLocaleString()} BF
                </p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Thickness / Species / Grade</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Loads</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Packs</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">BF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.keys(reportData.regularData).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                          No packs ripped in this date range
                        </td>
                      </tr>
                    ) : (
                      orderThicknesses(Object.keys(reportData.regularData)).map((thickness) => {
                        const isExpanded = expandedThicknesses.has(thickness)
                        const thickTotal = thicknessTotals[thickness] || { totalBF: 0, packCount: 0, loadCount: 0 }
                        
                        return (
                          <React.Fragment key={`regular-${thickness}`}>
                            {/* Thickness Row */}
                            <tr 
                              className={`bg-gray-100 hover:bg-gray-200 cursor-pointer border-l-4 ${getThicknessBorderColor(thickness)}`}
                              onClick={() => toggleThickness(thickness)}
                            >
                              <td className="px-2 py-2">
                                <button className="text-gray-600 hover:text-gray-900">
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-gray-900">
                                {thickness}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-gray-700 text-right">
                                {thickTotal.loadCount}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-gray-700 text-right">
                                {thickTotal.packCount}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-blue-600 text-right">
                                {thickTotal.totalBF.toLocaleString()}
                              </td>
                            </tr>

                            {/* Species Rows */}
                            {isExpanded && Object.keys(reportData.regularData[thickness]).sort().map((species) => {
                              const speciesKey = `${thickness}-${species}`
                              const isSpeciesExpanded = expandedSpecies.has(speciesKey)
                              const speciesTotal = speciesTotals[speciesKey] || { totalBF: 0, packCount: 0, loadCount: 0 }

                              return (
                                <React.Fragment key={speciesKey}>
                                  <tr 
                                    className={`bg-gray-50 hover:bg-gray-100 cursor-pointer border-l-4 ${getThicknessBorderColor(thickness)}`}
                                    onClick={() => toggleSpecies(speciesKey)}
                                  >
                                    <td className="px-2 py-1.5 pl-6">
                                      <button className="text-gray-500 hover:text-gray-700">
                                        {isSpeciesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      </button>
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400">└</span>
                                        <span className="font-semibold">{species}</span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-gray-600 text-right">
                                      {speciesTotal.loadCount}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-gray-600 text-right">
                                      {speciesTotal.packCount}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 text-right">
                                      {speciesTotal.totalBF.toLocaleString()}
                                    </td>
                                  </tr>

                                  {/* Grade Rows */}
                                  {isSpeciesExpanded && Object.keys(reportData.regularData[thickness][species]).sort().map((grade) => {
                                    const data = reportData.regularData[thickness][species][grade]
                                    return (
                                      <tr 
                                        key={`${speciesKey}-${grade}`}
                                        className={`bg-white hover:bg-gray-50 border-l-4 ${getThicknessBorderColor(thickness)}`}
                                      >
                                        <td className="px-2 py-1.5 pl-10"></td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                                          <div className="flex items-center gap-1.5 pl-4">
                                            <span className="text-gray-300">└</span>
                                            <span className="font-medium">{grade}</span>
                                          </div>
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-500 text-right">
                                          {data.loadCount}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-500 text-right">
                                          {data.packCount}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-blue-600 text-right">
                                          {data.totalBF.toLocaleString()}
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

            {/* Misc Packs Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-amber-700 text-white">
                <h2 className="text-sm font-semibold">Misc Rip Packs</h2>
                <p className="text-[10px] text-amber-100 mt-0.5">
                  {reportData.totals.miscPacks} packs • {reportData.totals.miscBF.toLocaleString()} BF
                </p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase">Thickness / Species / Grade</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">Packs</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase">BF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.keys(reportData.miscData).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                          No misc packs ripped in this date range
                        </td>
                      </tr>
                    ) : (
                      orderThicknesses(Object.keys(reportData.miscData)).map((thickness) => {
                        const isExpanded = expandedMiscThicknesses.has(thickness)
                        const thickTotal = miscThicknessTotals[thickness] || { totalBF: 0, packCount: 0 }
                        
                        return (
                          <React.Fragment key={`misc-${thickness}`}>
                            {/* Thickness Row */}
                            <tr 
                              className={`bg-amber-50 hover:bg-amber-100 cursor-pointer border-l-4 ${getThicknessBorderColor(thickness)}`}
                              onClick={() => toggleMiscThickness(thickness)}
                            >
                              <td className="px-2 py-2">
                                <button className="text-amber-700 hover:text-amber-900">
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-amber-900">
                                {thickness}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-amber-700 text-right">
                                {thickTotal.packCount}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-amber-700 text-right">
                                {thickTotal.totalBF.toLocaleString()}
                              </td>
                            </tr>

                            {/* Species Rows */}
                            {isExpanded && Object.keys(reportData.miscData[thickness]).sort().map((species) => {
                              const speciesKey = `misc-${thickness}-${species}`
                              const isSpeciesExpanded = expandedMiscSpecies.has(speciesKey)
                              const speciesTotal = miscSpeciesTotals[`${thickness}-${species}`] || { totalBF: 0, packCount: 0 }

                              return (
                                <React.Fragment key={speciesKey}>
                                  <tr 
                                    className={`bg-amber-50/50 hover:bg-amber-100/50 cursor-pointer border-l-4 ${getThicknessBorderColor(thickness)}`}
                                    onClick={() => toggleMiscSpecies(speciesKey)}
                                  >
                                    <td className="px-2 py-1.5 pl-6">
                                      <button className="text-amber-600 hover:text-amber-800">
                                        {isSpeciesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      </button>
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-amber-400">└</span>
                                        <span className="font-semibold">{species}</span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-amber-600 text-right">
                                      {speciesTotal.packCount}
                                    </td>
                                    <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-amber-600 text-right">
                                      {speciesTotal.totalBF.toLocaleString()}
                                    </td>
                                  </tr>

                                  {/* Grade Rows */}
                                  {isSpeciesExpanded && Object.keys(reportData.miscData[thickness][species]).sort().map((grade) => {
                                    const data = reportData.miscData[thickness][species][grade]
                                    return (
                                      <tr 
                                        key={`${speciesKey}-${grade}`}
                                        className={`bg-white hover:bg-amber-50 border-l-4 ${getThicknessBorderColor(thickness)}`}
                                      >
                                        <td className="px-2 py-1.5 pl-10"></td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                                          <div className="flex items-center gap-1.5 pl-4">
                                            <span className="text-amber-300">└</span>
                                            <span className="font-medium">{grade}</span>
                                          </div>
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-amber-500 text-right">
                                          {data.packCount}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-amber-500 text-right">
                                          {data.totalBF.toLocaleString()}
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
          </div>

          {/* Grand Totals */}
          <div className="bg-gray-800 text-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Grand Totals
            </h3>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <div className="text-xs text-gray-400">R&R Board Feet</div>
                <div className="text-xl font-bold">{reportData.totals.regularBF.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Misc Board Feet</div>
                <div className="text-xl font-bold text-amber-400">{reportData.totals.miscBF.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Combined Total</div>
                <div className="text-xl font-bold text-blue-400">{reportData.totals.grandTotalBF.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Total Packs</div>
                <div className="text-xl font-bold">{reportData.totals.grandTotalPacks.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Unique Loads</div>
                <div className="text-xl font-bold">{reportData.totals.regularLoads}</div>
              </div>
            </div>
          </div>

          {/* Statistics Section */}
          <div className="grid grid-cols-2 gap-4">
            {/* Operator Stats */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-indigo-600 text-white">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Operator Performance
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Operator</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Packs</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Board Feet</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">Hours</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">BF/Hour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.statistics.operatorStats.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
                          No operator data available
                        </td>
                      </tr>
                    ) : (
                      reportData.statistics.operatorStats.map((op, idx) => (
                        <tr key={op.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                            {op.name}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                            {op.packCount}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
                            {op.totalBF.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                            {op.totalHours.toFixed(1)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                            {op.bfPerHour.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Most Ripped Species */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-emerald-600 text-white">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Top Species Ripped
                </h2>
              </div>
              <div className="p-4">
                {reportData.statistics.mostRippedSpecies.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-4">
                    No species data available
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reportData.statistics.mostRippedSpecies.map((item, idx) => {
                      const maxBF = reportData.statistics.mostRippedSpecies[0]?.totalBF || 1
                      const percentage = (item.totalBF / maxBF) * 100
                      
                      return (
                        <div key={item.species}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {idx + 1}. {item.species}
                            </span>
                            <span className="text-sm font-bold text-emerald-600">
                              {item.totalBF.toLocaleString()} BF
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-emerald-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
