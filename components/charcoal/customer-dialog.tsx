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
import { Checkbox } from '@/components/ui/checkbox'
import { useCreateCustomer, useUpdateCustomer } from './use-charcoal'
import { CharcoalCustomer } from '@/types/charcoal'
import { toast } from 'sonner'

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  is_walnut_creek: z.boolean(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

interface CustomerDialogProps {
  isOpen: boolean
  onClose: () => void
  editingCustomer?: CharcoalCustomer | null
}

export function CustomerDialog({ isOpen, onClose, editingCustomer }: CustomerDialogProps) {
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const isEditing = !!editingCustomer

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', contact_name: '', phone: '', email: '', notes: '', is_walnut_creek: false },
  })

  const isWC = watch('is_walnut_creek')

  useEffect(() => {
    if (editingCustomer) {
      setValue('name', editingCustomer.name)
      setValue('contact_name', editingCustomer.contact_name || '')
      setValue('phone', editingCustomer.phone || '')
      setValue('email', editingCustomer.email || '')
      setValue('notes', editingCustomer.notes || '')
      setValue('is_walnut_creek', editingCustomer.is_walnut_creek)
    } else {
      reset({ name: '', contact_name: '', phone: '', email: '', notes: '', is_walnut_creek: false })
    }
  }, [editingCustomer, setValue, reset])

  async function onSubmit(data: CustomerFormValues) {
    try {
      if (isEditing) {
        await updateCustomer.mutateAsync({ id: editingCustomer!.id, ...data })
        toast.success('Customer updated')
      } else {
        await createCustomer.mutateAsync(data)
        toast.success('Customer created')
      }
      onClose()
      reset()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save customer')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cust-name">Name *</Label>
            <Input id="cust-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-contact">Contact name</Label>
            <Input id="cust-contact" {...register('contact_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cust-phone">Phone</Label>
              <Input id="cust-phone" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-email">Email</Label>
              <Input id="cust-email" type="email" {...register('email')} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cust-wc"
              checked={isWC}
              onCheckedChange={(v) => setValue('is_walnut_creek', !!v)}
            />
            <Label htmlFor="cust-wc">Walnut Creek customer</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-notes">Notes</Label>
            <Textarea id="cust-notes" rows={2} {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
              {isEditing ? 'Save Changes' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
