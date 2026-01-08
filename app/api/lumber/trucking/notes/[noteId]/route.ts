import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// DELETE /api/lumber/trucking/notes/[noteId] - Delete a trucking note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await query('DELETE FROM lumber_trucking_notes WHERE id = $1', [params.noteId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trucking note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
