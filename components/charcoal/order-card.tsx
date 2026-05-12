'use client'

import { CharcoalOrder, CharcoalAllocation } from '@/types/charcoal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AllocationDots } from './allocation-dots'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface OrderCardProps {
  order: CharcoalOrder
  allocation: CharcoalAllocation | undefined
  isOffice: boolean
  isDragging?: boolean
  dragHandleProps?: any
  onEdit?: () => void
  onDelete?: () => void
}

export function OrderCard({ order, allocation, isOffice, isDragging, dragHandleProps, onEdit, onDelete }: OrderCardProps) {
  return (
    <Card className={`p-3 transition-shadow ${isDragging ? 'shadow-lg ring-2 ring-blue-200' : 'hover:shadow-md'}`}>
      <div className="flex items-start gap-2">
        {isOffice && (
          <div {...dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0">
            <GripVertical size={16} />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{order.customer_name}</span>
            {order.customer_is_walnut_creek && (
              <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] px-1.5 py-0">
                Walnut Creek
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{order.quantity} skids</span>
            {order.due_date && (
              <span>Due {format(new Date(order.due_date + 'T00:00:00'), 'MMM d')}</span>
            )}
          </div>
          {order.notes && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground truncate max-w-[260px]">{order.notes}</p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">{order.notes}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <AllocationDots quantity={order.quantity} allocation={allocation} />
        </div>
        {isOffice && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
