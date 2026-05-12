'use client'

import { useState, useEffect } from 'react'
import { CharcoalSkid } from '@/types/charcoal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { SkidDialog } from './skid-dialog'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import { useDeleteSkid } from './use-charcoal'
import { toast } from 'sonner'

interface InventoryPanelProps {
  skids: CharcoalSkid[]
  stdCount: number
  wcCount: number
  lastSkid: { wrapped_at: string; wrapped_by_name: string; is_walnut_creek: boolean } | null
  isOffice: boolean
  canEditSkids: boolean
}

function formatWrappedTime(dateStr: string): string {
  const d = new Date(dateStr)
  if (isToday(d)) return `Today ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`
  return format(d, 'MMM d h:mm a')
}

export function InventoryPanel({ skids, stdCount, wcCount, lastSkid, isOffice, canEditSkids }: InventoryPanelProps) {
  const [isSkidDialogOpen, setIsSkidDialogOpen] = useState(false)
  const [editingSkid, setEditingSkid] = useState<CharcoalSkid | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleteSkid = useDeleteSkid()

  const [lastWrappedText, setLastWrappedText] = useState('')

  useEffect(() => {
    if (!lastSkid) return
    function update() {
      setLastWrappedText(formatDistanceToNow(new Date(lastSkid!.wrapped_at), { addSuffix: true }))
    }
    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [lastSkid])

  async function handleDelete() {
    if (!deletingId) return
    try {
      await deleteSkid.mutateAsync(deletingId)
      toast.success('Skid deleted')
      setDeletingId(null)
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete skid')
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package size={18} />
              Inventory — Wrapped Skids
            </CardTitle>
            {canEditSkids && (
              <Button size="sm" onClick={() => { setEditingSkid(null); setIsSkidDialogOpen(true) }}>
                <Plus size={14} className="mr-1" /> Add Skid
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{stdCount}</div>
              <div className="text-xs text-muted-foreground">Standard skids</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
              <div className="text-2xl font-bold text-amber-900">{wcCount}</div>
              <div className="text-xs text-amber-700">Walnut Creek skids</div>
            </div>
          </div>

          {lastSkid && (stdCount + wcCount) > 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              Last wrapped: <span className="font-medium">{lastWrappedText}</span>
              {lastSkid.wrapped_by_name && <> by {lastSkid.wrapped_by_name}</>}
              {lastSkid.is_walnut_creek && <> — <span className="text-amber-700">Walnut Creek</span></>}
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent activity — last 25 skids</h4>
            {skids.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Inventory empty — wrap your first skid</p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {skids.map((skid) => (
                  <div key={skid.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatWrappedTime(skid.wrapped_at)}
                      </span>
                      {skid.wrapped_by_name && (
                        <span className="text-xs">— {skid.wrapped_by_name}</span>
                      )}
                      <Badge className={skid.is_walnut_creek
                        ? 'bg-amber-100 text-amber-900 border-amber-200 text-[10px] px-1.5 py-0'
                        : 'bg-gray-100 text-gray-700 border-gray-200 text-[10px] px-1.5 py-0'
                      }>
                        {skid.is_walnut_creek ? 'Walnut Creek' : 'Standard'}
                      </Badge>
                      {skid.notes && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">{skid.notes}</span>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs max-w-xs">{skid.notes}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {canEditSkids && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingSkid(skid); setIsSkidDialogOpen(true) }}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeletingId(skid.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <SkidDialog isOpen={isSkidDialogOpen} onClose={() => { setIsSkidDialogOpen(false); setEditingSkid(null) }} editingSkid={editingSkid} />
      <ConfirmDeleteDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete this skid?"
        description="This skid will be permanently removed from inventory. Projections will not be restored."
        isPending={deleteSkid.isPending}
      />
    </>
  )
}
