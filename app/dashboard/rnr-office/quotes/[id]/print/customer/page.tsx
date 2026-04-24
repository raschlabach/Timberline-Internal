'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Quote {
  quote_number: string
  customer_name: string
  job_reference: string | null
  product_name_snapshot: string
  species: string
  grade: string
  quantity: number
  unit_type: string
  final_price: number
  notes: string | null
  created_at: string
}

const UNIT_LABELS: Record<string, string> = {
  LF: 'Lineal Feet',
  BF: 'Board Feet',
  PIECES: 'Pieces',
}

export default function CustomerPrintPage() {
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

  return (
    <>
      <style jsx global>{`
        aside, header, nav { display: none !important; }
        main { padding: 0 !important; }
        main > div { padding: 0 !important; }
        .flex.h-screen { display: block !important; }
        @media print {
          body { margin: 0; padding: 0; }
          @page { margin: 0.75in; size: letter; }
        }
      `}</style>

      <div className="max-w-[700px] mx-auto p-8 font-sans print:p-0">
        {/* Header */}
        <div className="border-b-2 border-gray-900 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">RNR Enterprises</h1>
          <p className="text-sm text-gray-500 mt-1">Custom Wood Products</p>
        </div>

        {/* Quote Info */}
        <div className="flex justify-between mb-8">
          <div>
            <div className="text-sm text-gray-500">Quote Number</div>
            <div className="text-lg font-bold font-mono">{quote.quote_number}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Date</div>
            <div className="font-medium">{new Date(quote.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Customer */}
        <div className="mb-8">
          <div className="text-sm text-gray-500 mb-1">Prepared For</div>
          <div className="text-lg font-semibold">{quote.customer_name}</div>
          {quote.job_reference && (
            <div className="text-sm text-gray-600">Job Reference: {quote.job_reference}</div>
          )}
        </div>

        {/* Product Details */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Species / Grade</th>
                <th className="text-right px-4 py-3 font-semibold">Quantity</th>
                <th className="text-right px-4 py-3 font-semibold">Total Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3">{quote.product_name_snapshot}</td>
                <td className="px-4 py-3">{quote.species} / {quote.grade}</td>
                <td className="px-4 py-3 text-right">{Number(quote.quantity).toLocaleString()} {UNIT_LABELS[quote.unit_type]}</td>
                <td className="px-4 py-3 text-right font-bold text-lg font-mono">${Number(quote.final_price).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="flex justify-end mb-8">
          <div className="text-right">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold font-mono">${Number(quote.final_price).toFixed(2)}</div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="border-t border-gray-200 pt-4 mb-8">
            <div className="text-sm text-gray-500 mb-1">Notes</div>
            <p className="text-sm text-gray-700">{quote.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 text-xs text-gray-400 text-center">
          <p>This quote is valid for 30 days from the date above.</p>
          <p className="mt-1">RNR Enterprises &bull; Custom Wood Products</p>
        </div>

        {/* Print button (hidden in print) */}
        <div className="mt-8 text-center print:hidden">
          <button
            onClick={() => window.print()}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
          >
            Print Quote
          </button>
        </div>
      </div>
    </>
  )
}
