'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Calculator, Loader2, Printer, Copy, Pencil, ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'

interface MachineStep {
  id: string
  machine_name_snapshot: string
  rate_per_hour_snapshot: number
  setup_cost_snapshot: number
  throughput_unit_snapshot: string
  throughput_rate_snapshot: number
  time_required_hours: number
  machine_cost_total: number
  step_order: number
}

interface Quote {
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
  width_inches: number | null
  thickness_inches: number | null
  length_inches: number | null
  yield_percent_used: number
  lumber_cost_per_bf: number
  rough_bf_required: number
  lumber_cost_total: number
  tooling_surcharges: { description: string; amount: number }[]
  total_cost: number
  margin_percent_applied: number
  final_price: number
  margin_1_snapshot: number | null
  margin_2_snapshot: number | null
  margin_3_snapshot: number | null
  notes: string | null
  created_at: string
  machine_steps: MachineStep[]
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
}

const UNIT_LABELS: Record<string, string> = {
  LF: 'Lineal Feet',
  BF: 'Board Feet',
  PIECES: 'Pieces',
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const quoteId = params?.id as string

  const fetchQuote = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/rnr/quotes/${quoteId}`)
      if (!res.ok) throw new Error('Failed')
      setQuote(await res.json())
    } catch {
      toast.error('Failed to load quote')
    } finally {
      setIsLoading(false)
    }
  }, [quoteId])

  useEffect(() => { fetchQuote() }, [fetchQuote])

  async function updateStatus(newStatus: string) {
    setIsUpdatingStatus(true)
    try {
      const res = await fetch(`/api/rnr/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setQuote(updated)
      toast.success(`Status updated to ${newStatus}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (isLoading || !quote) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  const surcharges = Array.isArray(quote.tooling_surcharges) ? quote.tooling_surcharges : []
  const totalSurcharges = surcharges.reduce((a, s) => a + (s.amount || 0), 0)
  const totalMachineCost = quote.machine_steps.reduce((a, s) => a + Number(s.machine_cost_total), 0)
  const profit = Number(quote.final_price) - Number(quote.total_cost)

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push('/dashboard/rnr-office/quotes')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Quotes
      </button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Calculator className="h-7 w-7 text-amber-600" />
              {quote.quote_number}
            </h1>
            <Badge className={`${STATUS_COLORS[quote.status]} text-sm`}>{quote.status}</Badge>
          </div>
          <div className="text-sm text-gray-500 space-x-4">
            <span>{new Date(quote.created_at).toLocaleDateString()}</span>
            <span>{quote.customer_name}</span>
            {quote.job_reference && <span>Ref: {quote.job_reference}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <Select value={quote.status} onValueChange={updateStatus} disabled={isUpdatingStatus}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="DECLINED">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {quote.status === 'DRAFT' && (
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => router.push(`/dashboard/rnr-office/quotes/new?edit=${quoteId}`)}>
              <Pencil size={14} /> Edit
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1"
            onClick={() => router.push(`/dashboard/rnr-office/quotes/new?duplicate=${quoteId}`)}>
            <Copy size={14} /> Duplicate
          </Button>
          <Button variant="outline" size="sm" className="gap-1"
            onClick={() => window.open(`/dashboard/rnr-office/quotes/${quoteId}/print/customer`, '_blank')}>
            <Printer size={14} /> Customer
          </Button>
          <Button variant="outline" size="sm" className="gap-1"
            onClick={() => window.open(`/dashboard/rnr-office/quotes/${quoteId}/print/internal`, '_blank')}>
            <Printer size={14} /> Internal
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Full breakdown */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Product Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Product:</span> <span className="font-medium">{quote.product_name_snapshot}</span></div>
              <div><span className="text-gray-500">Species / Grade:</span> <span className="font-medium">{quote.species} / {quote.grade}</span></div>
              <div><span className="text-gray-500">Quantity:</span> <span className="font-medium">{Number(quote.quantity)} {UNIT_LABELS[quote.unit_type]}</span></div>
              <div><span className="text-gray-500">Yield:</span> <span className="font-medium">{Number(quote.yield_percent_used)}%</span></div>
              {quote.width_inches && <div><span className="text-gray-500">Dimensions:</span> <span className="font-medium">{Number(quote.width_inches)}" W x {Number(quote.thickness_inches)}" T x {Number(quote.length_inches)}" L</span></div>}
            </div>
          </div>

          {/* Lumber */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Lumber</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Rough BF Required:</span><span className="font-mono">{Number(quote.rough_bf_required).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Cost per BF:</span><span className="font-mono">${Number(quote.lumber_cost_per_bf).toFixed(4)}</span></div>
              <div className="flex justify-between font-medium"><span>Lumber Total:</span><span className="font-mono">${Number(quote.lumber_cost_total).toFixed(2)}</span></div>
            </div>
          </div>

          {/* Machine Steps */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Machine Steps</h3>
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">Machine</th>
                  <th className="text-right pb-2">Rate/Hr</th>
                  <th className="text-right pb-2">Setup</th>
                  <th className="text-right pb-2">Time (hrs)</th>
                  <th className="text-right pb-2">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quote.machine_steps.map((ms) => (
                  <tr key={ms.id}>
                    <td className="py-1.5 text-gray-400">{ms.step_order}</td>
                    <td className="py-1.5">{ms.machine_name_snapshot}</td>
                    <td className="py-1.5 text-right font-mono">${Number(ms.rate_per_hour_snapshot).toFixed(2)}</td>
                    <td className="py-1.5 text-right font-mono">${Number(ms.setup_cost_snapshot).toFixed(2)}</td>
                    <td className="py-1.5 text-right font-mono">{Number(ms.time_required_hours).toFixed(3)}</td>
                    <td className="py-1.5 text-right font-mono font-medium">${Number(ms.machine_cost_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t">
                  <td colSpan={5} className="pt-2 text-right">Machine Total:</td>
                  <td className="pt-2 text-right font-mono">${totalMachineCost.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Surcharges */}
          {surcharges.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Tooling Surcharges</h3>
              <div className="text-sm space-y-1">
                {surcharges.map((s, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">{s.description}</span>
                    <span className="font-mono">${s.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Surcharge Total:</span>
                  <span className="font-mono">${totalSurcharges.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {quote.notes && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Internal Notes</h3>
              <p className="text-sm text-gray-600">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Summary card */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sticky top-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Price Summary</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Lumber:</span><span className="font-mono">${Number(quote.lumber_cost_total).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Machines:</span><span className="font-mono">${totalMachineCost.toFixed(2)}</span></div>
              {totalSurcharges > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Surcharges:</span><span className="font-mono">${totalSurcharges.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total Cost:</span>
                <span className="font-mono">${Number(quote.total_cost).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Margin Applied:</span>
                <span>{Number(quote.margin_percent_applied)}%</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2 text-amber-700">
                <span>Final Price:</span>
                <span className="font-mono">${Number(quote.final_price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span className="text-gray-500">Profit:</span>
                <span className="font-mono">${profit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
