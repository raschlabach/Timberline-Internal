'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit } from 'lucide-react'

export default function LoadInfoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const loadId = params?.loadId as string

  const [load, setLoad] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

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
        }
      } catch (error) {
        console.error('Error fetching load:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated' && loadId) {
      fetchLoad()
    }
  }, [status, loadId])

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Load {load.load_id}</h1>
            <p className="text-gray-600 mt-1">{load.supplier_name}</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/dashboard/lumber/data-entry/${loadId}`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        {/* Basic Info */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Supplier</div>
              <div className="font-medium">{load.supplier_name}</div>
              {load.location_name && (
                <div className="text-sm text-gray-600">{load.location_name}</div>
              )}
            </div>
            <div>
              <div className="text-sm text-gray-500">Lumber Type</div>
              <div className="font-medium capitalize">{load.lumber_type || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Pickup or Delivery</div>
              <div className="font-medium capitalize">{load.pickup_or_delivery || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Estimated Delivery</div>
              <div className="font-medium">
                {load.estimated_delivery_date 
                  ? new Date(load.estimated_delivery_date).toLocaleDateString() 
                  : '-'}
              </div>
            </div>
          </div>
          {load.comments && (
            <div className="mt-4">
              <div className="text-sm text-gray-500">Comments</div>
              <div className="text-sm mt-1">{load.comments}</div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Load Items</h2>
          <div className="space-y-3">
            {load.items?.map((item: any, idx: number) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{item.species} - {item.grade}</div>
                  <div className="text-sm text-gray-600">Thickness: {item.thickness}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Est. / Actual Footage</div>
                  <div className="font-medium">
                    {item.estimated_footage?.toLocaleString() || '-'} / {item.actual_footage?.toLocaleString() || '-'}
                  </div>
                  {item.price && (
                    <div className="text-sm text-gray-600">${item.price.toFixed(2)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrival Info */}
        {(load.actual_arrival_date || load.pickup_number || load.plant) && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Arrival Information</h2>
            <div className="grid grid-cols-3 gap-4">
              {load.actual_arrival_date && (
                <div>
                  <div className="text-sm text-gray-500">Arrival Date</div>
                  <div className="font-medium">{new Date(load.actual_arrival_date).toLocaleDateString()}</div>
                </div>
              )}
              {load.pickup_number && (
                <div>
                  <div className="text-sm text-gray-500">Pickup Number</div>
                  <div className="font-medium">{load.pickup_number}</div>
                </div>
              )}
              {load.plant && (
                <div>
                  <div className="text-sm text-gray-500">Plant</div>
                  <div className="font-medium">{load.plant}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invoice Info */}
        {(load.invoice_number || load.invoice_total || load.invoice_date) && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Information</h2>
            <div className="grid grid-cols-3 gap-4">
              {load.invoice_number && (
                <div>
                  <div className="text-sm text-gray-500">Invoice Number</div>
                  <div className="font-medium">{load.invoice_number}</div>
                </div>
              )}
              {load.invoice_total && (
                <div>
                  <div className="text-sm text-gray-500">Invoice Total</div>
                  <div className="font-medium">${load.invoice_total.toLocaleString()}</div>
                </div>
              )}
              {load.invoice_date && (
                <div>
                  <div className="text-sm text-gray-500">Invoice Date</div>
                  <div className="font-medium">{new Date(load.invoice_date).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
