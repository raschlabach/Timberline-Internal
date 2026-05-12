'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useCreateSkid, useUpdateSkid } from './use-charcoal'
import { CharcoalSkid } from '@/types/charcoal'
import { toast } from 'sonner'

const skidSchema = z.object({
  is_walnut_creek: z.boolean(),
  notes: z.string().optional(),
  wrapped_at: z.string().optional(),
})

type SkidFormValues = z.infer<typeof skidSchema>

interface SkidDialogProps {
  isOpen: boolean
  onClose: () => void
  editingSkid?: CharcoalSkid | null
}

export function SkidDialog({ isOpen, onClose, editingSkid }: SkidDialogProps) {
  const createSkid = useCreateSkid()
  const updateSkid = useUpdateSkid()
  const isEditing = !!editingSkid

  const { register, handleSubmit, reset, setValue, watch } = useForm<SkidFormValues>({
    resolver: zodResolver(skidSchema),
    defaultValues: {
      is_walnut_creek: false,
      notes: '',
      wrapped_at: '',
    },
  })

  const isWalnutCreek = watch('is_walnut_creek')

  useEffect(() => {
    if (editingSkid) {
      setValue('is_walnut_creek', editingSkid.is_walnut_creek)
      setValue('notes', editingSkid.notes || '')
      const localDt = new Date(editingSkid.wrapped_at)
      setValue('wrapped_at', localDt.toISOString().slice(0, 16))
    } else {
      reset({ is_walnut_creek: false, notes: '', wrapped_at: '' })
    }
  }, [editingSkid, setValue, reset])

  async function onSubmit(data: SkidFormValues) {
    try {
      if (isEditing) {
        await updateSkid.mutateAsync({
          id: editingSkid!.id,
          is_walnut_creek: data.is_walnut_creek,
          notes: data.notes || undefined,
          wrapped_at: data.wrapped_at || undefined,
        })
        toast.success('Skid updated')
      } else {
        await createSkid.mutateAsync({
          is_walnut_creek: data.is_walnut_creek,
          notes: data.notes || undefined,
          wrapped_at: data.wrapped_at || undefined,
        })
        toast.success('Skid added')
      }
      onClose()
      reset()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save skid')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Skid' : 'Add Skid'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="wc-toggle" className="font-medium">Walnut Creek wrap</Label>
            <Switch
              id="wc-toggle"
              checked={isWalnutCreek}
              onCheckedChange={(v) => setValue('is_walnut_creek', v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wrapped_at">Wrapped at (defaults to now)</Label>
            <Input id="wrapped_at" type="datetime-local" {...register('wrapped_at')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register('notes')} placeholder="Optional notes..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createSkid.isPending || updateSkid.isPending}>
              {isEditing ? 'Save Changes' : 'Add Skid'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
