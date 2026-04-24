'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calculator, Plus, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

interface QuoteRow {
  id: string
  quote_number: string
  status: string
  customer_name: string
  job_reference: string | null
  product_name_snapshot: string
  species: string
  grade: string
  quantity: number
  unit_type: string
  final_price: number
  created_at: string
}

const STATUS_TABS = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'] as const

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
}

export default function QuoteHistoryPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchQuotes = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/rnr/quotes?${params.toString()}`)
      if (!res.ok) throw new Error('Failed')
      setQuotes(await res.json())
    } catch {
      toast.error('Failed to load quotes')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Calculator className="h-7 w-7 text-amber-600" />
            Quotes
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track all RNR quotes.</p>
        </div>
        <Button onClick={() => router.push('/dashboard/rnr-office/quotes/new')} className="gap-2 bg-amber-600 hover:bg-amber-700">
          <Plus size={16} /> New Quote
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                statusFilter === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer or quote #..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Quote #</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Species / Grade</th>
                <th className="text-left px-4 py-3">Unit</th>
                <th className="text-right px-4 py-3">Final Price</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => router.push(`/dashboard/rnr-office/quotes/${q.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-medium text-amber-700">{q.quote_number}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(q.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{q.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{q.product_name_snapshot}</td>
                  <td className="px-4 py-3 text-gray-600">{q.species} / {q.grade}</td>
                  <td className="px-4 py-3 text-gray-600">{q.quantity} {q.unit_type}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">${Number(q.final_price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={STATUS_COLORS[q.status] || 'bg-gray-100'}>{q.status}</Badge>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No quotes found. Create your first quote to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
