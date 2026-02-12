'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { formatPhoneNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/modal'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Search,
  X,
  Users,
  MapPin,
  Phone,
  Navigation,
  Copy,
  ChevronRight,
  StickyNote,
  Send,
  Loader2,
  ExternalLink,
} from 'lucide-react'

interface Customer {
  id: number
  customer_name: string
  address: string
  city: string
  state: string
  zip: string
  county: string
  phone_number_1: string | null
  phone_number_1_ext: string | null
  phone_number_2: string | null
  phone_number_2_ext: string | null
  notes: string | null
  current_orders: number
  total_orders: number
}

interface DriverNote {
  id: number
  note: string
  createdAt: string
  driverName: string
}

export default function DriverCustomerCenter() {
  const { data: session } = useSession()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Driver notes state
  const [driverNotes, setDriverNotes] = useState<DriverNote[]>([])
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)

  // Load customers
  useEffect(() => {
    async function loadCustomers() {
      try {
        setIsLoading(true)
        const response = await fetch('/api/customers')
        if (!response.ok) throw new Error('Failed to load customers')
        const data = await response.json()

        const formattedData = data.map((customer: any) => ({
          ...customer,
          zip: customer.zip_code || customer.zip,
          current_orders: customer.current_orders || 0,
          total_orders: customer.total_orders || 0,
        }))

        setCustomers(formattedData)
      } catch (error) {
        console.error('Error loading customers:', error)
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    loadCustomers()
  }, [])

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers

    const searchLower = searchQuery.toLowerCase().trim()
    const terms = searchLower.split(' ').filter((t) => t.length > 0)

    return customers
      .filter((customer) => {
        const text = [
          customer.customer_name,
          customer.city,
          customer.state,
          customer.address,
          customer.county,
          customer.zip,
          customer.phone_number_1,
          customer.phone_number_2,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return terms.every((term) => text.includes(term))
      })
      .sort((a, b) => {
        const aName = a.customer_name?.toLowerCase() || ''
        const bName = b.customer_name?.toLowerCase() || ''
        // Exact name match first
        if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1
        if (!aName.startsWith(searchLower) && bName.startsWith(searchLower)) return 1
        return aName.localeCompare(bName)
      })
  }, [customers, searchQuery])

  // Load driver notes for selected customer
  async function loadDriverNotes(customerId: number) {
    setIsLoadingNotes(true)
    try {
      const response = await fetch(`/api/driver/customer-notes?customerId=${customerId}`)
      if (response.ok) {
        const data = await response.json()
        setDriverNotes(data.notes || [])
      }
    } catch (error) {
      console.error('Error loading driver notes:', error)
    } finally {
      setIsLoadingNotes(false)
    }
  }

  // Save driver note
  async function handleSaveNote() {
    if (!newNote.trim() || !selectedCustomer) return
    setIsSavingNote(true)
    try {
      const response = await fetch('/api/driver/customer-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          note: newNote.trim(),
        }),
      })
      if (response.ok) {
        setNewNote('')
        loadDriverNotes(selectedCustomer.id)
      }
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setIsSavingNote(false)
    }
  }

  // Open customer details
  function handleOpenDetails(customer: Customer) {
    setSelectedCustomer(customer)
    setIsDetailsOpen(true)
    setNewNote('')
    loadDriverNotes(customer.id)
  }

  // Build map link
  function getMapLink(customer: Customer): string {
    const address = `${customer.address || ''}, ${customer.city || ''}, ${customer.state || ''} ${customer.zip || ''}`
    const encoded = encodeURIComponent(address.trim())
    // Universal link that works on both iOS (Apple Maps) and Android (Google Maps)
    return `https://maps.google.com/?q=${encoded}`
  }

  function getAppleMapsLink(customer: Customer): string {
    const address = `${customer.address || ''}, ${customer.city || ''}, ${customer.state || ''} ${customer.zip || ''}`
    const encoded = encodeURIComponent(address.trim())
    return `https://maps.apple.com/?q=${encoded}`
  }

  // Copy to clipboard
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Customer Center</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading customers...</span>
          </div>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-red-500">Failed to load customers</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <Users className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Customer Center</h1>
          <p className="text-xs text-gray-500">{customers.length} customers</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by name, city, address, phone..."
          className="pl-10 pr-10 h-11 text-base"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => setSearchQuery('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {searchQuery && (
        <p className="text-xs text-gray-500 px-1">
          {filteredCustomers.length} result{filteredCustomers.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
        </p>
      )}

      {/* Customer List - Card layout for mobile friendliness */}
      <div className="space-y-2">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              onClick={() => handleOpenDetails(customer)}
              className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 md:p-4 hover:border-gray-300 hover:shadow-sm transition-all active:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">
                    {customer.customer_name || 'Unnamed Customer'}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="text-xs md:text-sm text-gray-500 truncate">
                      {customer.city || ''}{customer.city && customer.state ? ', ' : ''}{customer.state || ''}
                      {customer.zip ? ` ${customer.zip}` : ''}
                    </span>
                  </div>
                  {customer.phone_number_1 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500">{formatPhoneNumber(customer.phone_number_1)}</span>
                    </div>
                  )}
                  {customer.notes && (
                    <p className="text-[11px] text-gray-400 mt-1 truncate">{customer.notes}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <Users className="h-8 w-8 mb-2" />
            <p className="text-sm">No customers found</p>
            <p className="text-xs">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle className="text-lg">{selectedCustomer.customer_name}</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid grid-cols-2 mx-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="notes">
                  Notes
                  {driverNotes.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{driverNotes.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="px-4 pb-4 space-y-4">
                {/* Address with map links */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Address</h4>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900">{selectedCustomer.address || '-'}</p>
                    <p className="text-sm text-gray-600">
                      {selectedCustomer.city || ''}{selectedCustomer.city && selectedCustomer.state ? ', ' : ''}
                      {selectedCustomer.state || ''} {selectedCustomer.zip || ''}
                    </p>
                    {selectedCustomer.county && (
                      <p className="text-xs text-gray-400 mt-0.5">{selectedCustomer.county} County</p>
                    )}

                    {/* Map buttons */}
                    <div className="flex gap-2 mt-3">
                      <a
                        href={getMapLink(selectedCustomer)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9">
                          <Navigation className="h-3.5 w-3.5" />
                          Google Maps
                        </Button>
                      </a>
                      <a
                        href={getAppleMapsLink(selectedCustomer)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Apple Maps
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Phone numbers */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</h4>
                  <div className="space-y-2">
                    {selectedCustomer.phone_number_1 ? (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">
                              {formatPhoneNumber(selectedCustomer.phone_number_1)}
                              {selectedCustomer.phone_number_1_ext && (
                                <span className="text-gray-400 ml-1">ext. {selectedCustomer.phone_number_1_ext}</span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400">Primary</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <a href={`tel:${selectedCustomer.phone_number_1}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Phone className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => copyToClipboard(selectedCustomer.phone_number_1 || '')}
                          >
                            <Copy className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No phone number on file</p>
                    )}

                    {selectedCustomer.phone_number_2 && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">
                              {formatPhoneNumber(selectedCustomer.phone_number_2)}
                              {selectedCustomer.phone_number_2_ext && (
                                <span className="text-gray-400 ml-1">ext. {selectedCustomer.phone_number_2_ext}</span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400">Secondary</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <a href={`tel:${selectedCustomer.phone_number_2}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Phone className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => copyToClipboard(selectedCustomer.phone_number_2 || '')}
                          >
                            <Copy className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Office Notes (read-only) */}
                {selectedCustomer.notes && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Office Notes</h4>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-900 whitespace-pre-line">{selectedCustomer.notes}</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="px-4 pb-4 space-y-4">
                {/* Add new note */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add a Note</h4>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your note here..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-[60px] text-sm resize-none"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={!newNote.trim() || isSavingNote}
                    className="gap-1.5"
                  >
                    {isSavingNote ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Save Note
                  </Button>
                </div>

                {/* Existing driver notes */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Driver Notes ({driverNotes.length})
                  </h4>
                  {isLoadingNotes ? (
                    <div className="flex items-center gap-2 py-4 text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading notes...</span>
                    </div>
                  ) : driverNotes.length > 0 ? (
                    <div className="space-y-2">
                      {driverNotes.map((note) => (
                        <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-900 whitespace-pre-line">{note.note}</p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                            <span className="font-medium">{note.driverName}</span>
                            <span>·</span>
                            <span>{new Date(note.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-6 text-gray-400">
                      <StickyNote className="h-6 w-6 mb-1" />
                      <p className="text-xs">No driver notes yet</p>
                    </div>
                  )}
                </div>

                {/* Office notes (read-only) */}
                {selectedCustomer.notes && (
                  <div className="space-y-2 pt-2 border-t">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Office Notes</h4>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-900 whitespace-pre-line">{selectedCustomer.notes}</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
