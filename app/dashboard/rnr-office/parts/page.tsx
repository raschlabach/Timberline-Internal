'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, Upload, Plus, ChevronLeft, ChevronRight, X, Boxes } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Part {
  id: number
  rnr_part_number: string | null
  customer_part_number: string | null
  description: string | null
  thickness: number | null
  width: number | null
  length: number | null
  board_feet: number | null
  lineal_feet: number | null
  layup_width: number | null
  layup_length: number | null
  pieces_per_layup: number | null
  item_class: string | null
  qb_item_code: string | null
  price: number | null
  is_active: boolean
  customer_id: number | null
  species_id: number | null
  product_type_id: number | null
  profile_id: number | null
  customer_name: string | null
  species_name: string | null
  product_type_name: string | null
  profile_name: string | null
}

interface Species {
  id: number
  name: string
  code: string
}

interface ProductType {
  id: number
  name: string
  code: string
}

interface Customer {
  id: number
  name: string
}

export default function PartsListPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [parts, setParts] = useState<Part[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalParts, setTotalParts] = useState(0)

  const [species, setSpecies] = useState<Species[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [filterCustomer, setFilterCustomer] = useState('all')
  const [filterSpecies, setFilterSpecies] = useState('all')
  const [filterProductType, setFilterProductType] = useState('all')
  const [filterActive, setFilterActive] = useState('true')

  const [selectedPart, setSelectedPart] = useState<Part | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filterCustomer, filterSpecies, filterProductType, filterActive])

  const fetchParts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterCustomer !== 'all') params.set('customer_id', filterCustomer)
      if (filterSpecies !== 'all') params.set('species_id', filterSpecies)
      if (filterProductType !== 'all') params.set('product_type_id', filterProductType)
      if (filterActive !== 'all') params.set('is_active', filterActive)

      const res = await fetch(`/api/rnr/parts?${params}`)
      const data = await res.json()

      if (res.ok) {
        setParts(data.parts)
        setTotalPages(data.totalPages)
        setTotalParts(data.total)
      } else {
        toast.error('Failed to load parts')
      }
    } catch {
      toast.error('Failed to load parts')
    } finally {
      setIsLoading(false)
    }
  }, [page, debouncedSearch, filterCustomer, filterSpecies, filterProductType, filterActive])

  useEffect(() => {
    fetchParts()
  }, [fetchParts])

  useEffect(() => {
    async function fetchFilters() {
      try {
        const [speciesRes, productTypesRes, customersRes] = await Promise.all([
          fetch('/api/rnr/species'),
          fetch('/api/rnr/product-types'),
          fetch('/api/customers'),
        ])
        if (speciesRes.ok) setSpecies(await speciesRes.json())
        if (productTypesRes.ok) setProductTypes(await productTypesRes.json())
        if (customersRes.ok) {
          const data = await customersRes.json()
          setCustomers(Array.isArray(data) ? data : data.customers || [])
        }
      } catch {
        // Filters will just be empty
      }
    }
    fetchFilters()
  }, [])

  function formatDim(val: number | null): string {
    if (val === null || val === undefined) return '-'
    return val.toString()
  }

  const hasActiveFilters = filterCustomer !== 'all' || filterSpecies !== 'all' || filterProductType !== 'all' || filterActive !== 'true' || debouncedSearch !== ''

  function clearFilters() {
    setSearch('')
    setFilterCustomer('all')
    setFilterSpecies('all')
    setFilterProductType('all')
    setFilterActive('true')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Boxes className="h-7 w-7 text-amber-600" />
            Master Parts List
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalParts.toLocaleString()} parts {filterActive === 'true' ? '(active)' : filterActive === 'false' ? '(inactive)' : '(all)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/rnr-office/parts/import">
            <Button variant="outline" className="gap-2">
              <Upload size={16} />
              Import CSV
            </Button>
          </Link>
          <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus size={16} />
            New Part
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search part numbers, descriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterCustomer} onValueChange={setFilterCustomer}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSpecies} onValueChange={setFilterSpecies}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Species" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Species</SelectItem>
              {species.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterProductType} onValueChange={setFilterProductType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Product Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {productTypes.map(pt => (
                <SelectItem key={pt.id} value={pt.id.toString()}>{pt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-gray-500">
              <X size={14} />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Part #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Description</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Species</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Profile</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Thick</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Width</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Length</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">BF</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Price</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                    Loading parts...
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                    {hasActiveFilters ? 'No parts match your filters' : 'No parts found. Import parts from QuickBooks to get started.'}
                  </td>
                </tr>
              ) : (
                parts.map(part => (
                  <tr
                    key={part.id}
                    onClick={() => setSelectedPart(part)}
                    className="border-b border-gray-100 hover:bg-amber-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-900">
                      {part.rnr_part_number || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-[150px] truncate">
                      {part.customer_name || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[250px] truncate">
                      {part.description || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {part.species_name || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {part.product_type_name || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[120px] truncate">
                      {part.profile_name || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
                      {formatDim(part.thickness)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
                      {formatDim(part.width)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
                      {formatDim(part.length)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
                      {formatDim(part.board_feet)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-700 font-medium">
                      {part.price ? `$${Number(part.price).toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({totalParts.toLocaleString()} parts)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Part Detail Dialog */}
      <Dialog open={!!selectedPart} onOpenChange={() => setSelectedPart(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Part Detail
              {selectedPart && !selectedPart.is_active && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">Inactive</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedPart && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">RNR Part #</label>
                  <p className="font-mono text-sm font-medium">{selectedPart.rnr_part_number || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Part #</label>
                  <p className="font-mono text-sm font-medium">{selectedPart.customer_part_number || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</label>
                  <p className="text-sm">{selectedPart.customer_name || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">QB Item Code</label>
                  <p className="font-mono text-sm">{selectedPart.qb_item_code || '-'}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</label>
                <p className="text-sm">{selectedPart.description || '-'}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Species</label>
                  <p className="text-sm">{selectedPart.species_name || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Product Type</label>
                  <p className="text-sm">{selectedPart.product_type_name || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</label>
                  <p className="text-sm">{selectedPart.profile_name || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 bg-gray-50 rounded-lg p-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Thickness</label>
                  <p className="font-mono text-sm">{formatDim(selectedPart.thickness)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Width</label>
                  <p className="font-mono text-sm">{formatDim(selectedPart.width)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Length</label>
                  <p className="font-mono text-sm">{formatDim(selectedPart.length)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Board Ft</label>
                  <p className="font-mono text-sm">{formatDim(selectedPart.board_feet)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Lineal Ft</label>
                  <p className="font-mono text-sm">{formatDim(selectedPart.lineal_feet)}</p>
                </div>
              </div>

              {(selectedPart.layup_width || selectedPart.layup_length || selectedPart.pieces_per_layup) && (
                <div className="grid grid-cols-3 gap-4 bg-amber-50 rounded-lg p-3">
                  <div>
                    <label className="text-xs font-medium text-amber-700 uppercase tracking-wider">Layup Width</label>
                    <p className="font-mono text-sm">{formatDim(selectedPart.layup_width)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-amber-700 uppercase tracking-wider">Layup Length</label>
                    <p className="font-mono text-sm">{formatDim(selectedPart.layup_length)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-amber-700 uppercase tracking-wider">Pcs / Layup</label>
                    <p className="font-mono text-sm">{selectedPart.pieces_per_layup || '-'}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Price</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedPart.price ? `$${Number(selectedPart.price).toFixed(4)}` : 'Not set'}
                  </p>
                </div>
                <div className="text-right">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Item Class</label>
                  <p className="font-mono text-sm">{selectedPart.item_class || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
