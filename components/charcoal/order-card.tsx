'use client'

import { CharcoalOrder, CharcoalAllocation } from '@/types/charcoal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AllocationDots } from './allocation-dots'
import { GripVertical, Pencil, Trash2, MessageSquare, CheckCircle2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { safeFormatDate } from './date-helpers'

interface OrderCardProps {
  order: CharcoalOrder
  allocation: CharcoalAllocation | undefined
  isOffice: boolean
  isDragging?: boolean
  dragHandleProps?: any
  onEdit?: () => void
  onDelete?: () => void
  onComplete?: () => void
}

export function OrderCard({ order, allocation, isOffice, isDragging, dragHandleProps, onEdit, onDelete, onComplete }: OrderCardProps) {
  return (
    <Card className={`p-2.5 transition-shadow ${isDragging ? 'shadow-lg ring-2 ring-blue-200' : 'hover:shadow-md'}`}>
      <div className="flex items-center gap-2">
        {isOffice && (
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0">
            <GripVertical size={16} />
          </div>
        )}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="min-w-0 shrink">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm">{order.customer_name}</span>
              {order.customer_is_walnut_creek && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] px-1.5 py-0">
                  WC
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-semibold">{order.quantity} skids</span>
              {order.due_date && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">Due {safeFormatDate(order.due_date, 'MMM d')}</span>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 ml-auto">
            <AllocationDots quantity={order.quantity} allocation={allocation} />
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {order.notes && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <MessageSquare size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">{order.notes}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isOffice && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={onComplete}>
                      <CheckCircle2 size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Mark completed</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
