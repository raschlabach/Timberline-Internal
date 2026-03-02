'use client'

import { forwardRef } from 'react'
import { FreightSkid } from './skid-editor'

interface FreightPrintViewProps {
  customer: string
  poNumber: string
  skids: FreightSkid[]
}

export const FreightPrintView = forwardRef<HTMLDivElement, FreightPrintViewProps>(
  function FreightPrintView({ customer, poNumber, skids }, ref) {
    const totalWeight = skids.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0)

    if (skids.length === 0) {
      return (
        <div className="text-center py-12 text-gray-400">
          No skids to display. Add skids in the editor first.
        </div>
      )
    }

    const headerCls = "px-3 py-2 text-xs font-semibold text-gray-600 border-b-2 border-gray-300 bg-gray-50"
    const cellCls = "px-3 py-2.5 text-sm"

    return (
      <div>
        {/* On-screen preview */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className={headerCls + ' text-center w-16'}>Skid #</th>
                <th className={headerCls + ' text-left'}>PO #</th>
                <th className={headerCls + ' text-right'}>Width</th>
                <th className={headerCls + ' text-right'}>Length</th>
                <th className={headerCls + ' text-right'}>Height</th>
                <th className={headerCls + ' text-right'}>Weight (lbs)</th>
              </tr>
            </thead>
            <tbody>
              {skids.map((skid, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className={cellCls + ' text-center font-medium'}>{skid.skid_number || idx + 1}</td>
                  <td className={cellCls}>{skid.po_number || '—'}</td>
                  <td className={cellCls + ' text-right'}>{skid.width || '—'}</td>
                  <td className={cellCls + ' text-right'}>{skid.length || '—'}</td>
                  <td className={cellCls + ' text-right'}>{skid.height || '—'}</td>
                  <td className={cellCls + ' text-right font-medium'}>{skid.weight ? parseFloat(skid.weight).toLocaleString() : '—'}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td colSpan={5} className="px-3 py-2.5 text-sm font-semibold text-right">
                  Total ({skids.length} skid{skids.length !== 1 ? 's' : ''}):
                </td>
                <td className="px-3 py-2.5 text-sm font-bold text-right">
                  {totalWeight.toLocaleString()} lbs
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Hidden printable version */}
        <div className="hidden">
          <div ref={ref} className="p-8 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="mb-6 pb-4 border-b-2 border-gray-400">
              <h1 className="text-xl font-bold mb-3">RNR Shipping Report</h1>
              <div className="flex gap-8 text-sm">
                <span><strong>Customer:</strong> {customer || '—'}</span>
                <span><strong>PO #:</strong> {poNumber || '—'}</span>
                <span><strong>Skids:</strong> {skids.length}</span>
                <span><strong>Total Weight:</strong> {totalWeight.toLocaleString()} lbs</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Printed {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-center font-semibold">Skid #</th>
                  <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-left font-semibold">PO #</th>
                  <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-right font-semibold">Width</th>
                  <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-right font-semibold">Length</th>
                  <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-right font-semibold">Height</th>
                  <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-right font-semibold">Weight (lbs)</th>
                </tr>
              </thead>
              <tbody>
                {skids.map((skid, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-300 px-3 py-2 text-center font-medium">{skid.skid_number || idx + 1}</td>
                    <td className="border border-gray-300 px-3 py-2">{skid.po_number || '—'}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right">{skid.width || '—'}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right">{skid.length || '—'}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right">{skid.height || '—'}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium">{skid.weight ? parseFloat(skid.weight).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="border border-gray-300 px-3 py-2 text-right font-bold bg-gray-50">
                    Total ({skids.length} skid{skids.length !== 1 ? 's' : ''}):
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-bold bg-gray-50">
                    {totalWeight.toLocaleString()} lbs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }
)
