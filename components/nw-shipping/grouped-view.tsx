'use client'

import { forwardRef } from 'react'
import { ReportLineItem } from './report-editor'

interface GroupedViewProps {
  items: ReportLineItem[]
  northwestPo?: string
  archboldPo?: string
}

interface GroupedItemCode {
  item_code: string
  part_width: number | null
  part_length: number | null
  used_for: string | null
  rows: ReportLineItem[]
  totalQty: number
}

function buildGroups(items: ReportLineItem[]): GroupedItemCode[] {
  const groups: GroupedItemCode[] = []
  const itemsByCode: Record<string, ReportLineItem[]> = {}
  const unassigned: ReportLineItem[] = []

  for (const item of items) {
    const code = item.item_code || ''
    if (!code) {
      unassigned.push(item)
      continue
    }
    if (!itemsByCode[code]) itemsByCode[code] = []
    itemsByCode[code].push(item)
  }

  const sortedCodes = Object.keys(itemsByCode).sort()

  for (const code of sortedCodes) {
    const rows = itemsByCode[code].sort((a, b) => {
      const aNum = parseInt(a.pallet_number) || 0
      const bNum = parseInt(b.pallet_number) || 0
      if (aNum !== bNum) return aNum - bNum
      return (a.pallet_number || '').localeCompare(b.pallet_number || '')
    })
    const totalQty = rows.reduce((sum, r) => sum + (parseInt(r.qty_per_skid) || 0), 0)
    const first = rows[0]

    groups.push({
      item_code: code,
      part_width: first.part_width ?? null,
      part_length: first.part_length ?? null,
      used_for: first.used_for ?? null,
      rows,
      totalQty,
    })
  }

  if (unassigned.length > 0) {
    const totalQty = unassigned.reduce((sum, r) => sum + (parseInt(r.qty_per_skid) || 0), 0)
    groups.push({
      item_code: '(No Item Code)',
      part_width: null,
      part_length: null,
      used_for: null,
      rows: unassigned,
      totalQty,
    })
  }

  return groups
}

function GroupContent({ groups, northwestPo, archboldPo, showHeader }: {
  groups: GroupedItemCode[]
  northwestPo?: string
  archboldPo?: string
  showHeader?: boolean
}) {
  const headerCls = "px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-300"
  const cellCls = "px-2 py-1.5 text-xs"
  const grandTotal = groups.reduce((sum, g) => sum + g.totalQty, 0)

  return (
    <>
      {showHeader && (northwestPo || archboldPo) && (
        <div className="mb-4 pb-3 border-b-2 border-gray-300">
          <h2 className="text-lg font-bold">Northwest Shipping Report</h2>
          <div className="flex gap-6 mt-1 text-sm">
            {northwestPo && <span><strong>NW PO #:</strong> {northwestPo}</span>}
            {archboldPo && <span><strong>Archbold PO #:</strong> {archboldPo}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      )}
      {groups.map((group, gIdx) => (
        <div key={gIdx} className="mb-4 break-inside-avoid">
          <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm text-blue-800">{group.item_code}</span>
              {group.part_width != null && group.part_length != null && (
                <span className="text-xs text-blue-600">{group.part_width} × {group.part_length}</span>
              )}
              {group.used_for && (
                <span className="text-xs text-blue-500">— {group.used_for}</span>
              )}
            </div>
            <div className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
              Total Qty: {group.totalQty}
            </div>
          </div>
          <table className="w-full border border-t-0 border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className={headerCls + ' text-left w-20'}>Pallet #</th>
                <th className={headerCls + ' text-left w-24'}>Pallet Tag</th>
                <th className={headerCls + ' text-right w-20'}>Qty/Skid</th>
                <th className={headerCls + ' text-right w-20'}>Skid W</th>
                <th className={headerCls + ' text-right w-20'}>Skid L</th>
                <th className={headerCls + ' text-right w-20'}>Skid H</th>
                <th className={headerCls + ' text-right w-24'}>Skid Weight</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-gray-100">
                  <td className={cellCls + ' font-medium'}>{row.pallet_number || '—'}</td>
                  <td className={cellCls}>{row.pallet_tag || '—'}</td>
                  <td className={cellCls + ' text-right font-medium'}>{row.qty_per_skid || '—'}</td>
                  <td className={cellCls + ' text-right text-gray-600'}>{row.skid_width || '—'}</td>
                  <td className={cellCls + ' text-right text-gray-600'}>{row.skid_length || '—'}</td>
                  <td className={cellCls + ' text-right text-gray-600'}>{row.skid_height || '—'}</td>
                  <td className={cellCls + ' text-right text-gray-600'}>{row.skid_weight || '—'}</td>
                </tr>
              ))}
              <tr className="bg-blue-50/50">
                <td colSpan={2} className="px-2 py-1.5 text-xs font-semibold text-blue-800 text-right">
                  Group Total:
                </td>
                <td className="px-2 py-1.5 text-xs font-bold text-blue-800 text-right">
                  {group.totalQty}
                </td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      {showHeader && groups.length > 1 && (
        <div className="mt-2 pt-2 border-t-2 border-gray-300 flex justify-end">
          <span className="text-sm font-bold">Grand Total Qty: {grandTotal}</span>
        </div>
      )}
    </>
  )
}

export const GroupedView = forwardRef<HTMLDivElement, GroupedViewProps>(
  function GroupedView({ items, northwestPo, archboldPo }, ref) {
    const groups = buildGroups(items)

    if (groups.length === 0) {
      return (
        <div className="text-center py-12 text-gray-400">
          No items to display. Add items in the edit view first.
        </div>
      )
    }

    return (
      <div>
        {/* On-screen view */}
        <div className="space-y-4">
          <GroupContent groups={groups} />
        </div>

        {/* Hidden printable version with header */}
        <div className="hidden">
          <div ref={ref} className="p-6 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <GroupContent groups={groups} northwestPo={northwestPo} archboldPo={archboldPo} showHeader />
          </div>
        </div>
      </div>
    )
  }
)
