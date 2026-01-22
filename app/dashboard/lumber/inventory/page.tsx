'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { InventoryGroup, InventoryLoadDetail, LumberPackWithDetails } from '@/types/lumber'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChevronDown, ChevronRight, Eye, GripVertical, Printer, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#d084d0', '#a4de6c']

// Sortable Species Row Component
function SortableSpeciesRow({ 
  id, 
  speciesData, 
  thickness,
  speciesColors,
  isExpanded,
  onToggle,
  onGradeClick,
  children 
}: {
  id: string
  speciesData: any
  thickness: string
  speciesColors: Record<string, string>
  isExpanded: boolean
  onToggle: () => void
  onGradeClick: (grade: any, loadsWithInventory: any[]) => void
  children?: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className="bg-blue-50/20 hover:bg-blue-50/40 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-1 py-1">
          <div className="flex items-center gap-1">
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => { e.stopPropagation(); }}
              className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </td>
        <td className="px-1 py-1 whitespace-nowrap">
          <div className="flex items-center gap-1 pl-2">
            <span className="text-gray-400 text-sm">└</span>
          </div>
        </td>
        <td className="px-1 py-1 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span 
              className="w-3 h-3 rounded flex-shrink-0" 
              style={{ backgroundColor: speciesColors[speciesData.species] || '#6B7280' }}
            />
            <span className="text-sm font-semibold text-gray-900">{speciesData.species}</span>
          </div>
        </td>
        <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-500 italic">
          All Grades
        </td>
        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-gray-700">
          {speciesData.loads_with_inventory}
        </td>
        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-gray-700">
          {speciesData.pack_count}
        </td>
        <td className="px-1 py-1 whitespace-nowrap text-sm text-right">
          <span className="font-medium text-green-600">
            {speciesData.average_price ? `$${speciesData.average_price.toFixed(3)}` : '-'}
          </span>
        </td>
        <td className="px-1 py-1 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
          {speciesData.current_inventory.toLocaleString()}
        </td>
        <td className="px-1 py-1 whitespace-nowrap text-sm text-right">
          <span className="font-semibold text-purple-600">
            {speciesData.total_value > 0 ? `$${speciesData.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
          </span>
        </td>
        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-blue-700">
          {speciesData.incoming_load_count}
        </td>
        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-blue-700">
          {speciesData.incoming_footage.toLocaleString()}
        </td>
      </tr>
      {isExpanded && children}
    </>
  )
}

interface SpeciesColumnProps {
  species: string
  grades: Array<{
    grade: string
    total_actual: number
    total_finished: number
    current_inventory: number
    load_count: number
    average_price: number | null
    pack_count: number
    loads_with_inventory: number
    total_value: number
    incoming_footage: number
    incoming_load_count: number
    incoming_with_driver: number
    groups: InventoryGroup[]
  }>
  total_actual: number
  total_finished: number
  current_inventory: number
  load_count: number
  average_price: number | null
  color: string
  onGradeClick: (species: string, grade: string, loads: InventoryLoadDetail[]) => void
}

function SortableSpeciesColumn({ species, grades, total_actual, total_finished, current_inventory, load_count, average_price, color, onGradeClick }: SpeciesColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: species })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 w-56"
    >
      <div
        className="border rounded bg-white shadow-sm hover:shadow transition-shadow"
        style={{ borderTopColor: color, borderTopWidth: '3px' }}
      >
        {/* Species Header */}
        <div
          {...attributes}
          {...listeners}
          className="px-1.5 py-1 bg-gray-50 border-b cursor-move flex items-center gap-1 hover:bg-gray-100 transition-colors"
        >
          <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span
              className="w-2 h-2 rounded flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] font-semibold text-gray-900 truncate">{species}</span>
          </div>
        </div>

        {/* Species Totals */}
        <div className="px-1.5 py-0.5 border-b bg-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Inv:</span>
            <span className="text-sm font-bold text-blue-600">
              {current_inventory.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Total:</span>
            <span className="text-xs font-semibold text-gray-700">
              {total_actual.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Price:</span>
            <span className="text-xs font-semibold text-green-600">
              {average_price ? `$${average_price.toFixed(3)}` : '-'}
            </span>
          </div>
        </div>

        {/* Grade Boxes */}
        <div className="p-0.5">
          {grades.map((grade) => (
            <div key={grade.grade} className="flex gap-1 mb-0.5">
              {/* Grade Box */}
              <div 
                className="flex-1 border rounded p-1 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  // Get all loads with inventory for this grade
                  const loadsWithInventory = grade.groups.flatMap(g => 
                    g.loads.filter(load => load.load_inventory > 0)
                  )
                  onGradeClick(species, grade.grade, loadsWithInventory)
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">{grade.grade}</span>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Loads:</span>
                    <span className="text-xs font-semibold text-gray-700">
                      {grade.loads_with_inventory}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Packs:</span>
                    <span className="text-xs font-semibold text-gray-700">
                      {grade.pack_count}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">BF:</span>
                    <span className="text-xs font-bold text-blue-600">
                      {grade.current_inventory.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">$/BF:</span>
                    <span className="text-xs font-semibold text-green-600">
                      {grade.average_price ? `$${grade.average_price.toFixed(3)}` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Value:</span>
                    <span className="text-xs font-bold text-purple-600">
                      {grade.total_value > 0 ? `$${grade.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Incoming Box */}
              <div className="flex-1 border rounded p-1 bg-blue-50 border-blue-300">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-semibold text-blue-900">Incoming</span>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700">Loads:</span>
                    <span className="text-xs font-semibold text-blue-900">
                      {grade.incoming_load_count}
                    </span>
                  </div>
                  <div className="flex justify-between items-center opacity-0 pointer-events-none">
                    <span className="text-xs">Packs:</span>
                    <span className="text-xs">-</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700">BF:</span>
                    <span className="text-xs font-bold text-blue-900">
                      {grade.incoming_footage.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [expandedThicknesses, setExpandedThicknesses] = useState<Set<string>>(new Set(['4/4']))
  const [expandedSpecies, setExpandedSpecies] = useState<Set<string>>(new Set())
  const [speciesColors, setSpeciesColors] = useState<Record<string, string>>({})
  const [speciesColumnOrder, setSpeciesColumnOrder] = useState<string[]>([])
  const [speciesOrderByThickness, setSpeciesOrderByThickness] = useState<Record<string, string[]>>({})
  const [incomingLoads, setIncomingLoads] = useState<any[]>([])
  
  // Rip Entry Dialog state
  const [ripEntryDialogOpen, setRipEntryDialogOpen] = useState(false)
  const [selectedLoadForRip, setSelectedLoadForRip] = useState<any>(null)
  const [ripEntryPacks, setRipEntryPacks] = useState<LumberPackWithDetails[]>([])
  const [isLoadingPacks, setIsLoadingPacks] = useState(false)
  
  // Grade Loads Dialog state
  const [gradeLoadsDialogOpen, setGradeLoadsDialogOpen] = useState(false)
  const [selectedGradeLoads, setSelectedGradeLoads] = useState<{
    species: string
    grade: string
    loads: InventoryLoadDetail[]
  } | null>(null)

  // Inventory Loads List state
  const [allInventoryLoads, setAllInventoryLoads] = useState<InventoryLoadDetail[]>([])
  const [inventoryLoadsSearch, setInventoryLoadsSearch] = useState('')
  const [inventoryLoadsSupplier, setInventoryLoadsSupplier] = useState('all')
  const [inventoryLoadsSpecies, setInventoryLoadsSpecies] = useState('all')
  const [inventoryLoadsGrade, setInventoryLoadsGrade] = useState('all')
  const [inventoryLoadsThickness, setInventoryLoadsThickness] = useState('all')
  const [inventoryLoadsSortColumn, setInventoryLoadsSortColumn] = useState<string>('load_id')
  const [inventoryLoadsSortDirection, setInventoryLoadsSortDirection] = useState<'asc' | 'desc'>('asc')

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/inventory')
    }
  }, [status, router])

  // Load species order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('inventory-species-order-by-thickness')
      if (saved) {
        setSpeciesOrderByThickness(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Error loading species order:', error)
    }
  }, [])

  async function fetchInventoryData() {
    try {
      const [inventoryRes, speciesRes, incomingRes] = await Promise.all([
        fetch('/api/lumber/inventory'),
        fetch('/api/lumber/species'),
        fetch('/api/lumber/loads/incoming')
      ])

      if (inventoryRes.ok) {
        const loadDetails: InventoryLoadDetail[] = await inventoryRes.json()
        
        // Store raw loads for the Inventory Loads list
        setAllInventoryLoads(loadDetails)
        
        // Group by species, grade, thickness
        const grouped: Record<string, InventoryGroup> = {}
        
        loadDetails.forEach(load => {
          const key = `${load.species}|${load.grade}|${load.thickness}`
          
          if (!grouped[key]) {
            grouped[key] = {
              species: load.species,
              grade: load.grade,
              thickness: load.thickness,
              total_actual_footage: 0,
              total_finished_footage: 0,
              current_inventory: 0,
              load_count: 0,
              loads: [],
              average_price: null,
              total_price_weighted: 0,
              total_footage_with_price: 0
            }
          }
          
          const actualFootage = Number(load.actual_footage) || 0
          const price = load.price ? Number(load.price) : null
          
          grouped[key].total_actual_footage += actualFootage
          grouped[key].total_finished_footage += Number(load.finished_footage) || 0
          grouped[key].current_inventory += Number(load.load_inventory) || 0
          grouped[key].load_count += 1
          grouped[key].loads.push(load)
          
          // Calculate weighted average price
          // Only include prices >= $0.20 per BF (exclude blank or unrealistic low prices)
          if (price !== null && price >= 0.20 && actualFootage > 0) {
            grouped[key].total_price_weighted += price * actualFootage
            grouped[key].total_footage_with_price += actualFootage
          }
        })
        
        // Calculate average prices for each group
        Object.values(grouped).forEach(group => {
          if (group.total_footage_with_price > 0) {
            group.average_price = group.total_price_weighted / group.total_footage_with_price
          }
        })
        
        setInventoryGroups(Object.values(grouped))
      }
      
      if (speciesRes.ok) {
        const speciesData = await speciesRes.json()
        const colorMap: Record<string, string> = {}
        speciesData.forEach((sp: any) => {
          colorMap[sp.name] = sp.color || '#6B7280'
        })
        setSpeciesColors(colorMap)
      }
      
      if (incomingRes.ok) {
        setIncomingLoads(await incomingRes.json())
      }
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchInventoryData()
    }
  }, [status])

  // Load species column order from localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem('inventory-species-column-order')
    if (savedOrder) {
      try {
        setSpeciesColumnOrder(JSON.parse(savedOrder))
      } catch (e) {
        console.error('Failed to parse saved species order:', e)
      }
    }
  }, [])

  // Process incoming loads and group by species/grade
  const incomingBySpeciesGrade = incomingLoads.reduce((acc: Record<string, Record<string, {
    footage: number
    load_count: number
    with_driver: number
  }>>, load: any) => {
    if (!load.items) return acc
    load.items.forEach((item: any) => {
      // Only count items that don't have actual footage yet (truly incoming)
      if (item.actual_footage) return
      
      const species = item.species
      const grade = item.grade
      
      if (!acc[species]) {
        acc[species] = {}
      }
      if (!acc[species][grade]) {
        acc[species][grade] = {
          footage: 0,
          load_count: 0,
          with_driver: 0
        }
      }
      
      acc[species][grade].footage += Number(item.estimated_footage) || 0
      acc[species][grade].load_count += 1
      if (load.driver_id) {
        acc[species][grade].with_driver += 1
      }
    })
    return acc
  }, {})

  // Group inventory by thickness, then species, then grade
  const thicknessSpeciesGradeGroups = inventoryGroups.reduce((acc: Record<string, Record<string, Record<string, InventoryGroup[]>>>, group) => {
    const thickness = group.thickness || 'Unknown'
    if (!acc[thickness]) {
      acc[thickness] = {}
    }
    if (!acc[thickness][group.species]) {
      acc[thickness][group.species] = {}
    }
    if (!acc[thickness][group.species][group.grade]) {
      acc[thickness][group.species][group.grade] = []
    }
    acc[thickness][group.species][group.grade].push(group)
    return acc
  }, {})

  // Order thicknesses: 4/4, 5/4, 6/4, 7/4, 8/4, then others
  const thicknessOrder = ['4/4', '5/4', '6/4', '7/4', '8/4']
  const orderedThicknesses = Object.keys(thicknessSpeciesGradeGroups).sort((a, b) => {
    const aIndex = thicknessOrder.indexOf(a)
    const bIndex = thicknessOrder.indexOf(b)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.localeCompare(b)
  })

  // Calculate thickness → species → grades structure
  const thicknessWithSpecies = orderedThicknesses.map(thickness => {
    const speciesGroups = thicknessSpeciesGradeGroups[thickness]
    
    const speciesList = Object.entries(speciesGroups).map(([species, gradeGroups]) => {
      const grades = Object.entries(gradeGroups).map(([grade, groups]) => {
      const total = groups.reduce((sum, g) => ({
        total_actual: sum.total_actual + (Number(g.total_actual_footage) || 0),
        total_finished: sum.total_finished + (Number(g.total_finished_footage) || 0),
        current_inventory: sum.current_inventory + (Number(g.current_inventory) || 0),
        load_count: sum.load_count + g.load_count,
        total_price_weighted: sum.total_price_weighted + (g.total_price_weighted || 0),
        total_footage_with_price: sum.total_footage_with_price + (g.total_footage_with_price || 0),
      }), {
        total_actual: 0,
        total_finished: 0,
        current_inventory: 0,
        load_count: 0,
        total_price_weighted: 0,
        total_footage_with_price: 0,
      })

      const average_price = total.total_footage_with_price > 0
        ? total.total_price_weighted / total.total_footage_with_price
        : null

      // Calculate pack count and loads with inventory
      let pack_count = 0
      let loads_with_inventory = 0
      groups.forEach(g => {
        g.loads.forEach(load => {
          if (load.load_inventory > 0) {
            loads_with_inventory += 1
            pack_count += Number(load.pack_count) || 0
          }
        })
      })

      // Calculate total value
      const total_value = average_price && total.current_inventory > 0
        ? total.current_inventory * average_price
        : 0

      // Get incoming data for this species/grade
      const incoming = incomingBySpeciesGrade[species]?.[grade] || {
        footage: 0,
        load_count: 0,
        with_driver: 0
      }

      return {
        grade,
        ...total,
        average_price,
        groups,
        pack_count,
        loads_with_inventory,
        total_value,
        incoming_footage: incoming.footage,
        incoming_load_count: incoming.load_count,
        incoming_with_driver: incoming.with_driver,
      }
    })

    const speciesTotal = grades.reduce((sum, g) => ({
      total_actual: sum.total_actual + g.total_actual,
      total_finished: sum.total_finished + g.total_finished,
      current_inventory: sum.current_inventory + g.current_inventory,
      load_count: sum.load_count + g.load_count,
      total_price_weighted: sum.total_price_weighted + g.total_price_weighted,
      total_footage_with_price: sum.total_footage_with_price + g.total_footage_with_price,
    }), {
      total_actual: 0,
      total_finished: 0,
      current_inventory: 0,
      load_count: 0,
      total_price_weighted: 0,
      total_footage_with_price: 0,
    })

    const speciesAveragePrice = speciesTotal.total_footage_with_price > 0
      ? speciesTotal.total_price_weighted / speciesTotal.total_footage_with_price
      : null

    // Calculate species totals for incoming data
    const speciesIncoming = grades.reduce((sum, g) => ({
      load_count: sum.load_count + g.incoming_load_count,
      footage: sum.footage + g.incoming_footage,
    }), { load_count: 0, footage: 0 })

    // Calculate species totals for packs and loads with inventory
    const speciesInventoryDetails = grades.reduce((sum, g) => ({
      loads_with_inventory: sum.loads_with_inventory + g.loads_with_inventory,
      pack_count: sum.pack_count + g.pack_count,
      total_value: sum.total_value + g.total_value,
    }), { loads_with_inventory: 0, pack_count: 0, total_value: 0 })

      return {
        species,
        grades,
        ...speciesTotal,
        average_price: speciesAveragePrice,
        incoming_load_count: speciesIncoming.load_count,
        incoming_footage: speciesIncoming.footage,
        loads_with_inventory: speciesInventoryDetails.loads_with_inventory,
        pack_count: speciesInventoryDetails.pack_count,
        total_value: speciesInventoryDetails.total_value,
      }
    })

    // Calculate thickness totals
    const thicknessTotal = speciesList.reduce((sum, s) => ({
      total_actual: sum.total_actual + s.total_actual,
      total_finished: sum.total_finished + s.total_finished,
      current_inventory: sum.current_inventory + s.current_inventory,
      load_count: sum.load_count + s.load_count,
      total_price_weighted: sum.total_price_weighted + s.total_price_weighted,
      total_footage_with_price: sum.total_footage_with_price + s.total_footage_with_price,
      incoming_load_count: sum.incoming_load_count + s.incoming_load_count,
      incoming_footage: sum.incoming_footage + s.incoming_footage,
      loads_with_inventory: sum.loads_with_inventory + s.loads_with_inventory,
      pack_count: sum.pack_count + s.pack_count,
      total_value: sum.total_value + s.total_value,
    }), {
      total_actual: 0,
      total_finished: 0,
      current_inventory: 0,
      load_count: 0,
      total_price_weighted: 0,
      total_footage_with_price: 0,
      incoming_load_count: 0,
      incoming_footage: 0,
      loads_with_inventory: 0,
      pack_count: 0,
      total_value: 0,
    })

    const thicknessAveragePrice = thicknessTotal.total_footage_with_price > 0
      ? thicknessTotal.total_price_weighted / thicknessTotal.total_footage_with_price
      : null

    // Apply saved order for this thickness, or default to alphabetical
    const savedOrder = speciesOrderByThickness[thickness] || []
    const sortedSpecies = [...speciesList].sort((a, b) => {
      const aIndex = savedOrder.indexOf(a.species)
      const bIndex = savedOrder.indexOf(b.species)
      
      // If both are in saved order, use saved order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }
      // If only one is in saved order, it comes first
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      // If neither is in saved order, sort alphabetically
      return (a.species || '').localeCompare(b.species || '')
    })

    return {
      thickness,
      species: sortedSpecies,
      ...thicknessTotal,
      average_price: thicknessAveragePrice,
    }
  })

  // Get unique values for inventory loads filters
  const inventoryLoadsFilterOptions = useMemo(() => {
    const suppliers = Array.from(new Set(allInventoryLoads.map(l => l.species))).sort() // Note: We don't have supplier in this data
    const species = Array.from(new Set(allInventoryLoads.map(l => l.species))).sort()
    const grades = Array.from(new Set(allInventoryLoads.map(l => l.grade))).sort()
    const thicknesses = Array.from(new Set(allInventoryLoads.map(l => l.thickness))).sort()
    return { species, grades, thicknesses }
  }, [allInventoryLoads])

  // Filter and sort inventory loads
  const filteredInventoryLoads = useMemo(() => {
    let filtered = [...allInventoryLoads]

    // Apply search filter
    if (inventoryLoadsSearch) {
      const search = inventoryLoadsSearch.toLowerCase()
      filtered = filtered.filter(load =>
        load.load_id?.toLowerCase().includes(search) ||
        load.species?.toLowerCase().includes(search) ||
        load.grade?.toLowerCase().includes(search) ||
        load.thickness?.toLowerCase().includes(search)
      )
    }

    // Apply species filter
    if (inventoryLoadsSpecies !== 'all') {
      filtered = filtered.filter(load => load.species === inventoryLoadsSpecies)
    }

    // Apply grade filter
    if (inventoryLoadsGrade !== 'all') {
      filtered = filtered.filter(load => load.grade === inventoryLoadsGrade)
    }

    // Apply thickness filter
    if (inventoryLoadsThickness !== 'all') {
      filtered = filtered.filter(load => load.thickness === inventoryLoadsThickness)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (inventoryLoadsSortColumn) {
        case 'load_id':
          aVal = parseInt(a.load_id) || 0
          bVal = parseInt(b.load_id) || 0
          break
        case 'species':
          aVal = a.species || ''
          bVal = b.species || ''
          break
        case 'grade':
          aVal = a.grade || ''
          bVal = b.grade || ''
          break
        case 'thickness':
          aVal = a.thickness || ''
          bVal = b.thickness || ''
          break
        case 'actual_footage':
          aVal = Number(a.actual_footage) || 0
          bVal = Number(b.actual_footage) || 0
          break
        case 'load_inventory':
          aVal = Number(a.load_inventory) || 0
          bVal = Number(b.load_inventory) || 0
          break
        case 'price':
          aVal = Number(a.price) || 0
          bVal = Number(b.price) || 0
          break
        default:
          aVal = a.load_id
          bVal = b.load_id
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return inventoryLoadsSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return inventoryLoadsSortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })

    return filtered
  }, [allInventoryLoads, inventoryLoadsSearch, inventoryLoadsSpecies, inventoryLoadsGrade, inventoryLoadsThickness, inventoryLoadsSortColumn, inventoryLoadsSortDirection])

  // Inventory loads helper functions
  function handleInventoryLoadsSort(column: string) {
    if (inventoryLoadsSortColumn === column) {
      setInventoryLoadsSortDirection(inventoryLoadsSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setInventoryLoadsSortColumn(column)
      setInventoryLoadsSortDirection('asc')
    }
  }

  function getInventoryLoadsSortIcon(column: string) {
    if (inventoryLoadsSortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    return inventoryLoadsSortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  function clearInventoryLoadsFilters() {
    setInventoryLoadsSearch('')
    setInventoryLoadsSpecies('all')
    setInventoryLoadsGrade('all')
    setInventoryLoadsThickness('all')
  }

  const hasInventoryLoadsFilters = inventoryLoadsSearch || inventoryLoadsSpecies !== 'all' || inventoryLoadsGrade !== 'all' || inventoryLoadsThickness !== 'all'

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  function toggleRow(key: string) {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedRows(newExpanded)
  }

  function toggleThickness(thickness: string) {
    const newExpanded = new Set(expandedThicknesses)
    if (newExpanded.has(thickness)) {
      newExpanded.delete(thickness)
    } else {
      newExpanded.add(thickness)
    }
    setExpandedThicknesses(newExpanded)
  }

  function toggleSpecies(thickness: string, species: string) {
    const key = `${thickness}-${species}`
    const newExpanded = new Set(expandedSpecies)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedSpecies(newExpanded)
  }

  // Handle drag end for species rows within a thickness
  function handleSpeciesDragEnd(thickness: string, currentSpeciesList: any[], event: DragEndEvent) {
    const { active, over } = event
    
    if (!over || active.id === over.id) return

    const currentOrder = speciesOrderByThickness[thickness] || currentSpeciesList.map(s => s.species)

    const oldIndex = currentOrder.indexOf(active.id as string)
    const newIndex = currentOrder.indexOf(over.id as string)

    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(currentOrder, oldIndex, newIndex)
    const updatedOrder = { ...speciesOrderByThickness, [thickness]: newOrder }
    setSpeciesOrderByThickness(updatedOrder)
    localStorage.setItem('inventory-species-order-by-thickness', JSON.stringify(updatedOrder))
  }

  // Print/Export PDF function
  function handlePrint() {
    // Expand all thicknesses and species for printing
    const allThicknesses = thicknessWithSpecies.map(t => t.thickness)
    const allSpeciesKeys: string[] = []
    
    thicknessWithSpecies.forEach(thicknessData => {
      thicknessData.species.forEach(speciesData => {
        allSpeciesKeys.push(`${thicknessData.thickness}-${speciesData.species}`)
      })
    })
    
    // Temporarily expand everything
    const prevExpandedThicknesses = new Set(expandedThicknesses)
    const prevExpandedSpecies = new Set(expandedSpecies)
    
    setExpandedThicknesses(new Set(allThicknesses))
    setExpandedSpecies(new Set(allSpeciesKeys))
    
    // Wait for state update, then print
    setTimeout(() => {
      window.print()
      
      // Restore previous expansion state after print dialog closes
      const restoreState = () => {
        setExpandedThicknesses(prevExpandedThicknesses)
        setExpandedSpecies(prevExpandedSpecies)
      }
      
      // Try to detect when print dialog closes (this is approximate)
      setTimeout(restoreState, 500)
      
      // Also restore on window focus (user might cancel print)
      const handleFocus = () => {
        restoreState()
        window.removeEventListener('focus', handleFocus)
      }
      window.addEventListener('focus', handleFocus)
    }, 200)
  }

  // Get formatted date for filename
  function getPrintDateString() {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const year = now.getFullYear()
    return `${month}/${day}/${year}`
  }

  // Get formatted date/time for print header
  function getPrintDateTimeString() {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const year = now.getFullYear()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`
  }

  async function handleViewRipEntry(load: InventoryLoadDetail) {
    setSelectedLoadForRip(load)
    setRipEntryDialogOpen(true)
    setIsLoadingPacks(true)
    
    try {
      // First fetch the load details to get the database ID
      const loadRes = await fetch(`/api/lumber/loads/by-load-id/${load.load_id}`)
      if (loadRes.ok) {
        const loadData = await loadRes.json()
        if (loadData && loadData.id) {
          // Fetch packs for this load
          const packsRes = await fetch(`/api/lumber/packs/by-load/${loadData.id}`)
          if (packsRes.ok) {
            const packsData = await packsRes.json()
            setRipEntryPacks(packsData)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching rip entry data:', error)
    } finally {
      setIsLoadingPacks(false)
    }
  }

  // Calculate species totals for summary cards
  const speciesTotals = inventoryGroups.reduce((acc: Record<string, {
    species: string
    total_actual: number
    total_finished: number
    current_inventory: number
    load_count: number
    grade_count: number
    total_price_weighted: number
    total_footage_with_price: number
    average_price: number | null
  }>, group) => {
    if (!acc[group.species]) {
      acc[group.species] = {
        species: group.species,
        total_actual: 0,
        total_finished: 0,
        current_inventory: 0,
        load_count: 0,
        grade_count: 0,
        total_price_weighted: 0,
        total_footage_with_price: 0,
        average_price: null
      }
    }
    acc[group.species].total_actual += Number(group.total_actual_footage) || 0
    acc[group.species].total_finished += Number(group.total_finished_footage) || 0
    acc[group.species].current_inventory += Number(group.current_inventory) || 0
    acc[group.species].load_count += group.load_count
    acc[group.species].grade_count += 1
    
    // Calculate weighted average price for species
    if (group.total_footage_with_price > 0) {
      acc[group.species].total_price_weighted += group.total_price_weighted || 0
      acc[group.species].total_footage_with_price += group.total_footage_with_price || 0
    }
    return acc
  }, {})

  // Calculate average prices for species totals
  Object.values(speciesTotals).forEach(species => {
    if (species.total_footage_with_price > 0) {
      species.average_price = species.total_price_weighted / species.total_footage_with_price
    }
  })

  const speciesTotalsArray = Object.values(speciesTotals).sort((a, b) => 
    b.current_inventory - a.current_inventory
  )

  return (
    <>
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #000;
          }
          .print-header h1 {
            margin: 0;
            font-size: 24pt;
            font-weight: bold;
          }
          .print-header .print-meta {
            margin-top: 8px;
            font-size: 10pt;
            color: #333;
          }
          .print-container table {
            width: 100%;
            max-width: 100% !important;
          }
          .print-container th,
          .print-container td {
            padding: 4px 6px;
            font-size: 10pt;
          }
          .print-container .bg-blue-50\\/20,
          .print-container .bg-blue-50\\/40 {
            background-color: #f0f9ff !important;
          }
          .print-container .bg-blue-50\\/60 {
            background-color: #dbeafe !important;
          }
          @page {
            size: landscape;
            margin: 0.5in;
          }
        }
        .print-header {
          display: none;
        }
      `}</style>
      <div className="space-y-4 print-container">
        {/* Print Header - only visible when printing */}
        <div className="print-header">
          <h1>RNR Lumber Inventory</h1>
          <div className="print-meta">
            <div>Printed: {getPrintDateTimeString()}</div>
            <div>Filename: RNR Lumber inventory {getPrintDateString()}.pdf</div>
          </div>
        </div>

        {/* Screen Header - hidden when printing */}
        <div className="no-print">
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600 mt-1">Current inventory levels and tracking</p>
        </div>

      {/* Detailed Inventory Table - Species → Grades */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 bg-gray-800 text-white flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold">Detailed Inventory Breakdown</h2>
            <p className="text-[10px] text-gray-300 mt-0.5">
              Click thickness to expand species. Click species to expand grades. Click grade to view loads and tallies.
            </p>
          </div>
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="bg-white text-gray-800 hover:bg-gray-100 no-print"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print/Export PDF
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1 text-left text-sm font-semibold text-gray-700 uppercase w-6"></th>
                <th className="px-1 py-1 text-left text-sm font-semibold text-gray-700 uppercase w-14">Thick</th>
                <th className="px-1 py-1 text-left text-sm font-semibold text-gray-700 uppercase w-28">Species</th>
                <th className="px-1 py-1 text-left text-sm font-semibold text-gray-700 uppercase w-20">Grade</th>
                <th className="px-1 py-1 text-right text-sm font-semibold text-gray-700 uppercase w-20">Inv Loads</th>
                <th className="px-1 py-1 text-right text-sm font-semibold text-gray-700 uppercase w-20">Inv Packs</th>
                <th className="px-1 py-1 text-right text-sm font-semibold text-gray-700 uppercase w-24">Avg Price</th>
                <th className="px-1 py-1 text-right text-sm font-semibold text-gray-700 uppercase w-24">Inv BF</th>
                <th className="px-1 py-1 text-right text-sm font-semibold text-gray-700 uppercase w-28">Total Value</th>
                <th className="px-1 py-1 text-right text-sm font-semibold text-gray-700 uppercase w-20">Inc Loads</th>
                <th className="px-1 py-1 text-right text-sm font-semibold text-gray-700 uppercase w-24">Inc BF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {thicknessWithSpecies.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-1 py-4 text-center text-sm text-gray-500">
                    No inventory data available
                  </td>
                </tr>
              ) : (
                thicknessWithSpecies.map((thicknessData, thicknessIdx) => {
                  const isThicknessExpanded = expandedThicknesses.has(thicknessData.thickness)
                  
                  return (
                    <>
                      {/* Thickness Row */}
                      <tr 
                        key={`thickness-${thicknessData.thickness}`}
                        className={`
                          hover:bg-gray-50 transition-colors cursor-pointer
                          ${thicknessIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        `}
                        onClick={() => toggleThickness(thicknessData.thickness)}
                      >
                        <td className="px-1 py-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleThickness(thicknessData.thickness); }}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {isThicknessExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900">{thicknessData.thickness}</span>
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-500 italic">
                          All Species
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-500 italic">
                          All Grades
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-gray-700">
                          {thicknessData.loads_with_inventory}
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-gray-700">
                          {thicknessData.pack_count}
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right">
                          <span className="font-medium text-green-600">
                            {thicknessData.average_price ? `$${thicknessData.average_price.toFixed(3)}` : '-'}
                          </span>
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
                          {thicknessData.current_inventory.toLocaleString()}
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right">
                          <span className="font-semibold text-purple-600">
                            {thicknessData.total_value > 0 ? `$${thicknessData.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                          </span>
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-blue-700">
                          {thicknessData.incoming_load_count}
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-blue-700">
                          {thicknessData.incoming_footage.toLocaleString()}
                        </td>
                      </tr>
                      
                      {/* Species Rows (when thickness expanded) */}
                      {isThicknessExpanded && (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(e) => handleSpeciesDragEnd(thicknessData.thickness, thicknessData.species, e)}
                        >
                          <SortableContext
                            items={thicknessData.species.map(s => s.species)}
                            strategy={verticalListSortingStrategy}
                          >
                            {thicknessData.species.map((speciesData, speciesIdx) => {
                              const speciesKey = `${thicknessData.thickness}-${speciesData.species}`
                              const isSpeciesExpanded = expandedSpecies.has(speciesKey)
                              
                              return (
                                <SortableSpeciesRow
                                  key={`species-${thicknessData.thickness}-${speciesData.species}`}
                                  id={speciesData.species}
                                  speciesData={speciesData}
                                  thickness={thicknessData.thickness}
                                  speciesColors={speciesColors}
                                  isExpanded={isSpeciesExpanded}
                                  onToggle={() => toggleSpecies(thicknessData.thickness, speciesData.species)}
                                  onGradeClick={(grade, loadsWithInventory) => {
                                    setSelectedGradeLoads({
                                      species: speciesData.species,
                                      grade: grade.grade,
                                      loads: loadsWithInventory
                                    })
                                    setGradeLoadsDialogOpen(true)
                                  }}
                                >
                                  {/* Grade Rows (when species expanded) */}
                                  {isSpeciesExpanded && speciesData.grades.map((grade) => {
                                    // Get all loads with inventory for this grade
                                    const loadsWithInventory = grade.groups.flatMap(g => 
                                      g.loads.filter(load => load.load_inventory > 0)
                                    )
                                    
                                    return (
                                      <tr
                                        key={`grade-${thicknessData.thickness}-${speciesData.species}-${grade.grade}`}
                                        className="bg-blue-50/40 hover:bg-blue-50/60 transition-colors cursor-pointer"
                                        onClick={() => {
                                          setSelectedGradeLoads({
                                            species: speciesData.species,
                                            grade: grade.grade,
                                            loads: loadsWithInventory
                                          })
                                          setGradeLoadsDialogOpen(true)
                                        }}
                                      >
                                        <td className="px-1 py-1"></td>
                                        <td className="px-1 py-1 whitespace-nowrap">
                                          <div className="flex items-center gap-1 pl-4">
                                            <span className="text-gray-400 text-sm">└</span>
                                          </div>
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap">
                                          <div className="flex items-center gap-1 pl-2">
                                            <span className="text-gray-400 text-sm">└</span>
                                            <span 
                                              className="w-2.5 h-2.5 rounded flex-shrink-0" 
                                              style={{ backgroundColor: speciesColors[speciesData.species] || '#6B7280' }}
                                            />
                                          </div>
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {grade.grade}
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-gray-700">
                                          {grade.loads_with_inventory}
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-gray-700">
                                          {grade.pack_count}
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right">
                                          <span className="font-medium text-green-600">
                                            {grade.average_price ? `$${grade.average_price.toFixed(3)}` : '-'}
                                          </span>
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
                                          {grade.current_inventory.toLocaleString()}
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right">
                                          <span className="font-semibold text-purple-600">
                                            {grade.total_value > 0 ? `$${grade.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                          </span>
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-blue-700">
                                          {grade.incoming_load_count}
                                        </td>
                                        <td className="px-1 py-1 whitespace-nowrap text-sm text-right text-blue-700">
                                          {grade.incoming_footage.toLocaleString()}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </SortableSpeciesRow>
                              )
                            })}
                          </SortableContext>
                        </DndContext>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Loads Section */}
      <div className="bg-white rounded-lg shadow print:hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Inventory Loads</h2>
          <p className="text-sm text-gray-500">All loads currently contributing to inventory</p>
        </div>
        
        {/* Filters */}
        <div className="p-4 border-b bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
            {hasInventoryLoadsFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearInventoryLoadsFilters}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search loads..."
                value={inventoryLoadsSearch}
                onChange={(e) => setInventoryLoadsSearch(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>

            {/* Species Filter */}
            <Select value={inventoryLoadsSpecies} onValueChange={setInventoryLoadsSpecies}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All Species" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Species</SelectItem>
                {inventoryLoadsFilterOptions.species.map(sp => (
                  <SelectItem key={sp} value={sp}>{sp}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Grade Filter */}
            <Select value={inventoryLoadsGrade} onValueChange={setInventoryLoadsGrade}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {inventoryLoadsFilterOptions.grades.map(grade => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Thickness Filter */}
            <Select value={inventoryLoadsThickness} onValueChange={setInventoryLoadsThickness}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All Thicknesses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Thicknesses</SelectItem>
                {inventoryLoadsFilterOptions.thicknesses.map(thickness => (
                  <SelectItem key={thickness} value={thickness}>{thickness}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Display */}
          {hasInventoryLoadsFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {inventoryLoadsSearch && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  Search: {inventoryLoadsSearch}
                  <button onClick={() => setInventoryLoadsSearch('')} className="hover:text-blue-900">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {inventoryLoadsSpecies !== 'all' && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                  Species: {inventoryLoadsSpecies}
                  <button onClick={() => setInventoryLoadsSpecies('all')} className="hover:text-purple-900">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {inventoryLoadsGrade !== 'all' && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                  Grade: {inventoryLoadsGrade}
                  <button onClick={() => setInventoryLoadsGrade('all')} className="hover:text-orange-900">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {inventoryLoadsThickness !== 'all' && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded">
                  Thickness: {inventoryLoadsThickness}
                  <button onClick={() => setInventoryLoadsThickness('all')} className="hover:text-cyan-900">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="text-xs text-gray-500 self-center ml-auto">
                Showing {filteredInventoryLoads.length} of {allInventoryLoads.length} loads
              </div>
            </div>
          )}
        </div>
        
        {/* Loads Table */}
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-800 text-white sticky top-0">
              <tr>
                <th 
                  className="px-3 py-2 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleInventoryLoadsSort('load_id')}
                >
                  <div className="flex items-center">
                    Load ID {getInventoryLoadsSortIcon('load_id')}
                  </div>
                </th>
                <th 
                  className="px-3 py-2 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleInventoryLoadsSort('species')}
                >
                  <div className="flex items-center">
                    Species {getInventoryLoadsSortIcon('species')}
                  </div>
                </th>
                <th 
                  className="px-3 py-2 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleInventoryLoadsSort('grade')}
                >
                  <div className="flex items-center">
                    Grade {getInventoryLoadsSortIcon('grade')}
                  </div>
                </th>
                <th 
                  className="px-3 py-2 text-left text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleInventoryLoadsSort('thickness')}
                >
                  <div className="flex items-center">
                    Thickness {getInventoryLoadsSortIcon('thickness')}
                  </div>
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleInventoryLoadsSort('actual_footage')}
                >
                  <div className="flex items-center justify-end">
                    Total BF {getInventoryLoadsSortIcon('actual_footage')}
                  </div>
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleInventoryLoadsSort('load_inventory')}
                >
                  <div className="flex items-center justify-end">
                    Inventory BF {getInventoryLoadsSortIcon('load_inventory')}
                  </div>
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase">
                  Packs
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium uppercase cursor-pointer hover:bg-gray-700"
                  onClick={() => handleInventoryLoadsSort('price')}
                >
                  <div className="flex items-center justify-end">
                    Price {getInventoryLoadsSortIcon('price')}
                  </div>
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventoryLoads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    No loads found
                  </td>
                </tr>
              ) : (
                filteredInventoryLoads.map((load, idx) => (
                  <tr 
                    key={`${load.load_id}-${idx}`}
                    className={`hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                      {load.load_id}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: speciesColors[load.species] || '#6B7280' }}
                        />
                        {load.species}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">{load.grade}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">{load.thickness}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                      {Number(load.actual_footage || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                      {Number(load.load_inventory || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-600">
                      {load.finished_pack_count}/{load.pack_count}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-green-600">
                      {load.price ? `$${Number(load.price).toFixed(3)}` : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => handleViewRipEntry(load)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        View Tallies
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredInventoryLoads.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-sm font-semibold">
                    Total ({filteredInventoryLoads.length} loads)
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-semibold">
                    {filteredInventoryLoads.reduce((sum, l) => sum + (Number(l.actual_footage) || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-semibold text-blue-600">
                    {filteredInventoryLoads.reduce((sum, l) => sum + (Number(l.load_inventory) || 0), 0).toLocaleString()}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Rip Entry View Dialog */}
      <Dialog open={ripEntryDialogOpen} onOpenChange={setRipEntryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Rip Entry View - Load {selectedLoadForRip?.load_id}
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingPacks ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Load Info */}
              <div className="bg-gray-50 p-3 rounded">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Load ID:</span>
                    <span className="ml-2 font-medium">{selectedLoadForRip?.load_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Species:</span>
                    <span className="ml-2 font-medium">{selectedLoadForRip?.species}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Grade:</span>
                    <span className="ml-2 font-medium">{selectedLoadForRip?.grade}</span>
                  </div>
                </div>
              </div>

              {/* Pack Tables */}
              {ripEntryPacks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No pack data available for this load
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* Pack Information */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Pack Information</h3>
                    <div className="border rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Pack ID</th>
                            <th className="px-2 py-1.5 text-left">Length</th>
                            <th className="px-2 py-1.5 text-right">Tally BF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ripEntryPacks.map((pack, idx) => (
                            <tr key={pack.id} className={`${pack.is_finished ? 'bg-green-50' : ''} ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                              <td className="px-2 py-1.5 border-t">{pack.pack_id || '-'}</td>
                              <td className="px-2 py-1.5 border-t">{pack.length ? `${pack.length} ft` : '-'}</td>
                              <td className="px-2 py-1.5 border-t text-right">{pack.tally_board_feet?.toLocaleString() || '-'}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-200 font-semibold">
                            <td className="px-2 py-1.5" colSpan={2}>{ripEntryPacks.length} Packs</td>
                            <td className="px-2 py-1.5 text-right">
                              {ripEntryPacks.reduce((sum, p) => sum + (Number(p.tally_board_feet) || 0), 0).toLocaleString()} BF
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Rip Yield & Comments */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Rip Yield & Comments</h3>
                    <div className="border rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1.5 text-right">Actual BF</th>
                            <th className="px-2 py-1.5 text-right">Yield</th>
                            <th className="px-2 py-1.5 text-left">Comments</th>
                            <th className="px-2 py-1.5 text-center">Done</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ripEntryPacks.map((pack, idx) => (
                            <tr key={pack.id} className={`${pack.is_finished ? 'bg-green-50' : ''} ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                              <td className="px-2 py-1.5 border-t text-right">{pack.actual_board_feet?.toLocaleString() || '-'}</td>
                              <td className="px-2 py-1.5 border-t text-right">{pack.rip_yield || '-'}</td>
                              <td className="px-2 py-1.5 border-t truncate max-w-[100px]">{pack.rip_comments || '-'}</td>
                              <td className="px-2 py-1.5 border-t text-center">
                                {pack.is_finished ? (
                                  <span className="text-green-600">✓</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-200 font-semibold">
                            <td className="px-2 py-1.5 text-right">
                              {ripEntryPacks.filter(p => p.is_finished).reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0).toLocaleString()} BF
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              {ripEntryPacks.filter(p => p.rip_yield).length > 0
                                ? (ripEntryPacks.filter(p => p.rip_yield).reduce((sum, p) => sum + (p.rip_yield || 0), 0) / ripEntryPacks.filter(p => p.rip_yield).length).toFixed(1)
                                : '-'} Avg
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {ripEntryPacks.length > 0 && (
                <div className="bg-blue-50 p-3 rounded text-sm">
                  <div className="flex justify-between">
                    <span>
                      <strong>{ripEntryPacks.filter(p => p.is_finished).length}</strong> of <strong>{ripEntryPacks.length}</strong> packs finished
                    </span>
                    <span>
                      <strong>{ripEntryPacks.filter(p => p.is_finished).reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0).toLocaleString()}</strong> BF ripped of{' '}
                      <strong>{ripEntryPacks.reduce((sum, p) => sum + (Number(p.tally_board_feet) || 0), 0).toLocaleString()}</strong> BF total
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grade Loads Dialog */}
      <Dialog open={gradeLoadsDialogOpen} onOpenChange={setGradeLoadsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Loads in Inventory - {selectedGradeLoads?.species} {selectedGradeLoads?.grade}
            </DialogTitle>
          </DialogHeader>
          
          {selectedGradeLoads && selectedGradeLoads.loads.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No loads with inventory for this grade
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 mb-3">
                {selectedGradeLoads?.loads.length} load{selectedGradeLoads?.loads.length !== 1 ? 's' : ''} with inventory
              </div>
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Load ID</th>
                      <th className="px-3 py-2 text-left">Thickness</th>
                      <th className="px-3 py-2 text-right">Inventory BF</th>
                      <th className="px-3 py-2 text-right">Total BF</th>
                      <th className="px-3 py-2 text-right">Finished BF</th>
                      <th className="px-3 py-2 text-center">Packs</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGradeLoads?.loads.map((load, idx) => (
                      <tr 
                        key={load.load_id} 
                        className={`hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-3 py-2 font-medium">{load.load_id}</td>
                        <td className="px-3 py-2 text-gray-600">{load.thickness}</td>
                        <td className="px-3 py-2 text-right font-semibold text-blue-600">
                          {Number(load.load_inventory || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {Number(load.actual_footage || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {Number(load.finished_footage || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {load.finished_pack_count}/{load.pack_count}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">
                          {load.price ? `$${Number(load.price).toFixed(3)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => {
                              handleViewRipEntry(load)
                              setGradeLoadsDialogOpen(false)
                            }}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            View Tallies
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
