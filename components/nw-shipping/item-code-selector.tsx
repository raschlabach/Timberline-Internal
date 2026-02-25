'use client'

import { useState, useRef, useEffect } from 'react'

interface ArchboldPart {
  id: number
  item_code: string
  width: number | null
  length: number | null
  used_for: string | null
}

interface ItemCodeSelectorProps {
  parts: ArchboldPart[]
  selectedPartId: number | null
  onSelect: (part: ArchboldPart | null) => void
}

export function ItemCodeSelector({ parts, selectedPartId, onSelect }: ItemCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedPart = parts.find(p => p.id === selectedPartId) || null

  const filteredParts = parts.filter(p => {
    const term = searchTerm.toLowerCase()
    return (
      p.item_code.toLowerCase().includes(term) ||
      (p.used_for && p.used_for.toLowerCase().includes(term))
    )
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        if (selectedPart) {
          setSearchTerm(selectedPart.item_code)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedPart])

  useEffect(() => {
    if (selectedPart) {
      setSearchTerm(selectedPart.item_code)
    } else {
      setSearchTerm('')
    }
  }, [selectedPartId, selectedPart])

  function handleFocus() {
    setIsOpen(true)
    setSearchTerm('')
  }

  function handleSelectPart(part: ArchboldPart) {
    onSelect(part)
    setSearchTerm(part.item_code)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        className="w-full h-8 px-2 text-xs border border-gray-300 rounded focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value)
          setIsOpen(true)
        }}
        onFocus={handleFocus}
      />
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
          {filteredParts.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No items found</div>
          ) : (
            filteredParts.map(part => (
              <button
                key={part.id}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between ${
                  part.id === selectedPartId ? 'bg-blue-50 text-blue-700' : ''
                }`}
                onClick={() => handleSelectPart(part)}
              >
                <div>
                  <span className="font-medium">{part.item_code}</span>
                  {part.used_for && (
                    <span className="text-gray-400 ml-2">— {part.used_for}</span>
                  )}
                </div>
                <span className="text-gray-400 text-[10px] whitespace-nowrap ml-2">
                  {part.width && part.length ? `${part.width} × ${part.length}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
