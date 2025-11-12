"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RotateCw } from "lucide-react"

const MINI_CELL_SIZE = 12 // pixels per foot for mini skids

const CUSTOMER_COLORS = [
  'bg-blue-100',
  'bg-green-100',
  'bg-purple-100',
  'bg-orange-100',
  'bg-pink-100',
  'bg-yellow-100',
  'bg-indigo-100',
  'bg-red-100',
  'bg-teal-100',
  'bg-cyan-100',
]

interface MiniSkidProps {
  width: number
  length: number
  type: 'skid' | 'vinyl'
  isSelected: boolean
  isUsed: boolean
  customerId: number
  customerName: string
  onRotate: () => void
  onClick: () => void
  isRotated?: boolean
}

export function MiniSkid({ 
  width, 
  length, 
  type, 
  isSelected, 
  isUsed, 
  customerId,
  customerName,
  onRotate,
  onClick,
  isRotated = false
}: MiniSkidProps) {
  const [localRotated, setLocalRotated] = useState(isRotated)

  useEffect(() => {
    setLocalRotated(isRotated)
  }, [isRotated])

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRotate()
  }

  const displayWidth = localRotated ? length : width
  const displayLength = localRotated ? width : length

  // Get the base color class without the bg- prefix
  const colorClass = CUSTOMER_COLORS[customerId % CUSTOMER_COLORS.length]
  const borderColorClass = colorClass.replace('bg-', 'border-')

  return (
    <div
      className={`relative p-2 rounded transition-colors border-2 ${
        isSelected
          ? 'bg-blue-100 border-blue-300'
          : isUsed
          ? 'bg-gray-100 border-gray-300'
          : `hover:bg-gray-50 ${borderColorClass}`
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Mini visual representation */}
        <div className="relative">
          <div
            className={`border-2 border-black ${type === 'vinyl' ? 'border-dashed' : ''} ${isUsed ? 'bg-gray-100' : colorClass}`}
            style={{
              width: displayWidth * MINI_CELL_SIZE,
              height: displayLength * MINI_CELL_SIZE,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-[8px] text-center">
              {displayWidth}' × {displayLength}'
            </div>
          </div>
          {!isUsed && (
            <Button
              variant="outline"
              size="icon"
              className="absolute -top-2 -right-2 h-5 w-5 bg-white/90 hover:bg-white shadow-sm"
              onClick={handleRotate}
            >
              <RotateCw className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* Info text */}
        <div className="flex-1">
          <div className="text-xs">
            {type === 'skid' ? 'Skid' : 'Vinyl'}
          </div>
          <div className="text-xs text-gray-500">
            {width * length} ft²
          </div>
        </div>
      </div>
    </div>
  )
} 