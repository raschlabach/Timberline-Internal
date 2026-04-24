'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface MachineStep {
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
  quote_number: string
  customer_name: string
  job_reference: string | null
  product_name_snapshot: string
  species: string
  grade: string
  quantity: number
  unit_type: string
  yield_percent_used: number
  lumber_cost_per_bf: number
  rough_bf_required: number
  lumber_cost_total: number
  tooling_surcharges: { description: string; amount: number }[]
  total_cost: number
  margin_percent_applied: number
  final_price: number
  notes: string | null
  created_at: string
  machine_steps: MachineStep[]
}

const UNIT_LABELS: Record<string, string> = {
  LF: 'Lineal Feet',
  BF: 'Board Feet',
  PIECES: 'Pieces',
}

const THROUGHPUT_LABELS: Record<string, string> = {
  LF_HR: 'LF/Hr',
  BF_HR: 'BF/Hr',
  PIECES_HR: 'Pcs/Hr',
}

export default function InternalPrintPage() {
  const params = useParams()
  const [quote, setQuote] = useState<Quote | null>(null)

  const quoteId = params?.id as string

  useEffect(() => {
    if (!quoteId) return
    async function load() {
      try {
        const res = await fetch(`/api/rnr/quotes/${quoteId}`)
        if (res.ok) setQuote(await res.json())
      } catch { /* ignore */ }
    }
    load()
  }, [quoteId])

  if (!quote) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>
  }

  const surcharges = Array.isArray(quote.tooling_surcharges) ? quote.tooling_surcharges : []
  const totalSurcharges = surcharges.reduce((a, s) => a + (s.amount || 0), 0)
  const totalMachineCost = quote.machine_steps.reduce((a, s) => a + Number(s.machine_cost_total), 0)
  const profit = Number(quote.final_price) - Number(quote.total_cost)

  return (
    <>
      <style jsx global>{`
        aside, header, nav { display: none !important; }
        main { padding: 0 !important; }
        main > div { padding: 0 !important; }
        .flex.h-screen { display: block !important; }
        @media print {
          body { margin: 0; padding: 0; font-size: 11px; }
          @page { margin: 0.5in; size: letter; }
        }
      `}</style>

      <div className="max-w-[750px] mx-auto p-8 font-sans print:p-0 text-sm">
        {/* Header */}
        <div className="border-b-2 border-gray-900 pb-3 mb-4 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold text-gray-900">RNR Enterprises</h1>
            <p className="text-xs text-gray-500">INTERNAL QUOTE — CONFIDENTIAL</p>
          </div>
          <div className="text-right">
            <div className="font-bold font-mono text-lg">{quote.quote_number}</div>
            <div className="text-xs text-gray-500">{new Date(quote.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Customer & Product Info */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
          <div>
            <span className="text-gray-500">Customer:</span> <span className="font-medium">{quote.customer_name}</span>
            {quote.job_reference && <><br/><span className="text-gray-500">Job Ref:</span> {quote.job_reference}</>}
          </div>
          <div>
            <span className="text-gray-500">Product:</span> <span className="font-medium">{quote.product_name_snapshot}</span><br/>
            <span className="text-gray-500">Species/Grade:</span> {quote.species} / {quote.grade}<br/>
            <span className="text-gray-500">Qty:</span> {Number(quote.quantity)} {UNIT_LABELS[quote.unit_type]}
          </div>
        </div>

        {/* Lumber Section */}
        <div className="border border-gray-200 rounded mb-3">
          <div className="bg-gray-100 px-3 py-1.5 font-semibold text-xs uppercase text-gray-600">Lumber</div>
          <div className="px-3 py-2 space-y-0.5 text-xs">
            <div className="flex justify-between"><span>Species / Grade:</span><span>{quote.species} / {quote.grade}</span></div>
            <div className="flex justify-between"><span>Yield %:</span><span>{Number(quote.yield_percent_used)}%</span></div>
            <div className="flex justify-between"><span>Rough BF Required:</span><span className="font-mono">{Number(quote.rough_bf_required).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Cost per BF:</span><span className="font-mono">${Number(quote.lumber_cost_per_bf).toFixed(4)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1"><span>Lumber Total:</span><span className="font-mono">${Number(quote.lumber_cost_total).toFixed(2)}</span></div>
          </div>
        </div>

        {/* Machine Steps */}
        <div className="border border-gray-200 rounded mb-3">
          <div className="bg-gray-100 px-3 py-1.5 font-semibold text-xs uppercase text-gray-600">Machine Steps</div>
          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left px-3 py-1">#</th>
                <th className="text-left px-3 py-1">Machine</th>
                <th className="text-right px-3 py-1">Throughput</th>
                <th className="text-right px-3 py-1">Time (hrs)</th>
                <th className="text-right px-3 py-1">Rate/Hr</th>
                <th className="text-right px-3 py-1">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quote.machine_steps.map((ms) => (
                <tr key={ms.step_order}>
                  <td className="px-3 py-1 text-gray-400">{ms.step_order}</td>
                  <td className="px-3 py-1">{ms.machine_name_snapshot}</td>
                  <td className="px-3 py-1 text-right font-mono">{Number(ms.throughput_rate_snapshot)} {THROUGHPUT_LABELS[ms.throughput_unit_snapshot] || ms.throughput_unit_snapshot}</td>
                  <td className="px-3 py-1 text-right font-mono">{Number(ms.time_required_hours).toFixed(3)}</td>
                  <td className="px-3 py-1 text-right font-mono">${Number(ms.rate_per_hour_snapshot).toFixed(2)}</td>
                  <td className="px-3 py-1 text-right font-mono font-medium">${Number(ms.machine_cost_total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t">
                <td colSpan={5} className="px-3 py-1 text-right">Machine Total:</td>
                <td className="px-3 py-1 text-right font-mono">${totalMachineCost.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Surcharges */}
        {surcharges.length > 0 && (
          <div className="border border-gray-200 rounded mb-3">
            <div className="bg-gray-100 px-3 py-1.5 font-semibold text-xs uppercase text-gray-600">Tooling Surcharges</div>
            <div className="px-3 py-2 space-y-0.5 text-xs">
              {surcharges.map((s, i) => (
                <div key={i} className="flex justify-between">
                  <span>{s.description}</span>
                  <span className="font-mono">${s.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Surcharge Total:</span>
                <span className="font-mono">${totalSurcharges.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Final Summary */}
        <div className="border-2 border-gray-900 rounded p-3 space-y-1 text-xs">
          <div className="flex justify-between"><span>Lumber:</span><span className="font-mono">${Number(quote.lumber_cost_total).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Machines:</span><span className="font-mono">${totalMachineCost.toFixed(2)}</span></div>
          {totalSurcharges > 0 && (
            <div className="flex justify-between"><span>Surcharges:</span><span className="font-mono">${totalSurcharges.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-bold border-t pt-1 text-sm">
            <span>Total Cost:</span>
            <span className="font-mono">${Number(quote.total_cost).toFixed(2)}</span>
          </div>
          <div className="flex justify-between"><span>Margin Applied:</span><span>{Number(quote.margin_percent_applied)}%</span></div>
          <div className="flex justify-between font-bold text-base border-t pt-1">
            <span>Final Price:</span>
            <span className="font-mono">${Number(quote.final_price).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>Profit:</span>
            <span className="font-mono">${profit.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="mt-3 text-xs">
            <span className="font-semibold">Notes:</span> {quote.notes}
          </div>
        )}

        {/* Print button */}
        <div className="mt-8 text-center print:hidden">
          <button
            onClick={() => window.print()}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
          >
            Print Internal Quote
          </button>
        </div>
      </div>
    </>
  )
}
