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
import { useCreateProjection, useUpdateProjection } from './use-charcoal'
import { CharcoalProjectedSkid } from '@/types/charcoal'
import { toast } from 'sonner'

const projectionSchema = z.object({
  count: z.coerce.number().int().min(1, 'At least 1'),
  ready_date: z.string().min(1, 'Date is required'),
  is_walnut_creek: z.boolean(),
  notes: z.string().optional(),
})

type ProjectionFormValues = z.infer<typeof projectionSchema>

interface ProjectionDialogProps {
  isOpen: boolean
  onClose: () => void
  editingProjection?: CharcoalProjectedSkid | null
}

export function ProjectionDialog({ isOpen, onClose, editingProjection }: ProjectionDialogProps) {
  const createProjection = useCreateProjection()
  const updateProjection = useUpdateProjection()
  const isEditing = !!editingProjection

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProjectionFormValues>({
    resolver: zodResolver(projectionSchema),
    defaultValues: { count: 1, ready_date: '', is_walnut_creek: false, notes: '' },
  })

  const isWC = watch('is_walnut_creek')

  useEffect(() => {
    if (editingProjection) {
      setValue('count', editingProjection.count)
      setValue('ready_date', editingProjection.ready_date.split('T')[0])
      setValue('is_walnut_creek', editingProjection.is_walnut_creek)
      setValue('notes', editingProjection.notes || '')
    } else {
      reset({ count: 1, ready_date: '', is_walnut_creek: false, notes: '' })
    }
  }, [editingProjection, setValue, reset])

  async function onSubmit(data: ProjectionFormValues) {
    try {
      if (isEditing) {
        await updateProjection.mutateAsync({
          id: editingProjection!.id,
          count: data.count,
          ready_date: data.ready_date,
          is_walnut_creek: data.is_walnut_creek,
          notes: data.notes || undefined,
        })
        toast.success('Projection updated')
      } else {
        await createProjection.mutateAsync({
          count: data.count,
          ready_date: data.ready_date,
          is_walnut_creek: data.is_walnut_creek,
          notes: data.notes || undefined,
        })
        toast.success('Projection added')
      }
      onClose()
      reset()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save projection')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Projection' : 'Add Projection'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proj-count">Count (skids)</Label>
            <Input id="proj-count" type="number" min={1} {...register('count')} />
            {errors.count && <p className="text-xs text-destructive">{errors.count.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ready_date">Ready date</Label>
            <Input id="ready_date" type="date" {...register('ready_date')} />
            {errors.ready_date && <p className="text-xs text-destructive">{errors.ready_date.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="proj-wc"
              checked={isWC}
              onCheckedChange={(v) => setValue('is_walnut_creek', !!v)}
            />
            <Label htmlFor="proj-wc">Walnut Creek</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-notes">Notes</Label>
            <Textarea id="proj-notes" rows={2} {...register('notes')} placeholder="Optional notes..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createProjection.isPending || updateProjection.isPending}>
              {isEditing ? 'Save Changes' : 'Add Projection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
