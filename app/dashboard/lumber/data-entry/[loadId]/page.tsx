'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function DataEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const loadId = params?.loadId as string

  const [load, setLoad] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [actualFootage, setActualFootage] = useState<{ [key: number]: string }>({})
  const [arrivalDate, setArrivalDate] = useState('')
  const [pickupNumber, setPickupNumber] = useState('')
  const [plant, setPlant] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceTotal, setInvoiceTotal] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchLoad() {
      try {
        const response = await fetch(`/api/lumber/loads/${loadId}`)
        if (response.ok) {
          const data = await response.json()
          setLoad(data)
          
          // Pre-fill if data exists
          if (data.actual_arrival_date) setArrivalDate(data.actual_arrival_date)
          if (data.pickup_number) setPickupNumber(data.pickup_number)
          if (data.plant) setPlant(data.plant)
          if (data.invoice_number) setInvoiceNumber(data.invoice_number)
          if (data.invoice_total) setInvoiceTotal(data.invoice_total.toString())
          if (data.invoice_date) setInvoiceDate(data.invoice_date)
          
          // Pre-fill actual footage
          const footageMap: { [key: number]: string } = {}
          data.items?.forEach((item: any) => {
            if (item.actual_footage) {
              footageMap[item.id] = item.actual_footage.toString()
            }
          })
          setActualFootage(footageMap)
        }
      } catch (error) {
        console.error('Error fetching load:', error)
        toast.error('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated' && loadId) {
      fetchLoad()
    }
  }, [status, loadId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Update load with arrival and invoice info
      const response = await fetch(`/api/lumber/loads/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_arrival_date: arrivalDate || null,
          pickup_number: pickupNumber || null,
          plant: plant || null,
          invoice_number: invoiceNumber || null,
          invoice_total: invoiceTotal ? parseFloat(invoiceTotal) : null,
          invoice_date: invoiceDate || null
        })
      })

      if (!response.ok) throw new Error('Failed to update load')

      // Update actual footage for each item
      for (const [itemId, footage] of Object.entries(actualFootage)) {
        if (footage) {
          await fetch(`/api/lumber/loads/items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actual_footage: parseFloat(footage) })
          })
        }
      }

      toast.success('Data saved successfully')
      router.push('/dashboard/lumber/incoming')
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save data')
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!load) {
    return <div className="text-center py-12">Load not found</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Entry - {load.load_id}</h1>
          <p className="text-gray-600 mt-1">{load.supplier_name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Actual Footage Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Actual Board Footage</h2>
          <div className="space-y-3">
            {load.items?.map((item: any) => (
              <div key={item.id} className="grid grid-cols-2 gap-4 items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{item.species} - {item.grade}</div>
                  <div className="text-sm text-gray-600">
                    {item.thickness} | Est: {item.estimated_footage?.toLocaleString() || '-'} ft
                  </div>
                </div>
                <div>
                  <Label htmlFor={`footage-${item.id}`}>Actual Footage</Label>
                  <Input
                    id={`footage-${item.id}`}
                    type="number"
                    step="0.01"
                    value={actualFootage[item.id] || ''}
                    onChange={(e) => setActualFootage({ ...actualFootage, [item.id]: e.target.value })}
                    placeholder="Enter actual footage"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrival Info */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Arrival Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="arrivalDate">Arrival Date</Label>
              <Input
                id="arrivalDate"
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pickupNumber">Pickup Number</Label>
              <Input
                id="pickupNumber"
                value={pickupNumber}
                onChange={(e) => setPickupNumber(e.target.value)}
                placeholder="e.g., PU-12345"
              />
            </div>
            <div>
              <Label htmlFor="plant">Plant</Label>
              <Input
                id="plant"
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                placeholder="Plant name"
              />
            </div>
          </div>
        </div>

        {/* Invoice Info */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Invoice Information</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-12345"
              />
            </div>
            <div>
              <Label htmlFor="invoiceTotal">Invoice Total</Label>
              <Input
                id="invoiceTotal"
                type="number"
                step="0.01"
                value={invoiceTotal}
                onChange={(e) => setInvoiceTotal(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Data'}
          </Button>
        </div>
      </form>
    </div>
  )
}
