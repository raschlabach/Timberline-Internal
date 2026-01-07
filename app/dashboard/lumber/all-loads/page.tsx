'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails } from '@/types/lumber'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Info } from 'lucide-react'

export default function AllLoadsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [filteredLoads, setFilteredLoads] = useState<LumberLoadWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/all-loads')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchLoads() {
      try {
        const response = await fetch('/api/lumber/loads')
        if (response.ok) {
          const data = await response.json()
          setLoads(data)
          setFilteredLoads(data)
        }
      } catch (error) {
        console.error('Error fetching loads:', error)
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
          load.invoice_number?.toLowerCase().includes(search)
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">All Loads</h1>
        <p className="text-gray-600 mt-1">Complete history of all lumber loads</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search by Load ID, Supplier, Species, Grade, or Invoice #..."
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
                Actual Footage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Arrival Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLoads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {loads.length === 0 ? 'No loads found' : 'No loads match your search'}
                </td>
              </tr>
            ) : (
              filteredLoads.map((load) => (
                <tr key={load.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{load.load_id}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(load.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{load.supplier_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {load.items.map((item, idx) => (
                        <div key={idx}>
                          {item.species} - {item.grade} ({item.thickness})
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.items.map((item, idx) => (
                        <div key={idx}>
                          {item.actual_footage ? `${item.actual_footage.toLocaleString()} ft` : '-'}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.actual_arrival_date 
                        ? new Date(load.actual_arrival_date).toLocaleDateString() 
                        : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{load.invoice_number || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {!load.actual_arrival_date && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Incoming
                        </span>
                      )}
                      {load.actual_arrival_date && !load.all_packs_tallied && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Needs Tally
                        </span>
                      )}
                      {load.all_packs_tallied && !load.all_packs_finished && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          In Progress
                        </span>
                      )}
                      {load.all_packs_finished && !load.is_paid && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          Pending Payment
                        </span>
                      )}
                      {load.is_paid && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Complete
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push(`/dashboard/lumber/load/${load.id}`)}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
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
