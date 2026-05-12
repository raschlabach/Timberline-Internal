'use client'

import { useState } from 'react'
import { CharcoalProjectedSkid } from '@/types/charcoal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react'
import { ProjectionDialog } from './projection-dialog'
import { safeFormatDate } from './date-helpers'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import { useDeleteProjection } from './use-charcoal'
import { toast } from 'sonner'

interface ProjectionsPanelProps {
  projections: CharcoalProjectedSkid[]
  totalProj: number
  isOffice: boolean
}

export function ProjectionsPanel({ projections, totalProj, isOffice }: ProjectionsPanelProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProjection, setEditingProjection] = useState<CharcoalProjectedSkid | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleteProjection = useDeleteProjection()

  async function handleDelete() {
    if (!deletingId) return
    try {
      await deleteProjection.mutateAsync(deletingId)
      toast.success('Projection deleted')
      setDeletingId(null)
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete projection')
    }
  }

  const grouped = projections.reduce<Record<string, CharcoalProjectedSkid[]>>((acc, p) => {
    const key = String(p.ready_date).split('T')[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort()

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp size={18} />
                Projected Production
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Raw charcoal skids expected to be ready</p>
            </div>
            {isOffice && (
              <Button size="sm" onClick={() => { setEditingProjection(null); setIsDialogOpen(true) }}>
                <Plus size={14} className="mr-1" /> Add Projection
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{totalProj}</div>
            <div className="text-xs text-muted-foreground">Total projected skids</div>
          </div>

          {sortedDates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No projections yet — add a planned batch</p>
          ) : (
            <div className="space-y-1">
              {sortedDates.map(date => (
                grouped[date].map(proj => (
                  <div key={proj.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm group">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{safeFormatDate(date, 'MMM d')}</span>
                      <span>— {proj.count} skids</span>
                      {proj.notes && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{proj.notes}</span>}
                    </div>
                    {isOffice && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingProjection(proj); setIsDialogOpen(true) }}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeletingId(proj.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProjectionDialog isOpen={isDialogOpen} onClose={() => { setIsDialogOpen(false); setEditingProjection(null) }} editingProjection={editingProjection} />
      <ConfirmDeleteDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete this projection?"
        description="This projected production entry will be permanently deleted."
        isPending={deleteProjection.isPending}
      />
    </>
  )
}
