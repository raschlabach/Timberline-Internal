"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Wheat, TrendingUp, TrendingDown, Scale, Plus, Trash2, ChevronDown, ChevronUp, Pencil, AlertCircle } from 'lucide-react'

const LBS_PER_BUSHEL = 56
const STANDARD_MOISTURE = 15.5

interface GrainTicket {
  id: number
  ticket_date: string
  ticket_type: 'unload' | 'load'
  gross_weight_lbs: number
  tare_weight_lbs: number
  net_weight_lbs: number
  moisture_percent: number | null
  moisture_deduction_lbs: number
  dockage_percent: number | null
  dockage_deduction_lbs: number
  adjusted_net_weight_lbs: number
  bushels: number
  notes: string | null
  created_at: string
}

interface YearlySettings {
  id: number
  year: number
  starting_amount_lbs: number
  starting_amount_bushels: number
  notes: string | null
}

interface TicketFormData {
  ticket_date: string
  ticket_type: 'unload' | 'load'
  gross_weight_lbs: string
  tare_weight_lbs: string
  net_weight_lbs: string
  moisture_percent: string
  moisture_deduction_lbs: string
  dockage_percent: string
  dockage_deduction_lbs: string
  adjusted_net_weight_lbs: string
  bushels: string
  notes: string
}

function getDefaultFormData(): TicketFormData {
  return {
    ticket_date: new Date().toISOString().split('T')[0],
    ticket_type: 'unload',
    gross_weight_lbs: '',
    tare_weight_lbs: '',
    net_weight_lbs: '',
    moisture_percent: '',
    moisture_deduction_lbs: '',
    dockage_percent: '',
    dockage_deduction_lbs: '',
    adjusted_net_weight_lbs: '',
    bushels: '',
    notes: '',
  }
}

function formatNumber(num: number, decimals = 2): string {
  const n = Number(num)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function GrainDashboard() {
  const [tickets, setTickets] = useState<GrainTicket[]>([])
  const [settings, setSettings] = useState<YearlySettings | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Starting amount dialog
  const [isStartingOpen, setIsStartingOpen] = useState(false)
  const [startingAmount, setStartingAmount] = useState('')
  const [startingUnit, setStartingUnit] = useState<'bushels' | 'lbs'>('bushels')

  // Ticket form dialog
  const [isTicketOpen, setIsTicketOpen] = useState(false)
  const [formData, setFormData] = useState<TicketFormData>(getDefaultFormData())
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  // Edit mode
  const [editingTicket, setEditingTicket] = useState<GrainTicket | null>(null)

  // Delete confirmation
  const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [ticketsRes, settingsRes] = await Promise.all([
        fetch(`/api/grain/tickets?year=${selectedYear}`),
        fetch(`/api/grain/settings?year=${selectedYear}`),
      ])
      const ticketsData = await ticketsRes.json()
      const settingsData = await settingsRes.json()
      setTickets(ticketsData.tickets || [])
      setSettings(settingsData.settings || null)
    } catch (error) {
      console.error('Error fetching grain data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Computed totals (coerce to number; Postgres often returns decimals as strings)
  const totals = useMemo(() => {
    const startBushels = Number(settings?.starting_amount_bushels) || 0

    let totalUnloaded = 0
    let totalLoaded = 0

    for (const ticket of tickets) {
      const bushels = Number(ticket.bushels) || 0
      if (ticket.ticket_type === 'unload') {
        totalUnloaded += bushels
      } else {
        totalLoaded += bushels
      }
    }

    const currentTotal = startBushels + totalUnloaded - totalLoaded

    return {
      startBushels,
      totalUnloaded,
      totalLoaded,
      currentTotal: Number.isFinite(currentTotal) ? currentTotal : 0,
      ticketCount: tickets.length,
    }
  }, [tickets, settings])

  // Auto-calculate net weight when gross/tare change
  function handleWeightChange(field: 'gross_weight_lbs' | 'tare_weight_lbs', value: string) {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      const gross = parseFloat(field === 'gross_weight_lbs' ? value : prev.gross_weight_lbs) || 0
      const tare = parseFloat(field === 'tare_weight_lbs' ? value : prev.tare_weight_lbs) || 0

      if (gross > 0 && tare > 0) {
        const net = gross - tare
        updated.net_weight_lbs = net > 0 ? net.toString() : '0'
        return recalculateFromNet(updated, net)
      }
      return updated
    })
  }

  function handleNetChange(value: string) {
    setFormData(prev => {
      const updated = { ...prev, net_weight_lbs: value }
      const net = parseFloat(value) || 0
      return recalculateFromNet(updated, net)
    })
  }

  function handleMoistureChange(value: string) {
    setFormData(prev => {
      const updated = { ...prev, moisture_percent: value }
      const net = parseFloat(prev.net_weight_lbs) || 0
      const moisture = parseFloat(value) || 0
      const moistureDeduction = moisture > STANDARD_MOISTURE
        ? net * ((moisture - STANDARD_MOISTURE) / (100 - STANDARD_MOISTURE))
        : 0
      updated.moisture_deduction_lbs = moistureDeduction > 0 ? moistureDeduction.toFixed(2) : ''
      return recalculateAdjusted(updated)
    })
  }

  function handleDockageChange(value: string) {
    setFormData(prev => {
      const updated = { ...prev, dockage_percent: value }
      const net = parseFloat(prev.net_weight_lbs) || 0
      const dockage = parseFloat(value) || 0
      const dockageDeduction = dockage > 0 ? net * (dockage / 100) : 0
      updated.dockage_deduction_lbs = dockageDeduction > 0 ? dockageDeduction.toFixed(2) : ''
      return recalculateAdjusted(updated)
    })
  }

  function handleMoistureDeductionChange(value: string) {
    setFormData(prev => {
      const updated = { ...prev, moisture_deduction_lbs: value }
      return recalculateAdjusted(updated)
    })
  }

  function handleDockageDeductionChange(value: string) {
    setFormData(prev => {
      const updated = { ...prev, dockage_deduction_lbs: value }
      return recalculateAdjusted(updated)
    })
  }

  function recalculateFromNet(data: TicketFormData, net: number): TicketFormData {
    const moisture = parseFloat(data.moisture_percent) || 0
    const moistureDeduction = moisture > STANDARD_MOISTURE
      ? net * ((moisture - STANDARD_MOISTURE) / (100 - STANDARD_MOISTURE))
      : 0

    const dockage = parseFloat(data.dockage_percent) || 0
    const dockageDeduction = dockage > 0 ? net * (dockage / 100) : 0

    data.moisture_deduction_lbs = moistureDeduction > 0 ? moistureDeduction.toFixed(2) : ''
    data.dockage_deduction_lbs = dockageDeduction > 0 ? dockageDeduction.toFixed(2) : ''

    return recalculateAdjusted(data)
  }

  function recalculateAdjusted(data: TicketFormData): TicketFormData {
    const net = parseFloat(data.net_weight_lbs) || 0
    const moistureDed = parseFloat(data.moisture_deduction_lbs) || 0
    const dockageDed = parseFloat(data.dockage_deduction_lbs) || 0
    const adjusted = net - moistureDed - dockageDed
    data.adjusted_net_weight_lbs = adjusted > 0 ? adjusted.toFixed(2) : '0'
    data.bushels = adjusted > 0 ? (adjusted / LBS_PER_BUSHEL).toFixed(2) : '0'
    return { ...data }
  }

  async function handleSaveStartingAmount() {
    if (!startingAmount) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/grain/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          starting_amount: parseFloat(startingAmount),
          unit: startingUnit,
        }),
      })
      if (res.ok) {
        setIsStartingOpen(false)
        setStartingAmount('')
        fetchData()
      }
    } catch (error) {
      console.error('Error saving starting amount:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitTicket() {
    if (!formData.gross_weight_lbs || !formData.tare_weight_lbs || !formData.net_weight_lbs) return
    setIsSubmitting(true)
    try {
      const payload = {
        ticket_date: new Date(formData.ticket_date + 'T12:00:00').toISOString(),
        ticket_type: formData.ticket_type,
        gross_weight_lbs: parseFloat(formData.gross_weight_lbs),
        tare_weight_lbs: parseFloat(formData.tare_weight_lbs),
        net_weight_lbs: parseFloat(formData.net_weight_lbs),
        moisture_percent: formData.moisture_percent ? parseFloat(formData.moisture_percent) : null,
        moisture_deduction_lbs: parseFloat(formData.moisture_deduction_lbs) || 0,
        dockage_percent: formData.dockage_percent ? parseFloat(formData.dockage_percent) : null,
        dockage_deduction_lbs: parseFloat(formData.dockage_deduction_lbs) || 0,
        adjusted_net_weight_lbs: parseFloat(formData.adjusted_net_weight_lbs),
        bushels: parseFloat(formData.bushels),
        notes: formData.notes || null,
      }

      const isEditing = editingTicket !== null
      const url = isEditing ? `/api/grain/tickets/${editingTicket.id}` : '/api/grain/tickets'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setIsTicketOpen(false)
        setFormData(getDefaultFormData())
        setEditingTicket(null)
        setIsAdvancedOpen(false)
        fetchData()
      }
    } catch (error) {
      console.error('Error saving ticket:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteTicket() {
    if (deletingTicketId === null) return
    try {
      const res = await fetch(`/api/grain/tickets/${deletingTicketId}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletingTicketId(null)
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting ticket:', error)
    }
  }

  function openEditTicket(ticket: GrainTicket) {
    setEditingTicket(ticket)
    setFormData({
      ticket_date: new Date(ticket.ticket_date).toISOString().split('T')[0],
      ticket_type: ticket.ticket_type,
      gross_weight_lbs: ticket.gross_weight_lbs.toString(),
      tare_weight_lbs: ticket.tare_weight_lbs.toString(),
      net_weight_lbs: ticket.net_weight_lbs.toString(),
      moisture_percent: ticket.moisture_percent?.toString() || '',
      moisture_deduction_lbs: ticket.moisture_deduction_lbs?.toString() || '',
      dockage_percent: ticket.dockage_percent?.toString() || '',
      dockage_deduction_lbs: ticket.dockage_deduction_lbs?.toString() || '',
      adjusted_net_weight_lbs: ticket.adjusted_net_weight_lbs.toString(),
      bushels: ticket.bushels.toString(),
      notes: ticket.notes || '',
    })
    const hasMoistureOrDockage = ticket.moisture_percent || ticket.dockage_percent
    setIsAdvancedOpen(!!hasMoistureOrDockage)
    setIsTicketOpen(true)
  }

  function openNewTicket() {
    setEditingTicket(null)
    setFormData(getDefaultFormData())
    setIsAdvancedOpen(false)
    setIsTicketOpen(true)
  }

  const yearOptions = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    yearOptions.push(y)
  }

  const isFormValid = formData.gross_weight_lbs && formData.tare_weight_lbs && formData.net_weight_lbs

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Year Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wheat className="h-7 w-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Grain Storage</h1>
            <p className="text-sm text-gray-500">Corn inventory tracker</p>
          </div>
        </div>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Starting Amount */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-amber-200 bg-amber-50/50"
          onClick={() => {
            if (settings) {
              setStartingAmount(settings.starting_amount_bushels.toString())
              setStartingUnit('bushels')
            }
            setIsStartingOpen(true)
          }}
        >
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Starting</span>
              <Scale className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-amber-900">
              {settings ? formatNumber(totals.startBushels, 0) : '---'}
            </div>
            <p className="text-xs text-amber-600 mt-1">
              {settings ? `${formatNumber(Number(settings.starting_amount_lbs), 0)} lbs` : 'Tap to set'}
            </p>
          </CardContent>
        </Card>

        {/* Total Gained */}
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Gained</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-green-900">
              {formatNumber(totals.totalUnloaded, 0)}
            </div>
            <p className="text-xs text-green-600 mt-1">
              {formatNumber(totals.totalUnloaded * LBS_PER_BUSHEL, 0)} lbs
            </p>
          </CardContent>
        </Card>

        {/* Total Lost */}
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Shipped Out</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-red-900">
              {formatNumber(totals.totalLoaded, 0)}
            </div>
            <p className="text-xs text-red-600 mt-1">
              {formatNumber(totals.totalLoaded * LBS_PER_BUSHEL, 0)} lbs
            </p>
          </CardContent>
        </Card>

        {/* Running Total */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">On Hand</span>
              <Wheat className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-blue-900">
              {formatNumber(totals.currentTotal, 0)}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {formatNumber(totals.currentTotal * LBS_PER_BUSHEL, 0)} lbs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bushels label */}
      <p className="text-center text-xs text-gray-400 -mt-3">All totals in bushels (56 lbs/bu)</p>

      {/* Add Ticket Button */}
      <div className="flex justify-center">
        <Button
          onClick={openNewTicket}
          size="lg"
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-8 py-6 text-base rounded-xl shadow-lg shadow-amber-200 hover:shadow-amber-300 transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Truck Ticket
        </Button>
      </div>

      {/* Ticket History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Ticket History</CardTitle>
            <span className="text-sm text-gray-500">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center">
              <Wheat className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No tickets yet for {selectedYear}</p>
              <p className="text-gray-400 text-sm mt-1">Add your first truck ticket to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {tickets.map((ticket) => {
                const isUnload = ticket.ticket_type === 'unload'
                return (
                  <div key={ticket.id} className="px-4 md:px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${isUnload ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold uppercase tracking-wide ${isUnload ? 'text-green-700' : 'text-red-700'}`}>
                              {isUnload ? 'Unloaded' : 'Loaded Out'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(ticket.ticket_date)}
                            </span>
                          </div>

                          {/* Weight details */}
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                            <span className="text-gray-600">
                              <span className="text-gray-400 text-xs">Gross</span> {formatNumber(Number(ticket.gross_weight_lbs), 0)} lbs
                            </span>
                            <span className="text-gray-600">
                              <span className="text-gray-400 text-xs">Tare</span> {formatNumber(Number(ticket.tare_weight_lbs), 0)} lbs
                            </span>
                            <span className="text-gray-600">
                              <span className="text-gray-400 text-xs">Net</span> {formatNumber(Number(ticket.net_weight_lbs), 0)} lbs
                            </span>
                          </div>

                          {/* Moisture/Dockage if present */}
                          {(ticket.moisture_percent || ticket.dockage_percent) && (
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                              {ticket.moisture_percent && (
                                <span>Moisture: {ticket.moisture_percent}% (−{formatNumber(Number(ticket.moisture_deduction_lbs), 0)} lbs)</span>
                              )}
                              {ticket.dockage_percent && (
                                <span>Dockage: {ticket.dockage_percent}% (−{formatNumber(Number(ticket.dockage_deduction_lbs), 0)} lbs)</span>
                              )}
                            </div>
                          )}

                          {ticket.notes && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{ticket.notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Bushels & actions */}
                      <div className="text-right shrink-0 flex items-start gap-2">
                        <div>
                          <div className={`text-lg font-bold ${isUnload ? 'text-green-700' : 'text-red-700'}`}>
                            {isUnload ? '+' : '−'}{formatNumber(Number(ticket.bushels), 2)}
                          </div>
                          <div className="text-xs text-gray-400">bushels</div>
                        </div>
                        <div className="flex flex-col gap-1 ml-2">
                          <button
                            onClick={() => openEditTicket(ticket)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors rounded"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingTicketId(ticket.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Starting Amount Dialog */}
      <Dialog open={isStartingOpen} onOpenChange={setIsStartingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Starting Amount for {selectedYear}</DialogTitle>
            <DialogDescription>
              Enter how much corn you have in storage at the start of the year.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={startingAmount}
                onChange={(e) => setStartingAmount(e.target.value)}
                className="text-lg"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={startingUnit} onValueChange={(v) => setStartingUnit(v as 'bushels' | 'lbs')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bushels">Bushels</SelectItem>
                  <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {startingAmount && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                {startingUnit === 'bushels' ? (
                  <span>= {formatNumber(parseFloat(startingAmount) * LBS_PER_BUSHEL, 0)} lbs</span>
                ) : (
                  <span>= {formatNumber(parseFloat(startingAmount) / LBS_PER_BUSHEL, 2)} bushels</span>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStartingOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveStartingAmount}
              disabled={!startingAmount || isSubmitting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Truck Ticket Dialog */}
      <Dialog open={isTicketOpen} onOpenChange={(open) => {
        setIsTicketOpen(open)
        if (!open) {
          setEditingTicket(null)
          setFormData(getDefaultFormData())
          setIsAdvancedOpen(false)
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTicket ? 'Edit Ticket' : 'New Truck Ticket'}</DialogTitle>
            <DialogDescription>
              {editingTicket ? 'Update the ticket details below.' : 'Enter the truck scale ticket details.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type & Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.ticket_type}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, ticket_type: v as 'unload' | 'load' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unload">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Unloading (In)
                      </span>
                    </SelectItem>
                    <SelectItem value="load">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Loading (Out)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.ticket_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, ticket_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Weights - the main required fields */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Scale Weights (lbs)</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Gross *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.gross_weight_lbs}
                    onChange={(e) => handleWeightChange('gross_weight_lbs', e.target.value)}
                    className="text-center font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tare *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.tare_weight_lbs}
                    onChange={(e) => handleWeightChange('tare_weight_lbs', e.target.value)}
                    className="text-center font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Net *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.net_weight_lbs}
                    onChange={(e) => handleNetChange(e.target.value)}
                    className="text-center font-mono bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Moisture & Dockage - collapsible */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">Moisture & Dockage</span>
                {isAdvancedOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {isAdvancedOpen && (
                <div className="px-4 pb-4 space-y-3 border-t bg-gray-50/50">
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Moisture %</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`Std: ${STANDARD_MOISTURE}%`}
                        value={formData.moisture_percent}
                        onChange={(e) => handleMoistureChange(e.target.value)}
                        className="text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Moisture Deduction (lbs)</Label>
                      <Input
                        type="number"
                        placeholder="Auto-calculated"
                        value={formData.moisture_deduction_lbs}
                        onChange={(e) => handleMoistureDeductionChange(e.target.value)}
                        className="text-center"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Dockage %</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="0%"
                        value={formData.dockage_percent}
                        onChange={(e) => handleDockageChange(e.target.value)}
                        className="text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Dockage Deduction (lbs)</Label>
                      <Input
                        type="number"
                        placeholder="Auto-calculated"
                        value={formData.dockage_deduction_lbs}
                        onChange={(e) => handleDockageDeductionChange(e.target.value)}
                        className="text-center"
                      />
                    </div>
                  </div>
                  {(formData.moisture_percent || formData.dockage_percent) && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Deductions are editable — override the auto-calculated values if needed.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Final Calculation Summary */}
            {formData.net_weight_lbs && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-blue-800">Calculation Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-blue-700">Adjusted Net Weight:</div>
                  <div className="text-right font-mono font-semibold text-blue-900">
                    {formData.adjusted_net_weight_lbs ? formatNumber(parseFloat(formData.adjusted_net_weight_lbs), 2) : '---'} lbs
                  </div>
                  <div className="text-blue-700">Bushels:</div>
                  <div className="text-right font-mono font-bold text-blue-900 text-lg">
                    {formData.bushels ? formatNumber(parseFloat(formData.bushels), 2) : '---'}
                  </div>
                </div>
                {/* Editable overrides */}
                <div className="pt-2 border-t border-blue-200 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-blue-700">Override Adj. Net (lbs)</Label>
                      <Input
                        type="number"
                        value={formData.adjusted_net_weight_lbs}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormData(prev => ({
                            ...prev,
                            adjusted_net_weight_lbs: val,
                            bushels: val ? (parseFloat(val) / LBS_PER_BUSHEL).toFixed(2) : '0',
                          }))
                        }}
                        className="text-center text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-blue-700">Override Bushels</Label>
                      <Input
                        type="number"
                        value={formData.bushels}
                        onChange={(e) => setFormData(prev => ({ ...prev, bushels: e.target.value }))}
                        className="text-center text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Driver name, ticket #, etc."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTicketOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitTicket}
              disabled={!isFormValid || isSubmitting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSubmitting ? 'Saving...' : editingTicket ? 'Update Ticket' : 'Save Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deletingTicketId !== null} onOpenChange={(open) => { if (!open) setDeletingTicketId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Ticket</DialogTitle>
            <DialogDescription>
              Are you sure? This will permanently remove this ticket and adjust your running total.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTicketId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTicket}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
