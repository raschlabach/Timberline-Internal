"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from 'sonner'
import { StickyNote, Check, X } from 'lucide-react'
import type { PlannerNote, PlannerNoteType } from '@/types/truckloads'

interface WeeklyNoteEditorProps {
  noteType: PlannerNoteType
  noteDate: string
  existingNote?: PlannerNote | null
  onSaved: () => void
  label?: string
}

export function WeeklyNoteEditor({
  noteType,
  noteDate,
  existingNote,
  onSaved,
  label,
}: WeeklyNoteEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(existingNote?.content || '')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setContent(existingNote?.content || '')
    setIsEditing(false)
  }, [existingNote, noteDate])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  async function handleSave() {
    if (!content.trim()) {
      // If content is empty and there's an existing note, delete it
      if (existingNote) {
        try {
          await fetch(`/api/planner-notes/${existingNote.id}`, { method: 'DELETE' })
          toast.success('Note removed')
          onSaved()
        } catch {
          toast.error('Failed to remove note')
        }
      }
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/planner-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteType,
          noteDate,
          content: content.trim(),
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Note saved')
        setIsEditing(false)
        onSaved()
      } else {
        throw new Error(result.error)
      }
    } catch {
      toast.error('Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isEditing) {
    return (
      <div
        className="group cursor-pointer"
        onClick={() => setIsEditing(true)}
      >
        {existingNote?.content ? (
          <div className="flex items-start gap-1.5 p-1.5 rounded hover:bg-amber-50/80 transition-colors">
            <StickyNote className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-3">{existingNote.content}</p>
          </div>
        ) : (
          <div className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-50 transition-colors opacity-0 group-hover:opacity-100">
            <StickyNote className="h-3 w-3 text-gray-300" />
            <span className="text-xs text-gray-400">{label || 'Add note...'}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5 p-1.5 rounded bg-amber-50/50 border border-amber-200">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={label || 'Add a note...'}
        rows={2}
        className="text-xs min-h-[48px] bg-white border-amber-200 focus:border-amber-400"
      />
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => {
            setContent(existingNote?.content || '')
            setIsEditing(false)
          }}
        >
          <X className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
