'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Download, FileText, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function POPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [generatingPO, setGeneratingPO] = useState<number | null>(null)
  const [markingAsSent, setMarkingAsSent] = useState<number | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/po')
    }
  }, [status, router])

  async function fetchLoads() {
    try {
      const response = await fetch('/api/lumber/loads/po-needed')
      if (response.ok) {
        const data = await response.json()
        setLoads(data)
      }
    } catch (error) {
      console.error('Error fetching PO needed loads:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLoads()
    }
  }, [status])

  async function handleGeneratePO(load: LumberLoadWithDetails) {
    setGeneratingPO(load.id)
    
    try {
      const response = await fetch('/api/lumber/po/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ load_id: load.id })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `PO-${load.load_id}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.success(`Purchase order for ${load.load_id} has been downloaded`)

        // Refresh the list
        fetchLoads()
      } else {
        throw new Error('Failed to generate PO')
      }
    } catch (error) {
      console.error('Error generating PO:', error)
      toast.error('Failed to generate PO')
    } finally {
      setGeneratingPO(null)
    }
  }

  async function handleMarkAsSent(load: LumberLoadWithDetails) {
    setMarkingAsSent(load.id)
    
    try {
      const response = await fetch(`/api/lumber/loads/${load.id}/mark-po-sent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        toast.success(`Load ${load.load_id} marked as PO sent`)
        
        // Refresh the list to remove this load
        fetchLoads()
      } else {
        throw new Error('Failed to mark as sent')
      }
    } catch (error) {
      console.error('Error marking PO as sent:', error)
      toast.error('Failed to mark PO as sent')
    } finally {
      setMarkingAsSent(null)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
        <p className="text-gray-600 mt-1">
          Generate and download purchase orders for new loads
        </p>
      </div>

      {loads.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No POs Needed
          </h3>
          <p className="text-gray-600">
            All loads have had their purchase orders generated
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Load ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Est. Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loads.map((load) => {
                const totalEstFootage = load.items.reduce((sum, item) => sum + (item.estimated_footage || 0), 0)
                const totalPrice = load.items.reduce((sum, item) => 
                  sum + ((item.estimated_footage || 0) * (item.price || 0)), 0
                )
                
                return (
                  <tr key={load.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{load.load_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{load.supplier_name}</div>
                      {load.location_name && (
                        <div className="text-xs text-gray-500">{load.location_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {load.items.map((item, idx) => (
                          <div key={idx} className="mb-1">
                            {item.species} - {item.grade} ({item.thickness})
                            {item.estimated_footage && ` - ${item.estimated_footage.toLocaleString()} ft`}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {totalEstFootage.toLocaleString()} ft
                      </div>
                      <div className="text-xs text-gray-500">
                        ${totalPrice.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(load.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleGeneratePO(load)}
                          disabled={generatingPO === load.id || markingAsSent === load.id}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {generatingPO === load.id ? 'Generating...' : 'Generate PO'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkAsSent(load)}
                          disabled={generatingPO === load.id || markingAsSent === load.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {markingAsSent === load.id ? 'Marking...' : 'Mark as Sent'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
