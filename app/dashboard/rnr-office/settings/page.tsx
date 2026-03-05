'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Settings, Save, Loader2, Palette, MessageSquare, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { toast } from 'sonner'

interface CustomerSetting {
  customer_id: number
  customer_name: string
  calendar_color: string | null
  settings_id: number | null
  hint_text: string | null
  part_count: number
}

const COLOR_PALETTE = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  '#E11D48', '#84CC16', '#0EA5E9', '#A855F7', '#D946EF',
  '#FB923C', '#2DD4BF', '#4ADE80', '#FACC15', '#38BDF8',
]

export default function RnrSettingsPage() {
  const { data: session } = useSession()
  const [customers, setCustomers] = useState<CustomerSetting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editHints, setEditHints] = useState<Record<number, string>>({})
  const [savingColor, setSavingColor] = useState<number | null>(null)
  const [savingHint, setSavingHint] = useState<number | null>(null)
  const [showPalette, setShowPalette] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchCustomers = useCallback(async () => {
    if (!session) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/rnr/customer-settings')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setCustomers(data)
      const hints: Record<number, string> = {}
      for (const c of data) {
        hints[c.customer_id] = c.hint_text || ''
      }
      setEditHints(hints)
    } catch {
      toast.error('Failed to load customer settings')
    } finally {
      setIsLoading(false)
    }
  }, [session])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  async function saveColor(customerId: number, color: string) {
    setSavingColor(customerId)
    try {
      const res = await fetch('/api/rnr/customer-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, calendar_color: color }),
      })
      if (!res.ok) throw new Error('Failed')
      setCustomers(prev => prev.map(c =>
        c.customer_id === customerId ? { ...c, calendar_color: color } : c
      ))
      setShowPalette(null)
      toast.success('Color saved')
    } catch {
      toast.error('Failed to save color')
    } finally {
      setSavingColor(null)
    }
  }

  async function saveHint(customerId: number) {
    const text = editHints[customerId]?.trim()
    setSavingHint(customerId)
    try {
      if (!text) {
        await fetch(`/api/rnr/customer-parse-hints?customer_id=${customerId}`, { method: 'DELETE' })
        setCustomers(prev => prev.map(c =>
          c.customer_id === customerId ? { ...c, hint_text: null } : c
        ))
        toast.success('Parse hint cleared')
      } else {
        const res = await fetch('/api/rnr/customer-parse-hints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customerId, hint_text: text }),
        })
        if (!res.ok) throw new Error('Failed')
        setCustomers(prev => prev.map(c =>
          c.customer_id === customerId ? { ...c, hint_text: text } : c
        ))
        toast.success('Parse hint saved')
      }
    } catch {
      toast.error('Failed to save parse hint')
    } finally {
      setSavingHint(null)
    }
  }

  function getDisplayColor(c: CustomerSetting): string {
    return c.calendar_color || COLOR_PALETTE[c.customer_id % COLOR_PALETTE.length]
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="h-7 w-7 text-amber-600" />
          RNR Office Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage customer colors for the calendar and AI parsing instructions
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <p className="text-gray-400">No customers found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search customers..."
              className="pl-9"
            />
          </div>
          <div className="space-y-2">
          {customers
            .filter(c => c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(c => {
            const color = getDisplayColor(c)
            const isExpanded = expandedId === c.customer_id
            const hintChanged = (editHints[c.customer_id] || '') !== (c.hint_text || '')

            return (
              <div key={c.customer_id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Color swatch */}
                  <div className="relative">
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-colors shadow-sm"
                      style={{ backgroundColor: color }}
                      onClick={() => setShowPalette(showPalette === c.customer_id ? null : c.customer_id)}
                      title="Change calendar color"
                    />
                    {savingColor === c.customer_id && (
                      <Loader2 size={12} className="absolute -top-1 -right-1 animate-spin text-gray-500" />
                    )}

                    {showPalette === c.customer_id && (
                      <div className="absolute top-10 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1.5 w-[160px]">
                        {COLOR_PALETTE.map(clr => (
                          <button
                            key={clr}
                            type="button"
                            className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                              clr === color ? 'border-gray-800 ring-1 ring-gray-800' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: clr }}
                            onClick={() => saveColor(c.customer_id, clr)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customer info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{c.customer_name}</span>
                      <span className="text-xs text-gray-400">{c.part_count} parts</span>
                    </div>
                    {c.hint_text && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MessageSquare size={11} className="text-amber-500" />
                        <span className="text-[11px] text-amber-600 truncate max-w-[400px]">
                          Parse hint: {c.hint_text.substring(0, 80)}{c.hint_text.length > 80 ? '...' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expand button */}
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : c.customer_id)}
                    className="gap-1.5 text-gray-500"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Collapse' : 'Edit'}
                  </Button>
                </div>

                {/* Expanded edit panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50 space-y-4">
                    {/* Color section */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-2">
                        <Palette size={13} />Calendar Color
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {COLOR_PALETTE.map(clr => (
                          <button
                            key={clr}
                            type="button"
                            className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${
                              clr === color ? 'border-gray-800 ring-2 ring-gray-300 scale-110' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: clr }}
                            onClick={() => saveColor(c.customer_id, clr)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Parse hint section */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-2">
                        <MessageSquare size={13} />AI Parsing Instructions
                      </label>
                      <Textarea
                        value={editHints[c.customer_id] || ''}
                        onChange={e => setEditHints(prev => ({ ...prev, [c.customer_id]: e.target.value }))}
                        placeholder="Enter instructions to help the AI parse this customer's order files correctly. For example: 'The PO Number field is the actual PO. Part numbers appear after Cust P/N on the line below the description.'"
                        className="min-h-[100px] text-sm"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] text-gray-400">
                          These instructions are automatically used when parsing order files for this customer.
                        </p>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                          onClick={() => saveHint(c.customer_id)}
                          disabled={savingHint === c.customer_id || !hintChanged}
                        >
                          {savingHint === c.customer_id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Save size={13} />
                          )}
                          {hintChanged ? 'Save Hint' : 'Saved'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}
    </div>
  )
}
