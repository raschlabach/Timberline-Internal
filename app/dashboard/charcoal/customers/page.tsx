'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useCharcoalCustomers, useDeleteCustomer } from '@/components/charcoal/use-charcoal'
import { CharcoalCustomer } from '@/types/charcoal'
import { CustomerDialog } from '@/components/charcoal/customer-dialog'
import { ConfirmDeleteDialog } from '@/components/charcoal/confirm-delete-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function CharcoalCustomersPage() {
  const { data: session } = useSession()
  const { data, isLoading } = useCharcoalCustomers()
  const deleteCustomer = useDeleteCustomer()

  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CharcoalCustomer | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const role = session?.user?.role
  const isOffice = role === 'admin' || role === 'user'

  const customers = data?.customers ?? []
  const filtered = search
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : customers

  async function handleDelete() {
    if (!deletingId) return
    try {
      await deleteCustomer.mutateAsync(deletingId)
      toast.success('Customer deleted')
      setDeletingId(null)
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete customer')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Charcoal Customers</h1>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Charcoal Customers</h1>
        {isOffice && (
          <Button onClick={() => { setEditingCustomer(null); setIsDialogOpen(true) }}>
            <Plus size={16} className="mr-1" /> Add Customer
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground">{filtered.length} customers</span>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {customers.length === 0 ? 'No customers yet — add your first' : 'No customers match your search'}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.contact_name || '—'}</TableCell>
                      <TableCell>{c.phone || '—'}</TableCell>
                      <TableCell>{c.email || '—'}</TableCell>
                      <TableCell>
                        {c.is_walnut_creek ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-200">Walnut Creek</Badge>
                        ) : (
                          <Badge variant="secondary">Standard</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isOffice && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCustomer(c); setIsDialogOpen(true) }}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingId(c.id)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerDialog isOpen={isDialogOpen} onClose={() => { setIsDialogOpen(false); setEditingCustomer(null) }} editingCustomer={editingCustomer} />
      <ConfirmDeleteDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete this customer?"
        description="This customer will be permanently deleted. Existing orders must be removed first."
        isPending={deleteCustomer.isPending}
      />
    </div>
  )
}
