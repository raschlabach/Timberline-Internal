'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateOrder, useUpdateOrder, useCharcoalCustomers } from './use-charcoal'
import { CharcoalOrder } from '@/types/charcoal'
import { toast } from 'sonner'

const orderSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  quantity: z.coerce.number().int().min(1, 'At least 1 skid'),
  due_date: z.string().optional(),
  notes: z.string().optional(),
})

type OrderFormValues = z.infer<typeof orderSchema>

interface OrderDialogProps {
  isOpen: boolean
  onClose: () => void
  editingOrder?: CharcoalOrder | null
}

export function OrderDialog({ isOpen, onClose, editingOrder }: OrderDialogProps) {
  const createOrder = useCreateOrder()
  const updateOrder = useUpdateOrder()
  const { data: custData } = useCharcoalCustomers()
  const customers = custData?.customers ?? []
  const isEditing = !!editingOrder

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: { customer_id: '', quantity: 1, due_date: '', notes: '' },
  })

  const selectedCustomer = watch('customer_id')

  useEffect(() => {
    if (editingOrder) {
      setValue('customer_id', editingOrder.customer_id)
      setValue('quantity', editingOrder.quantity)
      setValue('due_date', editingOrder.due_date ? editingOrder.due_date.split('T')[0] : '')
      setValue('notes', editingOrder.notes || '')
    } else {
      reset({ customer_id: '', quantity: 1, due_date: '', notes: '' })
    }
  }, [editingOrder, setValue, reset])

  async function onSubmit(data: OrderFormValues) {
    try {
      if (isEditing) {
        await updateOrder.mutateAsync({
          id: editingOrder!.id,
          customer_id: data.customer_id,
          quantity: data.quantity,
          due_date: data.due_date || undefined,
          notes: data.notes || undefined,
        })
        toast.success('Order updated')
      } else {
        await createOrder.mutateAsync({
          customer_id: data.customer_id,
          quantity: data.quantity,
          due_date: data.due_date || undefined,
          notes: data.notes || undefined,
        })
        toast.success('Order created')
      }
      onClose()
      reset()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save order')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Order' : 'Add Order'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={selectedCustomer} onValueChange={(v) => setValue('customer_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.is_walnut_creek ? ' (WC)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customer_id && <p className="text-xs text-destructive">{errors.customer_id.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (skids)</Label>
            <Input id="quantity" type="number" min={1} {...register('quantity')} />
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Due date (optional)</Label>
            <Input id="due_date" type="date" {...register('due_date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register('notes')} placeholder="Optional notes..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createOrder.isPending || updateOrder.isPending}>
              {isEditing ? 'Save Changes' : 'Add Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
