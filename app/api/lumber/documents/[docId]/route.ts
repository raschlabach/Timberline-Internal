import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { unlink } from 'fs/promises'
import { join } from 'path'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { docId } = params

    // Get the document first to get the file_path
    const docResult = await query(
      'SELECT * FROM lumber_load_documents WHERE id = $1',
      [docId]
    )

    if (docResult.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const doc = docResult.rows[0]

    // Delete from database
    await query('DELETE FROM lumber_load_documents WHERE id = $1', [docId])

    // Try to delete the physical file (don't fail if file doesn't exist)
    try {
      const filepath = join(process.cwd(), 'public', doc.file_path)
      await unlink(filepath)
    } catch (fileError) {
      console.warn('Could not delete file:', fileError)
      // Continue anyway - the DB record is deleted
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
