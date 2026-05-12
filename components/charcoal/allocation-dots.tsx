'use client'

import { CharcoalAllocation } from '@/types/charcoal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { safeFormatDate } from './date-helpers'

interface AllocationDotsProps {
  quantity: number
  allocation: CharcoalAllocation | undefined
}

export function AllocationDots({ quantity, allocation }: AllocationDotsProps) {
  const green = allocation?.greenCount ?? 0
  const orangeTotal = allocation?.orangePieces?.reduce((s, p) => s + p.count, 0) ?? 0
  const gray = Math.max(0, quantity - green - orangeTotal)

  const projectedLabel = allocation?.orangePieces
    ?.map(p => `${p.count} by ${safeFormatDate(p.readyDate, 'MMM d')}`)
    .join(', ')

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 flex-wrap">
        {Array.from({ length: quantity }).map((_, i) => {
          let color = 'bg-zinc-200'
          if (i < green) color = 'bg-green-500'
          else if (i < green + orangeTotal) color = 'bg-orange-400'
          return <span key={i} className={`size-2.5 rounded-full ${color} inline-block`} />
        })}
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight">
        {green > 0 && <span>{green} ready</span>}
        {orangeTotal > 0 && <span>{green > 0 ? ' · ' : ''}{projectedLabel}</span>}
        {gray > 0 && <span>{(green > 0 || orangeTotal > 0) ? ' · ' : ''}{gray} short</span>}
      </p>
    </div>
  )
}
