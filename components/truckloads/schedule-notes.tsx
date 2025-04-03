"use client"

import { useState, useMemo, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { format, isSameDay, addDays, startOfDay, startOfWeek, endOfWeek, isWithinInterval } from "date-fns"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// Add preset colors
const PRESET_COLORS = [
  "#FFD700", // Gold
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Sage
  "#FFEEAD", // Cream
  "#D4A5A5", // Mauve
  "#9B59B6", // Purple
  "#3498DB", // Royal Blue
  "#2ECC71"  // Green
] as const

interface Note {
  id: number
  content: string
  start_date: string
  note_date: string
  color: string
  created_by: number
  created_at: string
  updated_at: string
}

interface NoteFormData {
  content: string
  startDate: Date | null
  color: string
}

interface ScheduleNotesProps {
  dates: Date[]
  startDate: Date
  endDate: Date
}

interface WeekNotes {
  [key: string]: Note[]
}

interface DuplicateDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (weeks: number) => void
}

function DuplicateDialog({ isOpen, onClose, onConfirm }: DuplicateDialogProps) {
  const [weeks, setWeeks] = useState(1)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate Note</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="weeks">Number of weeks to duplicate</Label>
          <Input
            id="weeks"
            type="number"
            min={1}
            max={52}
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value) || 1)}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(weeks)}>Duplicate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ScheduleNotes({ dates, startDate, endDate }: ScheduleNotesProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [formData, setFormData] = useState<NoteFormData>({
    content: '',
    startDate: null,
    color: PRESET_COLORS[0]
  })
  const queryClient = useQueryClient()
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
  const [noteToDuplicate, setNoteToDuplicate] = useState<Note | null>(null)

  // Use React Query for data fetching with proper configuration
  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ['schedule-notes', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      })
      
      const response = await fetch(`/api/schedule-notes?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch notes')
      }
      
      const data = await response.json()
      return data.notes || []
    },
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0 // Consider data stale immediately
  })

  // Log for debugging
  useEffect(() => {
    console.log('Fetched notes:', notes)
    console.log('Date range:', { startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') })
  }, [notes, startDate, endDate])

  // Filter notes to only show those within the visible date range
  const visibleNotes = useMemo(() => {
    if (!Array.isArray(notes)) return []
    
    return notes.filter((note: Note) => {
      const noteDate = startOfDay(new Date(note.start_date || note.note_date))
      const visibleStart = startOfDay(startDate)
      const visibleEnd = startOfDay(endDate)
      
      const isVisible = isWithinInterval(noteDate, { start: visibleStart, end: visibleEnd })
      console.log('Note visibility check:', { 
        noteDate: format(noteDate, 'yyyy-MM-dd'), 
        visibleStart: format(visibleStart, 'yyyy-MM-dd'), 
        visibleEnd: format(visibleEnd, 'yyyy-MM-dd'), 
        isVisible,
        noteContent: note.content 
      })
      
      return isVisible
    })
  }, [notes, startDate, endDate])

  // Group notes by week
  const notesByWeek = useMemo(() => {
    const weeks: WeekNotes = {}
    visibleNotes.forEach((note: Note) => {
      const noteDate = new Date(note.start_date || note.note_date)
      const weekStart = startOfWeek(noteDate, { weekStartsOn: 0 })
      const weekKey = format(weekStart, 'yyyy-MM-dd')
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = []
      }
      weeks[weekKey].push(note)
      
      // Sort notes within the week
      weeks[weekKey].sort((a: Note, b: Note) => {
        const aDate = new Date(a.start_date || a.note_date)
        const bDate = new Date(b.start_date || b.note_date)
        return aDate.getTime() - bDate.getTime()
      })
    })
    return weeks
  }, [visibleNotes])

  const createNoteMutation = useMutation({
    mutationFn: async (note: Omit<Note, "id" | "created_at" | "updated_at" | "note_date">) => {
      const response = await fetch("/api/schedule-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to create note")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-notes"] })
      setIsDialogOpen(false)
      resetForm()
    }
  })

  const updateNoteMutation = useMutation({
    mutationFn: async (note: Note) => {
      const response = await fetch("/api/schedule-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note)
      })
      if (!response.ok) throw new Error("Failed to update note")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-notes"] })
      setIsDialogOpen(false)
      setEditingNote(null)
      resetForm()
    }
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/schedule-notes?id=${id}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete note")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-notes"] })
    }
  })

  const copyNoteMutation = useMutation({
    mutationFn: async ({ note, weeks }: { note: Note; weeks: number }) => {
      const startDate = new Date(note.start_date || note.note_date)
      
      const promises = Array.from({ length: weeks }, (_, i) => {
        const newNote = {
          content: note.content,
          color: note.color,
          start_date: format(addDays(startDate, 7 * (i + 1)), "yyyy-MM-dd"),
          created_by: note.created_by
        }
        
        return fetch("/api/schedule-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newNote)
        }).then(response => {
          if (!response.ok) throw new Error("Failed to copy note")
          return response.json()
        })
      })
      
      return Promise.all(promises)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-notes"] })
      setNoteToDuplicate(null)
      setIsDuplicateDialogOpen(false)
    }
  })

  function resetForm() {
    setFormData({
      content: "",
      startDate: null,
      color: PRESET_COLORS[0]
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.startDate) return

    const noteData = {
      content: formData.content,
      color: formData.color,
      start_date: format(formData.startDate, "yyyy-MM-dd"),
      created_by: 0 // This will be overridden by the server
    }

    if (editingNote) {
      updateNoteMutation.mutate({
        ...editingNote,
        ...noteData
      })
    } else {
      createNoteMutation.mutate(noteData)
    }
  }

  const handleEdit = (note: Note) => {
    setEditingNote(note)
    setFormData({
      content: note.content,
      startDate: new Date(note.start_date || note.note_date),
      color: note.color
    })
    setIsDialogOpen(true)
  }

  const handleDuplicate = (note: Note) => {
    setNoteToDuplicate(note)
    setIsDuplicateDialogOpen(true)
  }

  const handleDuplicateConfirm = (weeks: number) => {
    if (noteToDuplicate) {
      copyNoteMutation.mutate({ note: noteToDuplicate, weeks })
    }
  }

  return (
    <>
      <div className="sticky left-0 bg-gray-100 z-20 p-2 font-semibold border-b-2 border-r-2 border-gray-300 shadow-sm flex items-center justify-between">
        <span>Notes</span>
        <Button variant="ghost" size="sm" onClick={() => {
          setEditingNote(null)
          setFormData({ content: '', startDate: new Date(), color: PRESET_COLORS[0] })
          setIsDialogOpen(true)
        }}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Add the dialog for creating/editing notes */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Add Note'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="content">Note Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.startDate ? format(formData.startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value ? new Date(e.target.value) : null }))}
                required
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full ${formData.color === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingNote ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative" style={{ 
        gridColumn: `2 / span ${dates.length}`,
        height: '400px'
      }}>
        {dates.map((date, index) => {
          // Only render cell if it's the first day of the week (Sunday)
          if (date.getDay() !== 0) return null

          // Get notes that fall within this week
          const weekStart = startOfDay(date)
          const weekEnd = startOfDay(addDays(date, 6))
          const notesForWeek = visibleNotes.filter((note: Note) => {
            const noteDate = new Date(note.start_date || note.note_date)
            return noteDate >= weekStart && noteDate <= weekEnd
          }).sort((a: Note, b: Note) => {
            const aDate = new Date(a.start_date || a.note_date)
            const bDate = new Date(b.start_date || b.note_date)
            return aDate.getTime() - bDate.getTime()
          })

          return (
            <div
              key={date.toISOString()}
              className={`absolute h-full ${
                date.getDay() === 0 ? 'border-l-[2px] border-l-gray-400 ml-[3px]' : ''
              } ${
                date.getDay() === 6 ? 'mr-[3px]' : ''
              }`}
              style={{
                left: `${index * 100}px`,
                width: '694px',
                borderRight: '2px solid rgb(156 163 175)'
              }}
            >
              <div>
                {notesForWeek.map((note: Note) => (
                  <Card
                    key={note.id}
                    className="relative overflow-hidden group hover:ring-2 hover:ring-black/5 transition-all duration-150 mx-[3px] mb-[1px]"
                    style={{ 
                      backgroundColor: note.color,
                      borderLeft: '4px solid rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-4">
                        <time className="text-base font-semibold tracking-tight text-gray-900/90">
                          {format(new Date(note.start_date || note.note_date), 'MMM d')}
                        </time>
                        <div className="h-4 w-[1px] bg-gray-900/10" />
                        <p className="text-sm font-medium text-gray-900/80">
                          {note.content}
                        </p>
                      </div>
                      
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-sm px-1 rounded-full">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-black/5"
                          onClick={() => handleEdit(note)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-black/5"
                          onClick={() => handleDuplicate(note)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-black/5"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <DuplicateDialog
        isOpen={isDuplicateDialogOpen}
        onClose={() => setIsDuplicateDialogOpen(false)}
        onConfirm={handleDuplicateConfirm}
      />
    </>
  )
} 