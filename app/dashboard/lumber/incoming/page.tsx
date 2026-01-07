'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Info } from 'lucide-react'

export default function IncomingLoadsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [filteredLoads, setFilteredLoads] = useState<LumberLoadWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/incoming')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchLoads() {
      try {
        const response = await fetch('/api/lumber/loads/incoming')
        if (response.ok) {
          const data = await response.json()
          setLoads(data)
          setFilteredLoads(data)
        }
      } catch (error) {
        console.error('Error fetching incoming loads:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchLoads()
    }
  }, [status])

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredLoads(loads)
    } else {
      const filtered = loads.filter(load => {
        const search = searchTerm.toLowerCase()
        return (
          load.load_id.toLowerCase().includes(search) ||
          load.supplier_name.toLowerCase().includes(search) ||
          load.items.some(item => 
            item.species.toLowerCase().includes(search) ||
            item.grade.toLowerCase().includes(search)
          ) ||
          load.pickup_number?.toLowerCase().includes(search) ||
          load.plant?.toLowerCase().includes(search)
        )
      })
      setFilteredLoads(filtered)
    }
  }, [searchTerm, loads])

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incoming Loads</h1>
          <p className="text-gray-600 mt-1">
            Loads that have been created but have not arrived yet
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/lumber/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Load
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search by Load ID, Supplier, Species, Grade, Pickup #, or Plant..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loads Table */}
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
                Species / Grade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Est. Footage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thickness
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ETA
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLoads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  {loads.length === 0 ? 'No incoming loads found' : 'No loads match your search'}
                </td>
              </tr>
            ) : (
              filteredLoads.map((load) => (
                <tr key={load.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900" title={`Created: ${new Date(load.created_at).toLocaleDateString()}`}>
                      {load.load_id}
                    </div>
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
                        <div key={idx}>
                          {item.species} - {item.grade}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.items.map((item, idx) => (
                        <div key={idx}>
                          {item.estimated_footage?.toLocaleString() || '-'} ft
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.items.map((item, idx) => (
                        <div key={idx}>
                          ${item.price?.toFixed(2) || '-'}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.items.map((item, idx) => (
                        <div key={idx}>{item.thickness}</div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.estimated_delivery_date ? new Date(load.estimated_delivery_date).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize">
                      {load.pickup_or_delivery || '-'}
                    </div>
                    {load.pickup_number && (
                      <div className="text-xs text-gray-500">#{load.pickup_number}</div>
                    )}
                    {load.plant && (
                      <div className="text-xs text-gray-500">{load.plant}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/lumber/data-entry/${load.id}`)}
                      >
                        Data Entry
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
