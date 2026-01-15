'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { FileText, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

export default function InvoicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLoad, setSelectedLoad] = useState<LumberLoadWithDetails | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [enteredInQuickbooks, setEnteredInQuickbooks] = useState(false)
  const [isPaid, setIsPaid] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/invoices')
    }
  }, [status, router])

  async function fetchLoads() {
    try {
      const response = await fetch('/api/lumber/loads/for-invoice')
      if (response.ok) {
        const data = await response.json()
        // Ensure each load has documents array
        const loadsWithDocs = data.map((load: any) => ({
          ...load,
          documents: load.documents || [],
          items: load.items || []
        }))
        setLoads(loadsWithDocs)
      } else {
        console.error('Failed to fetch invoice loads:', await response.text())
      }
    } catch (error) {
      console.error('Error fetching invoice loads:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLoads()
    }
  }, [status])

  function handleOpenInvoiceDialog(load: LumberLoadWithDetails) {
    setSelectedLoad(load)
    setEnteredInQuickbooks(load.entered_in_quickbooks || false)
    setIsPaid(load.is_paid || false)
    setIsDialogOpen(true)
  }

  async function handleSaveInvoiceStatus() {
    if (!selectedLoad) return

    try {
      const response = await fetch(`/api/lumber/loads/${selectedLoad.id}/invoice-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entered_in_quickbooks: enteredInQuickbooks,
          is_paid: isPaid
        })
      })

      if (response.ok) {
        toast.success('Invoice status updated')
        setIsDialogOpen(false)
        fetchLoads()
      } else {
        throw new Error('Failed to update invoice status')
      }
    } catch (error) {
      console.error('Error updating invoice status:', error)
      toast.success('Error')
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
        <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
        <p className="text-gray-600 mt-1">
          Track invoices, QuickBooks entry, and payment status
        </p>
      </div>

      {loads.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Pending Invoices
          </h3>
          <p className="text-gray-600">
            All loads are either not arrived yet or have been marked as paid
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
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arrival Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  QuickBooks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loads.map((load) => (
                <tr key={load.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{load.load_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{load.supplier_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{load.invoice_number || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.invoice_total ? `$${load.invoice_total.toFixed(2)}` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.invoice_date ? new Date(load.invoice_date).toLocaleDateString() : '-'}
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
                    {load.entered_in_quickbooks ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Entered
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenInvoiceDialog(load)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Manage
                    </Button>
                    {load.documents && load.documents.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(load.documents[0].file_path, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Management Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Invoice - {selectedLoad?.load_id}</DialogTitle>
          </DialogHeader>
          
          {selectedLoad && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-500">Supplier</Label>
                  <div className="font-medium">{selectedLoad.supplier_name}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Invoice Number</Label>
                  <div className="font-medium">{selectedLoad.invoice_number || '-'}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Invoice Total</Label>
                  <div className="font-medium">
                    {selectedLoad.invoice_total ? `$${selectedLoad.invoice_total.toFixed(2)}` : '-'}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Invoice Date</Label>
                  <div className="font-medium">
                    {selectedLoad.invoice_date 
                      ? new Date(selectedLoad.invoice_date).toLocaleDateString()
                      : '-'}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Arrival Date</Label>
                  <div className="font-medium">
                    {selectedLoad.actual_arrival_date 
                      ? new Date(selectedLoad.actual_arrival_date).toLocaleDateString()
                      : '-'}
                  </div>
                </div>
              </div>

              {/* Paperwork */}
              {selectedLoad.documents && selectedLoad.documents.length > 0 && (
                <div>
                  <Label>Attached Documents</Label>
                  <div className="mt-2 space-y-2">
                    {selectedLoad.documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{doc.file_name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(doc.file_path, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Toggles */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="quickbooks"
                    checked={enteredInQuickbooks}
                    onCheckedChange={(checked) => setEnteredInQuickbooks(checked as boolean)}
                  />
                  <Label htmlFor="quickbooks" className="cursor-pointer">
                    Entered in QuickBooks
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paid"
                    checked={isPaid}
                    onCheckedChange={(checked) => setIsPaid(checked as boolean)}
                  />
                  <Label htmlFor="paid" className="cursor-pointer font-semibold">
                    Mark as Paid
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveInvoiceStatus}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
