import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH /api/planner-notes/[id] - Update a planner note
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const noteId = parseInt(params.id)
    if (isNaN(noteId)) {
      return NextResponse.json({ success: false, error: 'Invalid note ID' }, { status: 400 })
    }

    const { content } = await request.json()

    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'content is required'
      }, { status: 400 })
    }

    const result = await query(
      `UPDATE planner_notes 
       SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING 
         id,
         note_type as "noteType",
         TO_CHAR(note_date, 'YYYY-MM-DD') as "noteDate",
         content`,
      [content, noteId]
    )

    if (!result.rows.length) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      note: result.rows[0]
    })
  } catch (error) {
    console.error('Error updating planner note:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update planner note'
    }, { status: 500 })
  }
}

// DELETE /api/planner-notes/[id] - Delete a planner note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const noteId = parseInt(params.id)
    if (isNaN(noteId)) {
      return NextResponse.json({ success: false, error: 'Invalid note ID' }, { status: 400 })
    }

    const result = await query(
      `DELETE FROM planner_notes WHERE id = $1 RETURNING id`,
      [noteId]
    )

    if (!result.rows.length) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting planner note:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete planner note'
    }, { status: 500 })
  }
}
