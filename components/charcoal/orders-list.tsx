'use client'

import { useState, useCallback } from 'react'
import { CharcoalOrder, CharcoalAllocation } from '@/types/charcoal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, ClipboardList } from 'lucide-react'
import { OrderCard } from './order-card'
import { OrderDialog } from './order-dialog'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import { useDeleteOrder, useReorderOrders, useCompleteOrder } from './use-charcoal'
import { toast } from 'sonner'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface OrdersListProps {
  orders: CharcoalOrder[]
  allocation: Record<string, CharcoalAllocation>
  isOffice: boolean
}

function SortableOrderCard({ order, allocation, isOffice, onEdit, onDelete, onComplete }: {
  order: CharcoalOrder
  allocation: CharcoalAllocation | undefined
  isOffice: boolean
  onEdit: () => void
  onDelete: () => void
  onComplete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: order.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <OrderCard
        order={order}
        allocation={allocation}
        isOffice={isOffice}
        isDragging={isDragging}
        dragHandleProps={isOffice ? listeners : undefined}
        onEdit={onEdit}
        onDelete={onDelete}
        onComplete={onComplete}
      />
    </div>
  )
}

export function OrdersList({ orders, allocation, isOffice }: OrdersListProps) {
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<CharcoalOrder | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)

  const deleteOrder = useDeleteOrder()
  const completeOrder = useCompleteOrder()
  const reorderOrders = useReorderOrders()

  const [localOrders, setLocalOrders] = useState<CharcoalOrder[] | null>(null)
  const displayOrders = localOrders ?? orders

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = displayOrders.findIndex(o => o.id === active.id)
    const newIndex = displayOrders.findIndex(o => o.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrders = arrayMove(displayOrders, oldIndex, newIndex)
    setLocalOrders(newOrders)

    reorderOrders.mutate(newOrders.map(o => o.id), {
      onSuccess: () => setLocalOrders(null),
      onError: () => {
        setLocalOrders(null)
        toast.error('Failed to reorder — reverted')
      },
    })
  }, [displayOrders, reorderOrders])

  async function handleDelete() {
    if (!deletingId) return
    try {
      await deleteOrder.mutateAsync(deletingId)
      toast.success('Order deleted')
      setDeletingId(null)
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete order')
    }
  }

  async function handleComplete() {
    if (!completingId) return
    try {
      await completeOrder.mutateAsync(completingId)
      toast.success('Order completed — skids removed from inventory')
      setCompletingId(null)
    } catch (e: any) {
      toast.error(e.message || 'Failed to complete order')
    }
  }

  return (
    <>
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList size={18} />
                Open Orders — Priority
              </CardTitle>
              {isOffice && (
                <p className="text-xs text-muted-foreground mt-0.5">Top of list = highest priority. Drag to reorder.</p>
              )}
            </div>
            {isOffice && (
              <Button size="sm" onClick={() => { setEditingOrder(null); setIsOrderDialogOpen(true) }}>
                <Plus size={14} className="mr-1" /> Add Order
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {displayOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isOffice ? 'No open orders yet — click Add Order' : 'No open orders'}
            </p>
          ) : isOffice ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayOrders.map(o => o.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {displayOrders.map((order) => (
                    <SortableOrderCard
                      key={order.id}
                      order={order}
                      allocation={allocation[order.id]}
                      isOffice={isOffice}
                      onEdit={() => { setEditingOrder(order); setIsOrderDialogOpen(true) }}
                      onDelete={() => setDeletingId(order.id)}
                      onComplete={() => setCompletingId(order.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="space-y-2">
              {displayOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  allocation={allocation[order.id]}
                  isOffice={false}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDialog isOpen={isOrderDialogOpen} onClose={() => { setIsOrderDialogOpen(false); setEditingOrder(null) }} editingOrder={editingOrder} />
      <ConfirmDeleteDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete this order?"
        description="This order will be permanently removed."
        isPending={deleteOrder.isPending}
      />
      <ConfirmDeleteDialog
        isOpen={!!completingId}
        onClose={() => setCompletingId(null)}
        onConfirm={handleComplete}
        title="Complete this order?"
        description="This will mark the order as completed and remove the matching skids from inventory."
        isPending={completeOrder.isPending}
      />
    </>
  )
}
