'use client'

import { ReportLineItem } from './report-editor'

interface GroupedViewProps {
  items: ReportLineItem[]
}

interface GroupedItemCode {
  item_code: string
  part_width: number | null
  part_length: number | null
  used_for: string | null
  rows: ReportLineItem[]
  totalQty: number
}

export function GroupedView({ items }: GroupedViewProps) {
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

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No items to display. Add items in the edit view first.
      </div>
    )
  }

  const headerCls = "px-2 py-1.5 text-xs font-medium text-gray-500"
  const cellCls = "px-2 py-1.5 text-xs"

  return (
    <div className="space-y-4">
      {groups.map((group, gIdx) => (
        <div key={gIdx} className="bg-white rounded-lg border overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-3 py-2 flex items-center justify-between">
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
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
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
    </div>
  )
}
